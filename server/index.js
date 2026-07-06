import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  initSchema, createRecord, getRecord, updateRecord, deleteRecord,
  queryRecords, ENTITIES,
} from './db.js';
import {
  registerUser, authenticate, signToken, setSessionCookie, clearSessionCookie,
  getUserFromRequest, publicUser, findUserByEmail, setPassword, changePassword, updateUser,
  issueOtp, verifyOtp as verifyOtpCode,
} from './auth.js';
import {
  invokeFunction, isSuperAdmin, getGlobalMarkupPct, recomputeOrder,
  recordManualStockAdjustments,
} from './functions.js';
import { applyMarkup, markupPctForProduct } from '../src/lib/pricing.js';
import { productContentId, META_CURRENCY } from '../src/lib/metaShared.js';
import { sendEmail } from './email.js';
import { runSeed } from './seed.js';
import { optimizeAndStore, bufferFromBase64 } from './imageOptimize.js';

// Build the verification-code email HTML (Trending Store branding).
function otpEmailHtml(code) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:18px;font-weight:800;letter-spacing:1px;color:#127a8a;margin:0 0 20px;">Trending Store</p>
      <h1 style="font-size:20px;font-weight:600;color:#111111;margin:0 0 8px;">Verify your email</h1>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">Enter this code to confirm your email address. It expires in 10 minutes.</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#127a8a;background:#fff;border:1px solid #e3e8ea;border-radius:8px;padding:18px;text-align:center;">${code}</div>
      <p style="color:#999;font-size:12px;margin:24px 0 0;">If you didn't create a Trending Store account, you can safely ignore this email.</p>
    </div></body></html>`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = process.env.PORT || 4000;

initSchema();
runSeed();

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// ─── helpers ────────────────────────────────────────────────────────────────
function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Parse list()/filter() args from query string.
//   list: ?sort=-created_date&limit=50
//   filter: ?q=<json>&sort=...&limit=...
function parseListParams(req) {
  let query = {};
  if (req.query.q) {
    try { query = JSON.parse(req.query.q); } catch { query = {}; }
  }
  const sort = req.query.sort || null;
  const limit = req.query.limit != null ? asInt(req.query.limit) : null;
  return { query, sort, limit };
}

function handleError(res, e) {
  const status = e?.status || 500;
  res.status(status).json({ error: e?.message || 'Internal error' });
}

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(publicUser(user));
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = authenticate(email, password);
    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ access_token: token, user: publicUser(user) });
  } catch (e) { handleError(res, e); }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = registerUser({ email, password, full_name, phone, role: 'customer' });
    // Issue a real verification code and email it. Email send is best-effort
    // (never blocks signup), but the code is required to obtain a session.
    const code = issueOtp(user.id);
    if (process.env.MINIYO_OTP_DEBUG === '1') console.log(`[otp:register] ${user.email} -> ${code}`);
    sendEmail({
      to: user.email,
      subject: 'Your Trending Store verification code',
      html: otpEmailHtml(code),
      email_type: 'otp_verification',
      customer_id: user.id,
      trigger_event: 'register',
    }).catch(() => {});
    res.json({ ok: true, email: user.email, requires_otp: true });
  } catch (e) { handleError(res, e); }
});

// Verify the emailed OTP code. Only issues a session on a correct, unexpired code.
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { email, otpCode } = req.body || {};
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const result = verifyOtpCode(user.id, otpCode);
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    const fresh = getRecord('User', user.id);
    const token = signToken(user.id);
    setSessionCookie(res, token);
    // Best-effort welcome email after first verification.
    invokeFunction('sendWelcomeEmailNew', {
      customer_id: fresh.id, email: fresh.email, full_name: fresh.full_name,
    }).catch(() => {});
    res.json({ access_token: token, user: publicUser(fresh) });
  } catch (e) { handleError(res, e); }
});

// Regenerate and re-email a verification code.
app.post('/api/auth/resend-otp', (req, res) => {
  try {
    const { email } = req.body || {};
    const user = findUserByEmail(email);
    // Do not reveal whether the account exists.
    if (user && !user.email_verified) {
      const code = issueOtp(user.id);
      if (process.env.MINIYO_OTP_DEBUG === '1') console.log(`[otp:resend] ${user.email} -> ${code}`);
      sendEmail({
        to: user.email,
        subject: 'Your Trending Store verification code',
        html: otpEmailHtml(code),
        email_type: 'otp_verification',
        customer_id: user.id,
        trigger_event: 'resend_otp',
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/update-me', (req, res) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const updated = updateUser(user.id, req.body || {});
    res.json(publicUser(updated));
  } catch (e) { handleError(res, e); }
});

app.post('/api/auth/change-password', (req, res) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    changePassword(user.id, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
});

app.post('/api/auth/reset-password-request', (req, res) => {
  // No external mail dependency required; always succeed (token surfaced for self-host).
  try {
    const { email } = req.body || {};
    const user = findUserByEmail(email);
    res.json({ ok: true, reset_token: user ? signToken(user.id) : null });
  } catch (e) { handleError(res, e); }
});

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { resetToken, newPassword } = req.body || {};
    const payload = resetToken
      ? (() => { try { return JSON.parse(Buffer.from(resetToken.split('.')[1], 'base64').toString()); } catch { return null; } })()
      : null;
    if (!payload?.sub) return res.status(400).json({ error: 'Invalid or expired reset token' });
    setPassword(payload.sub, newPassword);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
});

// ─── User invite (admin) ────────────────────────────────────────────────────
app.post('/api/users/invite', (req, res) => {
  try {
    const actor = getUserFromRequest(req);
    if (!actor || !['admin', 'super_admin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { email, role = 'staff' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const VALID_INVITE_ROLES = ['customer', 'staff', 'admin', 'super_admin'];
    if (!VALID_INVITE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    // A regular admin may only invite/assign staff (or customer). Granting
    // admin or super_admin requires super_admin. This mirrors the central
    // RBAC guard so privilege escalation can't happen via the invite path.
    const elevated = role === 'admin' || role === 'super_admin';
    if (elevated && actor.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: only a super admin can grant admin or super admin roles' });
    }
    let user = findUserByEmail(email);
    if (!user) {
      const tempPassword = crypto.randomUUID();
      user = registerUser({ email, password: tempPassword, role });
    } else {
      user = updateRecord('User', user.id, { role });
    }
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) { handleError(res, e); }
});

// ─── Functions ────────────────────────────────────────────────────────────────
app.post('/api/functions/:name', async (req, res) => {
  try {
    const user = getUserFromRequest(req);
    const result = await invokeFunction(req.params.name, req.body || {}, user);
    if (result && typeof result === 'object' && result._status) {
      const { _status, ...rest } = result;
      return res.status(_status).json({ data: rest });
    }
    res.json({ data: result });
  } catch (e) { handleError(res, e); }
});

// ─── File upload (base64 JSON) ──────────────────────────────────────────────
// Accepts { file } where file is a base64 string or data URL. Every upload flows
// through optimizeAndStore(): sharp compresses + resizes to WebP variants which
// are written to R2 (when configured) or local disk. Returns the canonical
// `file_url` (back-compat) plus `url`, `variants`, and framing metadata so the
// frontend can request the right derivative and Cloudflare-resize it.
app.post('/api/upload', async (req, res) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { file, filename } = req.body || {};
    if (!file) return res.status(400).json({ error: 'file required' });
    let ext = '';
    const mimeMatch = String(file).match(/^data:([^;,]+)[;,]/);
    if (mimeMatch) {
      const sub = mimeMatch[1].split('/')[1];
      if (sub) ext = '.' + sub.replace(/[^a-zA-Z0-9]/g, '');
    }
    const safeName = (filename || `upload${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const buffer = bufferFromBase64(String(file));
    const descriptor = await optimizeAndStore(buffer, safeName);
    // file_url stays the canonical (card) URL so existing callers keep working.
    res.json({ file_url: descriptor.url, ...descriptor });
  } catch (e) { handleError(res, e); }
});

