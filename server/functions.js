import { getRecord, createRecord, updateRecord, deleteRecord, queryRecords, nowIso, kvGet, kvSet } from './db.js';
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

const REGISTRY = {
  commitStock,
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
