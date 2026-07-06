import { getRecord, createRecord, updateRecord, deleteRecord, queryRecords, nowIso, kvGet, kvSet } from './db.js';
import { sendEmail } from './email.js';
import { sendCapiPurchase, isCapiConfigured } from './meta.js';
import {
  resolveLineItem, decrementStockPatch, restockStockPatch,
  getSizes, sizeId,
} from '../src/lib/pricing.js';

// ─── Brand / email constants ────────────────────────────────────────────────
const STORE_NAME = 'Trending Store';
const SUPPORT_EMAIL = 'trending.store701@gmail.com';
// Store owner's mailbox always receives new-order alerts.
const OWNER_ALERT_EMAIL = 'trending.store701@gmail.com';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function firstName(name, fallback = 'there') {
  const tok = String(name || '').trim().split(/\s+/)[0];
  return tok || fallback;
}

function formatOrderDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Prices in this store are whole USD. Render with up to 2 decimals when needed.
function money(v) {
  const n = Number(v || 0);
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function orderItems(order) {
  return Array.isArray(order.items) ? order.items : [];
}

// Pre-rendered <table> of order items for the branded order emails.
function orderItemsTableHtml(items) {
  const td = 'padding:10px 8px;border-bottom:1px solid #eee;font-size:14px;color:#1a1a1a;';
  const tdR = td + 'text-align:right;white-space:nowrap;';
  const th = 'padding:8px;border-bottom:2px solid #127a8a;font-size:11px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.8px;font-weight:600;';
  const rows = items.map((it) => {
    const name = it.product_name_ar || it.product_name || 'Item';
    const qty = Number(it.quantity || 1);
    const price = Number(it.price || 0);
    return `<tr><td style="${td}">${escapeHtml(name)}</td><td style="${tdR}">×${qty}</td><td style="${tdR}">${money(price)}</td><td style="${tdR}">${money(price * qty)}</td></tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 4px;">`
    + `<thead><tr>`
    + `<th align="left" style="${th}">Item</th>`
    + `<th align="right" style="${th}">Qty</th>`
    + `<th align="right" style="${th}">Price</th>`
    + `<th align="right" style="${th}">Total</th>`
    + `</tr></thead><tbody>${rows}</tbody></table>`;
}

// Shared branded HTML wrapper. Trending Store palette: teal #127a8a header,
// amber #f57c00 accent. Inline styles only (email-safe).
function emailShell(headingHtml, bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f4f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f7;padding:24px 0;"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
        <tr><td style="background:#127a8a;padding:24px 28px;"><span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:1px;">${STORE_NAME}</span></td></tr>
        <tr><td style="padding:30px 28px;">${headingHtml}${bodyHtml}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#8a8a8a;">
          Need help? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#127a8a;">${SUPPORT_EMAIL}</a> · ${STORE_NAME}
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

// All functions return a plain object. The HTTP layer wraps it as { data }.
// `user` is the authenticated user (or null for public-invokable functions).

// ─── Hidden price markup (reversible, server-authoritative) ──────────────────
// A store-wide markup percentage applied on top of every base/size/tier price
// at read + checkout time. Base prices are never mutated, so it is fully
// reversible. Per-product overrides live on the product doc (product.markup_pct)
// and win over this global value. Default 0% → no behavior change.
const MARKUP_CONFIG_KEY = 'price_markup_config';

export function getGlobalMarkupPct() {
  const raw = kvGet(MARKUP_CONFIG_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    const v = Number(parsed?.global_pct);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function getMarkupConfig() {
  return { global_pct: getGlobalMarkupPct() };
}

function saveMarkupConfig(body) {
  let pct = Number(body?.global_pct);
  if (!Number.isFinite(pct)) pct = 0;
  // Clamp to a sane range so a typo can't wipe out or explode the catalog.
  if (pct < 0) pct = 0;
  if (pct > 1000) pct = 1000;
  kvSet(MARKUP_CONFIG_KEY, JSON.stringify({ global_pct: pct }));
  return { ok: true, global_pct: pct };
}

// ─── Server-authoritative order recompute ────────────────────────────────────
// Re-derive every line price, the subtotal, the delivery fee and the total from
// the AUTHORITATIVE product data — never trusting client-sent prices. Applies
// size pricing, quantity-tier (bundle) pricing and the hidden markup. Also
// auto-waives delivery when any free-delivery item is in the cart. Preserves the
// existing coupon discount (sanitized) and shipping behavior for normal carts.
export function recomputeOrder(orderData = {}) {
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  if (items.length === 0) return orderData;
  const globalPct = getGlobalMarkupPct();

  let subtotal = 0;
  let anyFreeDelivery = false;
  const recomputedItems = items.map((item) => {
    const pid = item.product_id || item.id;
    const product = pid ? getRecord('Product', pid) : null;
    // Unknown product (e.g. deleted): keep the client line as-is rather than
    // dropping it, but still count its total toward the subtotal.
    if (!product) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const line = Number(item.price || 0) * qty;
      subtotal += line;
      if (item.free_delivery || item.free_shipping) anyFreeDelivery = true;
      return item;
    }
    const resolved = resolveLineItem(product, {
      size_id: item.size_id,
      quantity: item.quantity,
      offer_min_quantity: item.offer_min_quantity,
    }, globalPct);
    subtotal += resolved.line_total;
    const freeDelivery = !!product.free_delivery || resolved.free_shipping;
    if (freeDelivery) anyFreeDelivery = true;
    return {
      ...item,
      quantity: resolved.quantity,
      price: resolved.unit_price,
      size_id: resolved.size_id || item.size_id || '',
      size_label: resolved.size_label || item.size_label || '',
      size_label_ar: resolved.size_label_ar || item.size_label_ar || '',
      offer_min_quantity: resolved.tier_min_quantity ?? item.offer_min_quantity ?? null,
      offer_label: resolved.tier_label || item.offer_label || '',
      offer_label_ar: resolved.tier_label_ar || item.offer_label_ar || '',
      free_delivery: freeDelivery,
    };
  });
  subtotal = Math.round(subtotal * 100) / 100;

  // Delivery fee: waived when a free-delivery item is present, else the store
  // setting (mirrors the storefront's "fee applies when there is a subtotal").
  const feeSetting = queryRecords('SiteSettings', { query: { key: 'delivery_fee' }, limit: 1 })[0];
  const baseFee = Number(feeSetting?.value) || 0;
  const deliveryFee = anyFreeDelivery || subtotal <= 0 ? 0 : baseFee;

  // Preserve the coupon discount but never let it exceed the recomputed subtotal.
  const discount = Math.min(subtotal, Math.max(0, Number(orderData.discount) || 0));
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  return {
    ...orderData,
    items: recomputedItems,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    free_delivery_applied: anyFreeDelivery,
    total: Math.round(total * 100) / 100,
  };
}

// ─── Stock movement ledger (append-only audit log) ───────────────────────────
// Every stock change writes one immutable StockMovement doc. Reads are admin-only
// (see READ_PROTECTED in server/index.js). Reasons: 'sale' (commitStock),
// 'cancel_restock' (cancelOrder), 'manual_adjust' / 'initial' (admin product
// create/edit). Never mutated in place, so it is a trustworthy audit trail.
function ledgerNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function recordStockMovement({
  product, product_id, product_name, product_name_ar,
  size_id = '', size_label = '', size_label_ar = '',
  delta, balance = null, reason, reference = '', actor = '',
}) {
  const d = Number(delta) || 0;
  if (!d && reason === 'initial') return; // don't log a no-op initial (0 stock)
  const pid = product_id || product?.id || '';
  try {
    createRecord('StockMovement', {
      product_id: pid,
      product_name: product_name || product?.name || '',
      product_name_ar: product_name_ar || product?.name_ar || '',
      size_id: size_id || '',
      size_label: size_label || '',
      size_label_ar: size_label_ar || '',
      delta: d,
      balance: balance == null ? null : Number(balance),
      reason: reason || 'manual_adjust',
      reference: reference || '',
      actor: actor || '',
      at: nowIso(),
    });
  } catch (e) {
    console.error('[stock_movement] failed to record:', e?.message);
  }
}

// Resulting balance for the targeted pool, read from a decrement/restock patch.
function balanceFromStockPatch(patch, sizeKey) {
  if (!patch) return null;
  if (patch.stock_quantity != null) return patch.stock_quantity;
  if (Array.isArray(patch.sizes)) {
    const s = patch.sizes.find((x) => sizeId(x) === String(sizeKey ?? ''));
    if (s && s.stock_quantity != null) return s.stock_quantity;
  }
  return null;
}

// Diff a product's stock (top-level + per size) before/after a manual admin
// write and append a ledger entry per changed pool. `before` null → a create,
// logged as 'initial'. No change → nothing logged (so it never double-counts a
// sale/restock, which never flow through the HTTP product write path).
export function recordManualStockAdjustments(before, after, actor = 'admin') {
  if (!after) return;
  const isCreate = !before;
  const reasonFor = () => (isCreate ? 'initial' : 'manual_adjust');

  const beforeTop = ledgerNum(before?.stock_quantity);
  const afterTop = ledgerNum(after?.stock_quantity);
  if (afterTop != null && afterTop !== beforeTop) {
    recordStockMovement({
      product: after, product_id: after.id,
      delta: afterTop - (beforeTop || 0), balance: afterTop,
      reason: reasonFor(), reference: actor, actor,
    });
  }

  const beforeSizes = getSizes(before || {});
  for (const s of getSizes(after)) {
    const sid = sizeId(s);
    const prev = beforeSizes.find((x) => sizeId(x) === sid);
    const a = ledgerNum(s.stock_quantity);
    const b = ledgerNum(prev?.stock_quantity);
    if (a != null && a !== b) {
      recordStockMovement({
        product: after, product_id: after.id,
        size_id: sid, size_label: s.label || '', size_label_ar: s.label_ar || '',
        delta: a - (b || 0), balance: a,
        reason: prev ? reasonFor() : (isCreate ? 'initial' : 'manual_adjust'),
        reference: actor, actor,
      });
    }
  }
}

// ─── Stock decrement on order ───────────────────────────────────────────────
// Decrement stock for each line of an order, drawing down the SELECTED SIZE's
// pool when the line targets a size (else the product's top-level stock).
// Idempotent via order.stock_committed.
function commitStock({ order_id }) {
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };
  if (order.stock_committed) return { ok: true, message: 'Stock already committed' };

  for (const item of orderItems(order)) {
    const pid = item.product_id || item.id;
    if (!pid) continue;
    const product = getRecord('Product', pid);
    if (!product) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const patch = decrementStockPatch(product, item.size_id, item.quantity || 1);
    if (patch) {
      updateRecord('Product', pid, patch);
      recordStockMovement({
        product, product_id: pid,
        size_id: item.size_id || '', size_label: item.size_label || '', size_label_ar: item.size_label_ar || '',
        delta: -qty, balance: balanceFromStockPatch(patch, item.size_id),
        reason: 'sale', reference: order.order_number || order_id,
      });
    }
  }
  updateRecord('Order', order_id, { stock_committed: true });
  return { ok: true };
}

// ─── Inventory restock on cancellation ───────────────────────────────────────
// Return each order line's quantity to the correct SIZE's pool (mirror of
// commitStock). Guards against double-restock via order.stock_restocked and
// only restocks stock that was actually committed. Also flips the order status
// to 'cancelled' so the transition + restock happen atomically from one call.
function cancelOrder({ order_id }) {
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };

  const alreadyCancelled = order.status === 'cancelled';
  let restocked = false;
  if (order.stock_committed && !order.stock_restocked) {
    for (const item of orderItems(order)) {
      const pid = item.product_id || item.id;
      if (!pid) continue;
      const product = getRecord('Product', pid);
      if (!product) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const patch = restockStockPatch(product, item.size_id, item.quantity || 1);
      if (patch) {
        updateRecord('Product', pid, patch);
        recordStockMovement({
          product, product_id: pid,
          size_id: item.size_id || '', size_label: item.size_label || '', size_label_ar: item.size_label_ar || '',
          delta: qty, balance: balanceFromStockPatch(patch, item.size_id),
          reason: 'cancel_restock', reference: order.order_number || order_id,
        });
      }
    }
    restocked = true;
  }

  const patch = { status: 'cancelled' };
  if (restocked) patch.stock_restocked = true;
  const updated = updateRecord('Order', order_id, patch);
  return { ok: true, restocked, already_cancelled: alreadyCancelled, order: updated };
}

// ─── Order confirmation (customer) ──────────────────────────────────────────
// Trending Store checkout collects customer_email optionally. When absent we
// skip the customer email (and say so) rather than failing.
async function sendOrderConfirmation(body) {
  const { order_id } = body;
  if (!order_id) return { _status: 400, error: 'order_id required' };
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };
  if (!order.customer_email) {
    return { status: 'skipped', message: 'No customer_email on order' };
  }

  const already = queryRecords('EmailLog', {
    query: { email_type: 'order_confirmation', order_id, status: 'sent' }, sort: 'sent_at', limit: 1,
  });
  if (already.length > 0) return { status: 'already_sent', message: 'Confirmation already sent' };

  const orderDate = formatOrderDate(order.created_date);
  const subject = `We received your order #${order.order_number}`;
  const heading = `<h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#127a8a;">Thank you, ${escapeHtml(firstName(order.customer_name))}.</h2>`;
  const bodyHtml = `<p style="margin:0 0 16px;color:#444;">We've received your order and will contact you shortly to confirm delivery. Payment is Cash on Delivery.</p>
    <p style="margin:0 0 16px;color:#444;">Order <strong>#${escapeHtml(order.order_number)}</strong><br/>
    Date: ${escapeHtml(orderDate)}</p>
    ${orderItemsTableHtml(orderItems(order))}
    <p style="margin:14px 0 0;color:#444;">Subtotal: ${money(order.subtotal)}<br/>
    Delivery: ${money(order.delivery_fee)}<br/>
    <strong>Total: ${money(order.total)}</strong></p>`;

  const result = await sendEmail({
    to: order.customer_email,
    subject,
    html: emailShell(heading, bodyHtml),
    email_type: 'order_confirmation',
    order_id,
    customer_id: order.customer_id || '',
    trigger_event: 'order.submitted',
  });
  return { status: result.status, log_id: result.log_id };
}

// ─── Admin new-order alert ──────────────────────────────────────────────────
async function sendOrderNotification(body) {
  const { order_id } = body;
  if (!order_id) return { _status: 400, error: 'order_id required' };
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };

  // Alert recipients: store owner's Gmail always gets a copy; any admin_emails
  // SiteSetting and MINIYO_ADMIN_EMAIL / MINIYO_ORDER_ALERT_EMAILS are merged
  // in. De-duped, case-insensitive.
  const adminSetting = queryRecords('SiteSettings', { query: { key: 'admin_emails' }, limit: 1 })[0];
  const recipients = [
    OWNER_ALERT_EMAIL,
    adminSetting?.value,
    process.env.MINIYO_ADMIN_EMAIL,
    process.env.MINIYO_ORDER_ALERT_EMAILS,
  ]
    .filter(Boolean)
    .flatMap((v) => String(v).split(','))
    .map((e) => e.trim())
    .filter(Boolean);
  const seen = new Set();
  const toList = recipients.filter((e) => {
    const k = e.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const already = queryRecords('EmailLog', {
    query: { email_type: 'order_notification', order_id, status: 'sent' }, sort: 'sent_at', limit: 1,
  });
  if (already.length > 0) return { status: 'already_sent', message: 'Admin alert already sent' };

  const itemsHtml = orderItems(order).map((it) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(it.product_name_ar || it.product_name || 'Item')}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">×${Number(it.quantity || 1)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${money(Number(it.price || 0) * Number(it.quantity || 1))}</td></tr>`
  ).join('');
  const address = [order.customer_address, order.customer_city].filter(Boolean).join(', ');
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;">
    <h2 style="color:#127a8a;">New Order: ${escapeHtml(order.order_number)}</h2>
    <p>Customer: ${escapeHtml(order.customer_name || '')} · ${escapeHtml(order.customer_phone || '')}<br/>
    ${order.customer_email ? `Email: ${escapeHtml(order.customer_email)}<br/>` : ''}
    Address: ${escapeHtml(address)}<br/>
    ${order.customer_notes ? `Notes: ${escapeHtml(order.customer_notes)}` : ''}</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:480px;"><tbody>${itemsHtml}</tbody></table>
    <p>Subtotal: ${money(order.subtotal)}<br/>
    Delivery: ${money(order.delivery_fee)}<br/>
    <strong>Total: ${money(order.total)}</strong><br/>
    Payment: ${escapeHtml(order.payment_method || 'Cash on Delivery')}</p></body></html>`;

  const result = await sendEmail({
    to: toList,
    subject: `New Order ${order.order_number}`,
    html,
    email_type: 'order_notification',
    order_id,
    trigger_event: 'order_created',
  });
  return { status: result.status, log_id: result.log_id };
}

// ─── Order status update (customer) ─────────────────────────────────────────
const STATUS_TEMPLATES = {
  confirmed: { subject: 'Order Confirmed', subject_ar: 'تم تأكيد الطلب', message: "Your order has been confirmed and we're preparing it.", message_ar: 'تم تأكيد طلبك ونحن نجهّزه الآن.' },
  processing: { subject: 'Order Processing', subject_ar: 'جاري تجهيز الطلب', message: 'We are preparing your order for shipment.', message_ar: 'نقوم بتجهيز طلبك للشحن.' },
  shipped: { subject: 'Order Shipped', subject_ar: 'تم شحن الطلب', message: 'Your order is on its way to you.', message_ar: 'طلبك في طريقه إليك.' },
  delivered: { subject: 'Order Delivered', subject_ar: 'تم توصيل الطلب', message: 'Your order has been delivered. We hope you enjoy it!', message_ar: 'تم توصيل طلبك. نتمنى أن ينال إعجابك!' },
  cancelled: { subject: 'Order Cancelled', subject_ar: 'تم إلغاء الطلب', message: 'Your order has been cancelled. Contact us with any questions.', message_ar: 'تم إلغاء طلبك. تواصل معنا لأي استفسار.' },
};

async function sendOrderStatusUpdate(body) {
  const { order_id, new_status } = body;
  if (!order_id || !new_status) return { _status: 400, error: 'order_id and new_status required' };
  const key = String(new_status).toLowerCase();
  const tpl = STATUS_TEMPLATES[key];
  if (!tpl) return { _status: 400, error: 'Invalid status' };
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };
  if (!order.customer_email) return { status: 'skipped', message: 'No customer_email on order' };

  const trigger = `status_changed_to_${key}`;
  const already = queryRecords('EmailLog', {
    query: { email_type: 'order_status_update', order_id, status: 'sent', trigger_event: trigger }, sort: 'sent_at', limit: 1,
  });
  if (already.length > 0) return { status: 'already_sent', message: `${new_status} email already sent` };

  const heading = `<h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#127a8a;">${escapeHtml(tpl.subject)}</h2>`;
  const bodyHtml = `<p style="margin:0 0 16px;color:#444;">${escapeHtml(tpl.message)}</p>
    <p style="margin:0 0 16px;color:#444;" dir="rtl">${escapeHtml(tpl.message_ar)}</p>
    <p style="margin:0 0 16px;color:#444;">Order <strong>#${escapeHtml(order.order_number)}</strong><br/>
    Status: ${escapeHtml(new_status)}<br/>
    Total: <strong>${money(order.total)}</strong></p>`;

  const result = await sendEmail({
    to: order.customer_email,
    subject: tpl.subject,
    html: emailShell(heading, bodyHtml),
    email_type: 'order_status_update',
    order_id,
    customer_id: order.customer_id || '',
    trigger_event: trigger,
  });
  return { status: result.status, log_id: result.log_id };
}

// ─── Welcome email (on registration) ────────────────────────────────────────
async function sendWelcomeEmailNew(body) {
  const { customer_id, email, name, full_name } = body;
  if (!email) return { _status: 400, error: 'email required' };
  if (customer_id) {
    const already = queryRecords('EmailLog', {
      query: { email_type: 'welcome', customer_id, status: 'sent' }, sort: 'sent_at', limit: 1,
    });
    if (already.length > 0) return { status: 'already_sent', message: 'Welcome email already sent' };
  }
  const localPart = String(email).split('@')[0] || 'there';
  const realName = [full_name, name].find((n) => n && !String(n).includes('@'));
  const fname = firstName(realName, localPart);
  const subject = `Welcome to ${STORE_NAME}, ${fname}`;
  const heading = `<h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#127a8a;">Welcome, ${escapeHtml(fname)}.</h2>`;
  const bodyHtml = `<p style="margin:0 0 16px;color:#444;">Thanks for creating your ${STORE_NAME} account. Browse practical gadgets for everyday life — Cash on Delivery across Lebanon.</p>`;
  const result = await sendEmail({
    to: email,
    subject,
    html: emailShell(heading, bodyHtml),
    email_type: 'welcome',
    customer_id: customer_id || '',
    trigger_event: 'user.registered',
  });
  return { status: result.status, log_id: result.log_id };
}

// ─── Role helpers ────────────────────────────────────────────────────────────
export function isAdmin(user) {
  return !!user && (user.role === 'admin' || user.role === 'super_admin');
}

// Finance/profit + user management is owner-only — restricted to super_admin.
export function isSuperAdmin(user) {
  return !!user && user.role === 'super_admin';
}

// ─── User & role management (super-admin only via central guard) ─────────────
const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin'];

// Strip credential-bearing fields before returning a user over the API.
function publicUserRecord(u) {
  if (!u) return null;
  const { password_hash, otp_hash, otp_expires_at, otp_attempts, ...rest } = u;
  return rest;
}

function listUsers() {
  const users = queryRecords('User', { sort: '-created_date', limit: 2000 });
  return { users: users.map(publicUserRecord) };
}

// Write an AuditLog row for a sensitive admin action.
function writeAudit({ action, entity, entityId, actor, details }) {
  try {
    createRecord('AuditLog', {
      action,
      entity,
      entity_id: entityId || '',
      user_name: actor || 'system',
      created_at: nowIso(),
      details: details || '',
    });
  } catch (e) {
    console.error('[audit] failed to write entry:', e?.message);
  }
}

// Promote/demote a user's role. Super-admin only (central guard). Refuses to
// remove the LAST super admin so the store always keeps an owner, and records
// an AuditLog entry capturing old → new role.
function setUserRole(body, user) {
  const { user_id, role } = body || {};
  if (!user_id || !role) return { _status: 400, error: 'user_id and role are required' };
  if (!VALID_ROLES.includes(role)) {
    return { _status: 400, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` };
  }
  const target = getRecord('User', user_id);
  if (!target) return { _status: 404, error: 'User not found' };

  const oldRole = target.role;
  if (oldRole === role) {
    return { ok: true, unchanged: true, user: publicUserRecord(target) };
  }

  // Guard the last super admin: never let the count drop to zero.
  if (oldRole === 'super_admin' && role !== 'super_admin') {
    const superCount = queryRecords('User', { query: { role: 'super_admin' } }).length;
    if (superCount <= 1) {
      return { _status: 409, error: 'Cannot remove the last super admin. Promote another user to super admin first.' };
    }
  }

  const updated = updateRecord('User', user_id, { role });
  writeAudit({
    action: 'role_changed',
    entity: 'User',
    entityId: user_id,
    actor: user?.full_name || user?.email || 'unknown',
    details: `${target.email || user_id}: ${oldRole || 'none'} → ${role}`,
  });
  return { ok: true, user: publicUserRecord(updated), old_role: oldRole, new_role: role };
}

function listAuditLog(body) {
  const limit = Math.min(Number(body?.limit) || 500, 2000);
  const logs = queryRecords('AuditLog', { sort: '-created_at', limit });
  return { logs };
}

// ─── Financials (super-admin only) ───────────────────────────────────────────
// Projected revenue and gross-profit estimate from current inventory, plus an
// editable overheads list. Owner-only via the central guard, so cost/profit
// figures never reach a non-super-admin browser.
const FIN_CONFIG_KEY = 'financials_config';
const DEFAULT_OVERHEAD_ROWS = [
  { label: 'Packaging', qty: 0, unit_price: 0 },
  { label: 'Marketing', qty: 0, unit_price: 0 },
];

function defaultFinancialsConfig() {
  return { currency_label: 'USD', default_cost_ratio: 0.6, overhead_rows: DEFAULT_OVERHEAD_ROWS };
}

function getFinancialsConfig() {
  const raw = kvGet(FIN_CONFIG_KEY);
  if (!raw) return defaultFinancialsConfig();
  try {
    const parsed = JSON.parse(raw);
    return {
      currency_label: parsed.currency_label || 'USD',
      default_cost_ratio: Number.isFinite(Number(parsed.default_cost_ratio)) ? Number(parsed.default_cost_ratio) : 0.6,
      overhead_rows: Array.isArray(parsed.overhead_rows) ? parsed.overhead_rows : DEFAULT_OVERHEAD_ROWS,
    };
  } catch {
    return defaultFinancialsConfig();
  }
}

function saveFinancialsConfig(body) {
  const rows = Array.isArray(body?.overhead_rows) ? body.overhead_rows : [];
  let ratio = Number(body?.default_cost_ratio);
  if (!Number.isFinite(ratio) || ratio < 0) ratio = 0.6;
  if (ratio > 1) ratio = 1;
  const clean = {
    currency_label: String(body?.currency_label || 'USD').slice(0, 16) || 'USD',
    default_cost_ratio: ratio,
    overhead_rows: rows.map((r) => ({
      label: String(r?.label ?? '').slice(0, 120),
      qty: Number(r?.qty) || 0,
      unit_price: Number(r?.unit_price) || 0,
    })),
  };
  kvSet(FIN_CONFIG_KEY, JSON.stringify(clean));
  return { ok: true, ...clean };
}

// Projected revenue = Σ(price × stock) over active products. COGS uses each
// product's own `cost` when set, otherwise price × default_cost_ratio.
function getFinancials() {
  const cfg = getFinancialsConfig();
  const products = queryRecords('Product', {});
  let projectedRevenue = 0;
  let estimatedCogs = 0;
  let unitsInStock = 0;
  let activeCount = 0;
  for (const p of products) {
    if (p.status && p.status !== 'active') continue;
    const price = Number(p.price) || 0;
    const stock = Number(p.stock_quantity) || 0;
    const unitCost = Number(p.cost ?? p.cost_price);
    const cost = Number.isFinite(unitCost) && unitCost > 0 ? unitCost : price * cfg.default_cost_ratio;
    projectedRevenue += price * stock;
    estimatedCogs += cost * stock;
    unitsInStock += stock;
    activeCount += 1;
  }
  const overheadsTotal = cfg.overhead_rows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0
  );
  const projectedGrossProfit = projectedRevenue - estimatedCogs - overheadsTotal;
  const projectedMargin = projectedRevenue > 0 ? projectedGrossProfit / projectedRevenue : 0;
  return {
    currency_label: cfg.currency_label,
    default_cost_ratio: cfg.default_cost_ratio,
    overhead_rows: cfg.overhead_rows,
    products_count: activeCount,
    units_in_stock: unitsInStock,
    projected_revenue: Math.round(projectedRevenue * 100) / 100,
    estimated_cogs: Math.round(estimatedCogs * 100) / 100,
    overheads_total: Math.round(overheadsTotal * 100) / 100,
    projected_gross_profit: Math.round(projectedGrossProfit * 100) / 100,
    projected_margin: Math.round(projectedMargin * 1000) / 1000,
  };
}

// ─── Customers: aggregate from Orders (admin via central guard) ───────────────
// Trending has no first-class Customer records, so derive them from Orders
// keyed by phone (fallback email). Money fields (total_spent, aov) are included
// only for super_admins so a regular admin's browser never sees revenue totals.
function aggregateCustomers(user) {
  const orders = queryRecords('Order', { sort: '-created_date' });
  const map = new Map();
  for (const o of orders) {
    const key = (o.customer_phone || o.customer_email || '').trim().toLowerCase();
    if (!key) continue;
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name: o.customer_name || '',
        phone: o.customer_phone || '',
        email: o.customer_email || '',
        orders_count: 0,
        total_spent: 0,
        last_order_date: o.created_date,
        last_order_number: o.order_number || '',
      };
      map.set(key, c);
    }
    c.orders_count += 1;
    c.total_spent += Number(o.total) || 0;
    if (!c.name && o.customer_name) c.name = o.customer_name;
    if (!c.email && o.customer_email) c.email = o.customer_email;
  }
  let customers = [...map.values()].sort((a, b) => b.orders_count - a.orders_count);
  if (!isSuperAdmin(user)) {
    customers = customers.map(({ total_spent, ...rest }) => rest);
  } else {
    customers = customers.map((c) => ({ ...c, aov: c.orders_count ? Math.round((c.total_spent / c.orders_count) * 100) / 100 : 0 }));
  }
  return { customers };
}

function listCustomers(body, user) {
  return aggregateCustomers(user);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCustomersCsv(body, user) {
  const { customers } = aggregateCustomers(user);
  const includeMoney = isSuperAdmin(user);
  const headers = ['Name', 'Phone', 'Email', 'Orders', 'Last Order', 'Last Order Date'];
  if (includeMoney) headers.push('Total Spent', 'AOV');
  const lines = [headers.join(',')];
  for (const c of customers) {
    const row = [c.name, c.phone, c.email, c.orders_count, c.last_order_number, c.last_order_date];
    if (includeMoney) row.push(c.total_spent, c.aov);
    lines.push(row.map(csvCell).join(','));
  }
  return { filename: `customers-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join('\n') };
}

function exportProductsCsv() {
  const products = queryRecords('Product', { sort: '-created_date' });
  const headers = ['Name', 'Name (AR)', 'Category', 'Price', 'Compare At', 'Stock', 'Status'];
  const lines = [headers.join(',')];
  for (const p of products) {
    lines.push([
      p.name, p.name_ar, p.category, p.price, p.compare_at_price ?? '', p.stock_quantity ?? '', p.status ?? '',
    ].map(csvCell).join(','));
  }
  return { filename: `products-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join('\n') };
}

function exportInventoryCsv(body, user) {
  const products = queryRecords('Product', { sort: 'stock_quantity' });
  const includeValue = isSuperAdmin(user);
  const headers = ['Name', 'Category', 'Stock', 'Status'];
  if (includeValue) headers.push('Unit Price', 'Stock Value');
  const lines = [headers.join(',')];
  for (const p of products) {
    const row = [p.name, p.category, p.stock_quantity ?? 0, p.status ?? ''];
    if (includeValue) {
      const price = Number(p.price) || 0;
      const stock = Number(p.stock_quantity) || 0;
      row.push(price, Math.round(price * stock * 100) / 100);
    }
    lines.push(row.map(csvCell).join(','));
  }
  return { filename: `inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join('\n') };
}

// ─── Category cleanup (admin) ─────────────────────────────────────────────────
// Remove duplicate categories (same slug) keeping the earliest, and drop
// categories that have no products and no slug. Returns a summary.
function cleanupCategories() {
  const categories = queryRecords('Category', { sort: 'created_date' });
  const products = queryRecords('Product', {});
  const usedSlugs = new Set(products.map((p) => p.category).filter(Boolean));
  const seen = new Set();
  let removedDupes = 0;
  let removedEmpty = 0;
  for (const c of categories) {
    if (c.slug && seen.has(c.slug)) {
      deleteRecord('Category', c.id); removedDupes += 1; continue;
    }
    if (c.slug) seen.add(c.slug);
    if (!c.slug && !c.name) { deleteRecord('Category', c.id); removedEmpty += 1; }
  }
  return { ok: true, removed_duplicates: removedDupes, removed_empty: removedEmpty, used_slugs: [...usedSlugs] };
}

// ─── Customer self-service account (ownership-gated, level 'auth') ─────────────
// These power the storefront /account area. Every function derives ownership
// from the AUTHENTICATED `user` — never from a client-supplied id — so a
// customer can only ever read or mutate their own data. The generic Order /
// CustomerAddress entity reads stay admin-only (READ_PROTECTED); the storefront
// reaches a customer's own records solely through these functions.

// A customer's own orders, matched by the email on their account and by any
// order linked via customer_id (set at checkout). Buyers see full totals for
// their OWN orders — money redaction only applies to the generic admin read path.
function getMyOrders(body, user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const uid = user?.id;
  const all = queryRecords('Order', { sort: '-created_date' });
  const mine = all.filter((o) => {
    const oEmail = String(o.customer_email || '').trim().toLowerCase();
    return (email && oEmail === email) || (uid && o.customer_id === uid);
  });
  return { orders: mine };
}

// Saved shipping addresses owned by the current user.
function listMyAddresses(body, user) {
  const addresses = queryRecords('CustomerAddress', {
    query: { user_id: user.id }, sort: '-is_default',
  });
  return { addresses };
}

// Whitelist of address fields a customer may set — never trust client-supplied
// ownership keys (user_id) or timestamps.
const ADDRESS_FIELDS = ['label', 'full_name', 'phone', 'city', 'address', 'notes', 'is_default'];

function cleanAddress(body) {
  const out = {};
  for (const k of ADDRESS_FIELDS) {
    if (body[k] !== undefined) out[k] = k === 'is_default' ? !!body[k] : String(body[k] ?? '');
  }
  return out;
}

// When an address is marked default, clear the flag on the user's other addresses
// so exactly one stays default.
function clearOtherDefaults(userId, keepId) {
  const existing = queryRecords('CustomerAddress', { query: { user_id: userId } });
  for (const a of existing) {
    if (a.id !== keepId && a.is_default) updateRecord('CustomerAddress', a.id, { is_default: false });
  }
}

// Create or update one of the current user's saved addresses. Updates verify the
// target belongs to the caller before mutating.
function saveMyAddress(body, user) {
  const data = cleanAddress(body || {});
  const id = body?.id;
  if (id) {
    const existing = getRecord('CustomerAddress', id);
    if (!existing || existing.user_id !== user.id) {
      return { _status: 404, error: 'Address not found' };
    }
    const updated = updateRecord('CustomerAddress', id, data);
    if (updated.is_default) clearOtherDefaults(user.id, id);
    return { ok: true, address: updated };
  }
  const created = createRecord('CustomerAddress', { ...data, user_id: user.id });
  if (created.is_default) clearOtherDefaults(user.id, created.id);
  return { ok: true, address: created };
}

// Delete one of the current user's saved addresses (ownership-checked).
function deleteMyAddress(body, user) {
  const id = body?.id;
  if (!id) return { _status: 400, error: 'id required' };
  const existing = getRecord('CustomerAddress', id);
  if (!existing || existing.user_id !== user.id) {
    return { _status: 404, error: 'Address not found' };
  }
  deleteRecord('CustomerAddress', id);
  return { ok: true, id };
}

// ─── Meta Conversions API — authoritative server-side Purchase ───────────────
// Sends one server Purchase event per order via CAPI, sharing the browser
// Pixel's event_id for deduplication. Idempotent: order.meta_purchase_sent
// guards against a second send if checkout retries. Silent no-op when Meta env
// vars are unset. Public because it is triggered by the (guest) checkout flow.
async function metaTrackPurchase({ order_id, event_id }) {
  if (!order_id) return { _status: 400, error: 'order_id required' };
  if (!isCapiConfigured()) return { ok: true, skipped: true, reason: 'not_configured' };
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };
  if (order.meta_purchase_sent) return { ok: true, already_sent: true };

  const result = await sendCapiPurchase({ order, eventId: event_id });
  // Only mark as sent when Meta actually accepted the event, so a transient
  // failure can be retried without permanently dropping the conversion.
  if (result?.ok) updateRecord('Order', order_id, { meta_purchase_sent: true });
  return result;
}

const REGISTRY = {
  commitStock,
  cancelOrder,
  metaTrackPurchase,
  getMarkupConfig,
  saveMarkupConfig,
  getMyOrders,
  listMyAddresses,
  saveMyAddress,
  deleteMyAddress,
  sendOrderConfirmation,
  sendOrderNotification,
  sendOrderStatusUpdate,
  sendWelcomeEmailNew,
  listUsers,
  setUserRole,
  listAuditLog,
  getFinancials,
  getFinancialsConfig,
  saveFinancialsConfig,
  listCustomers,
  exportCustomersCsv,
  exportProductsCsv,
  exportInventoryCsv,
  cleanupCategories,
};

// ─── Centralized authorization ───────────────────────────────────────────────
// Every function declares its required access level in ONE place instead of
// repeating inline role checks. Levels:
//   'public'      — no auth required (storefront/checkout-triggered flows)
//   'auth'        — any authenticated user
//   'admin'       — admin or super_admin
//   'super_admin' — super_admin only (finance + user management)
// Unlisted functions default to 'admin' (fail-safe, never 'public').
const GUARDS = {
  commitStock: 'public',
  metaTrackPurchase: 'public',
  cancelOrder: 'admin',
  getMarkupConfig: 'admin',
  saveMarkupConfig: 'admin',
  getMyOrders: 'auth',
  listMyAddresses: 'auth',
  saveMyAddress: 'auth',
  deleteMyAddress: 'auth',
  sendOrderConfirmation: 'public',
  sendOrderNotification: 'public',
  sendOrderStatusUpdate: 'public',
  sendWelcomeEmailNew: 'public',
  listAuditLog: 'super_admin',
  listUsers: 'super_admin',
  setUserRole: 'super_admin',
  getFinancials: 'super_admin',
  getFinancialsConfig: 'super_admin',
  saveFinancialsConfig: 'super_admin',
  listCustomers: 'admin',
  exportCustomersCsv: 'admin',
  exportProductsCsv: 'admin',
  exportInventoryCsv: 'admin',
  cleanupCategories: 'admin',
};

// Returns a 401/403 error object when the user fails the level, else null.
export function authorizeFunction(level, user) {
  if (level === 'public') return null;
  if (!user) return { _status: 401, error: 'Authentication required' };
  if (level === 'auth') return null;
  if (level === 'admin') {
    return isAdmin(user) ? null : { _status: 403, error: 'Forbidden: admin access required' };
  }
  if (level === 'super_admin') {
    return isSuperAdmin(user) ? null : { _status: 403, error: 'Forbidden: super admin access required' };
  }
  return { _status: 403, error: 'Forbidden' };
}

export async function invokeFunction(name, body, user) {
  const fn = REGISTRY[name];
  if (!fn) {
    const err = new Error(`Unknown function: ${name}`);
    err.status = 404;
    throw err;
  }
  const denied = authorizeFunction(GUARDS[name] || 'admin', user);
  if (denied) return denied;
  return await fn(body || {}, user);
}