// ─── Entity CRUD ────────────────────────────────────────────────────────────
function ensureEntity(req, res, next) {
  if (!ENTITIES.includes(req.params.entity)) {
    return res.status(404).json({ error: `Unknown entity: ${req.params.entity}` });
  }
  next();
}

// Write authorization for the generic entity CRUD surface.
//
// Reads stay public (the storefront is a public catalog). Writes are admin-only
// by default; without this gate ANY anonymous client could create/modify/delete
// products, prices, discounts, orders, etc. directly against the API.
//
// The storefront legitimately performs a small set of writes as an
// unauthenticated guest (checkout). Those — and only those — are allowed per
// (entity, operation) below. Everything else requires an admin session.
const isAdmin = (user) => !!user && (user.role === 'admin' || user.role === 'super_admin');

// Entity → operations a non-admin (guest/customer) may perform.
const PUBLIC_WRITES = {
  Order: ['create'],          // guest checkout
  Coupon: ['update'],         // checkout increments usage_count only
};

function authorizeWrite(op) {
  return (req, res, next) => {
    const user = getUserFromRequest(req);
    if (isAdmin(user)) return next();
    if (PUBLIC_WRITES[req.params.entity]?.includes(op)) return next();
    return res.status(user ? 403 : 401).json({
      error: user ? 'Forbidden: admin access required' : 'Authentication required',
    });
  };
}

