import { getRecord, updateRecord, queryRecords, nowIso } from './db.js';
import { sendEmail } from './email.js';

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

// ─── Stock decrement on order ───────────────────────────────────────────────
// Decrement product stock for each line of an order. Clamp at >= 0. Idempotent
// via order.stock_committed.
function commitStock({ order_id }) {
  const order = getRecord('Order', order_id);
  if (!order) return { _status: 404, error: 'Order not found' };
  if (order.stock_committed) return { ok: true, message: 'Stock already committed' };

  for (const item of orderItems(order)) {
    const pid = item.product_id || item.id;
    if (!pid) continue;
    const product = getRecord('Product', pid);
    if (!product) continue;
    const prev = Number(product.stock_quantity || 0);
    const next = Math.max(0, prev - Number(item.quantity || 1));
    updateRecord('Product', pid, { stock_quantity: next });
  }
  updateRecord('Order', order_id, { stock_committed: true });
  return { ok: true };
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

const REGISTRY = {
  commitStock,
  sendOrderConfirmation,
  sendOrderNotification,
  sendOrderStatusUpdate,
  sendWelcomeEmailNew,
};

export async function invokeFunction(name, body, user) {
  const fn = REGISTRY[name];
  if (!fn) {
    const err = new Error(`Unknown function: ${name}`);
    err.status = 404;
    throw err;
  }
  return await fn(body || {}, user);
}