// Read authorization for the generic entity read surface.
//
// Most reads are public (the storefront is a public catalog: Product, Category,
// Banner, SiteSettings, Testimonial, Coupon, Discount, CmsSection, Faq). But a
// handful of entities carry customer PII (name/phone/address/email) or internal
// business/audit data and must NEVER be readable anonymously. The storefront
// never reads these unauthenticated: orders are placed via POST (guest checkout)
// and the confirmation/receipt is rendered client-side from the submitted cart —
// there is no guest order read-back — while customers and logs are admin-only
// screens. So we require an admin-tier session to list or read any of them.
const READ_PROTECTED = new Set(['Order', 'Customer', 'EmailLog', 'AuditLog', 'User', 'CustomerAddress', 'StockMovement']);

function authorizeRead(req, res, next) {
  if (!READ_PROTECTED.has(req.params.entity)) return next();
  const user = getUserFromRequest(req);
  if (isAdmin(user)) return next();
  return res.status(user ? 403 : 401).json({
    error: user ? 'Forbidden: admin access required' : 'Authentication required',
  });
}

// Never expose User credential-bearing fields through generic CRUD.
function sanitize(entity, record) {
  if (entity === 'User' && record) {
    const { password_hash, otp_hash, ...rest } = record;
    return rest;
  }
  return record;
}

// Internal money/revenue/cost fields that must never reach a non-super_admin
// reader through the generic entity read path. Public selling prices are
// intentionally EXCLUDED — Product.price/compare_at_price and Coupon.value are
// storefront-facing and the catalog/checkout depend on them. We only redact
// internal figures: order revenue, internal product cost, and derived customer
// lifetime value. The buyer still gets full totals from Order.create (the POST
// path), and there is no customer self-service order list to break.
const REDACTED_MONEY_FIELDS = {
  Order: ['subtotal', 'discount', 'delivery_fee', 'total', 'grand_total', 'grand_total_usd', 'shipping_cost', 'tax'],
  Product: ['cost', 'cost_price', 'cost_usd'],
  Customer: ['total_spent', 'total_spent_usd', 'aov'],
};

function redactMoney(entity, record, user) {
  if (!record || isSuperAdmin(user)) return record;
  const fields = REDACTED_MONEY_FIELDS[entity];
  if (!fields) return record;
  const out = { ...record };
  for (const f of fields) delete out[f];
  // Order line items embed a per-unit selling price that reveals order value.
  if (entity === 'Order' && Array.isArray(out.items)) {
    out.items = out.items.map((it) => {
      if (it && typeof it === 'object') { const { price, ...rest } = it; return rest; }
      return it;
    });
  }
  return out;
}

// Hidden price markup: for NON-admin (storefront/customer) readers, prices are
// returned marked-up so every surface — listing, product page, cart, checkout —
// shows the final price consistently. Admins read BASE prices so the product
// editor keeps editing true base values (markup stays reversible). Applies to
// the product price, compare-at price, and each size/tier price.
function applyProductMarkupForReader(product, user) {
  if (!product || isAdmin(user)) return product;
  const pct = markupPctForProduct(product, getGlobalMarkupPct());
  if (!pct) { const { markup_pct: _omit, ...rest } = product; return rest; }
  const out = { ...product };
  delete out.markup_pct;
  if (out.price != null) out.price = applyMarkup(out.price, pct);
  if (out.compare_at_price != null) out.compare_at_price = applyMarkup(out.compare_at_price, pct);
  if (Array.isArray(out.sizes)) {
    out.sizes = out.sizes.map((s) => (s && s.price != null ? { ...s, price: applyMarkup(s.price, pct) } : s));
  }
  if (Array.isArray(out.tiers)) {
    out.tiers = out.tiers.map((t) => (t && t.total_price != null ? { ...t, total_price: applyMarkup(t.total_price, pct) } : t));
  }
  return out;
}

app.get('/api/entities/:entity', ensureEntity, authorizeRead, (req, res) => {
  try {
    const user = getUserFromRequest(req);
    const { query, sort, limit } = parseListParams(req);
    const isProduct = req.params.entity === 'Product';
    const records = queryRecords(req.params.entity, { query, sort, limit })
      .map((r) => redactMoney(req.params.entity, sanitize(req.params.entity, r), user))
      .map((r) => (isProduct ? applyProductMarkupForReader(r, user) : r));
    res.json(records);
  } catch (e) { handleError(res, e); }
});

app.get('/api/entities/:entity/:id', ensureEntity, authorizeRead, (req, res) => {
  try {
    const user = getUserFromRequest(req);
    const record = getRecord(req.params.entity, req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    let out = redactMoney(req.params.entity, sanitize(req.params.entity, record), user);
    if (req.params.entity === 'Product') out = applyProductMarkupForReader(out, user);
    res.json(out);
  } catch (e) { handleError(res, e); }
});

// Defensively clamp product stock/price so a bad admin payload can never store a
// negative stock (which would corrupt the ledger balance) or a negative price.
// The admin UI validates first; this is the server-side backstop.
function sanitizeProductWrite(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  const clampNonNeg = (v) => {
    if (v == null || v === '') return v;
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return n < 0 ? 0 : n;
  };
  if (out.stock_quantity !== undefined) out.stock_quantity = clampNonNeg(out.stock_quantity);
  if (out.price !== undefined) out.price = clampNonNeg(out.price);
  if (out.compare_at_price !== undefined) out.compare_at_price = clampNonNeg(out.compare_at_price);
  if (Array.isArray(out.sizes)) {
    out.sizes = out.sizes.map((s) => (s && typeof s === 'object'
      ? { ...s, stock_quantity: clampNonNeg(s.stock_quantity), price: clampNonNeg(s.price) }
      : s));
  }
  return out;
}

function actorLabel(req) {
  const u = getUserFromRequest(req);
  return u?.full_name || u?.email || 'admin';
}

app.post('/api/entities/:entity', ensureEntity, authorizeWrite('create'), (req, res) => {
  try {
    let payload = req.body || {};
    // Orders: recompute every price server-side (size + tier + markup) and the
    // delivery/total, so a tampered client can never dictate what it pays.
    if (req.params.entity === 'Order') payload = recomputeOrder(payload);
    if (req.params.entity === 'Product') payload = sanitizeProductWrite(payload);
    const record = createRecord(req.params.entity, payload);
    // Ledger: initial stock for a new product.
    if (req.params.entity === 'Product') {
      recordManualStockAdjustments(null, record, actorLabel(req));
    }
    res.json(sanitize(req.params.entity, record));
  } catch (e) { handleError(res, e); }
});

app.put('/api/entities/:entity/:id', ensureEntity, authorizeWrite('update'), (req, res) => {
  try {
    const isProduct = req.params.entity === 'Product';
    const before = isProduct ? getRecord('Product', req.params.id) : null;
    const patch = isProduct ? sanitizeProductWrite(req.body || {}) : (req.body || {});
    const record = updateRecord(req.params.entity, req.params.id, patch);
    // Ledger: log admin stock edits (top-level + per size) as manual_adjust.
    if (isProduct) recordManualStockAdjustments(before, record, actorLabel(req));
    res.json(sanitize(req.params.entity, record));
  } catch (e) { handleError(res, e); }
});

app.delete('/api/entities/:entity/:id', ensureEntity, authorizeWrite('delete'), (req, res) => {
  try {
    res.json(deleteRecord(req.params.entity, req.params.id));
  } catch (e) { handleError(res, e); }
});

app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Meta product catalog feed (public) ──────────────────────────────────────
// A standard CSV product feed for Meta Commerce Manager / Advantage+ catalogs.
// `id` is the normalized (uppercase+trim) product identifier — IDENTICAL to the
// content_ids sent by the Pixel + CAPI so catalog matching works. Prices are
// markup-inclusive (what customers actually pay). No auth: catalog feeds must be
// publicly fetchable by Meta's crawler.
function csvCell(value) {
  const s = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${s}"`;
}

app.get('/meta-feed.csv', (req, res) => {
  try {
    const globalPct = getGlobalMarkupPct();
    const products = queryRecords('Product', { query: { status: 'active' }, limit: 10000 });
    const base = `${req.protocol}://${req.get('host')}`;
    const columns = [
      'id', 'title', 'description', 'availability', 'condition',
      'price', 'sale_price', 'link', 'image_link', 'brand',
    ];
    const rows = [columns.join(',')];
    for (const p of products) {
      const id = productContentId(p);
      if (!id) continue;
      const pct = markupPctForProduct(p, globalPct);
      const sell = applyMarkup(Number(p.price) || 0, pct);
      const compare = p.compare_at_price != null ? applyMarkup(Number(p.compare_at_price) || 0, pct) : null;
      // Meta convention: `price` is the regular price, `sale_price` the reduced
      // one. When a compare-at price is higher, expose it as the regular price.
      const onSale = compare != null && compare > sell;
      const regular = onSale ? compare : sell;
      const salePrice = onSale ? sell : '';
      const inStock = p.stock_quantity == null || Number(p.stock_quantity) > 0;
      const title = p.name || p.name_ar || id;
      const description = p.short_description || p.short_description_ar || title;
      const image = p.image_url || '';
      const link = `${base}/product/${p.id}`;
      rows.push([
        csvCell(id),
        csvCell(title),
        csvCell(description),
        csvCell(inStock ? 'in stock' : 'out of stock'),
        csvCell('new'),
        csvCell(`${regular} ${META_CURRENCY}`),
        csvCell(salePrice === '' ? '' : `${salePrice} ${META_CURRENCY}`),
        csvCell(link),
        csvCell(image),
        csvCell('Trending Store'),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="meta-feed.csv"');
    res.send(rows.join('\n'));
  } catch (e) { handleError(res, e); }
});

// ─── Serve SPA with history fallback ──────────────────────────────────────────
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).send('Backend running. Build the frontend with `npm run build` to serve the SPA.');
  });
}

// Bind to 0.0.0.0 so the platform router (Railway/Render/etc.) can reach the app.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trending Store server listening on 0.0.0.0:${PORT}`);
});
