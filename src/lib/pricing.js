// Shared, pure pricing + inventory logic used by BOTH the storefront (React)
// and the Express backend. No IO, no browser/node-only APIs — so it can be
// imported from src, from server/, and from the test runner.
//
// Concepts (all additive & backward compatible):
//   • Sizes  — product.sizes = [{ id?, label, label_ar, price, stock_quantity }].
//              Each size has its OWN price and its OWN stock pool. A product
//              with no sizes keeps using product.price / product.stock_quantity.
//   • Tiers  — product.tiers = [{ min_quantity, total_price, label, label_ar,
//              free_shipping? }]. A tier's total_price is the ABSOLUTE total for
//              that bundle (e.g. "3 pcs — $25" means $25 total for 3 units), not
//              a per-unit price. Tiers are optional.
//   • Markup — a hidden, reversible percentage applied on top of base/size/tier
//              prices. Effective pct = product.markup_pct (per-product override)
//              when set, otherwise the store-wide global pct. Base prices are
//              never mutated, so markup is fully reversible.

function num(v) {
  // Treat null / undefined / '' as "absent" (null) rather than 0 — Number(null)
  // and Number('') are both 0, which would otherwise turn an unset markup or
  // untracked stock into a real 0 and change behavior.
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ── Markup ──────────────────────────────────────────────────────────────────
// Effective markup percentage for a product given the store-wide global pct.
// A per-product override (product.markup_pct) wins when it is a finite number.
export function markupPctForProduct(product, globalPct = 0) {
  const override = num(product?.markup_pct);
  if (override != null) return override;
  const g = num(globalPct);
  return g != null ? g : 0;
}

// Apply a percentage markup to a monetary amount. 0% (or invalid) is a no-op.
export function applyMarkup(amount, pct) {
  const base = num(amount);
  if (base == null) return amount;
  const p = num(pct) || 0;
  if (!p) return round2(base);
  return round2(base * (1 + p / 100));
}

// ── Sizes ─────────────────────────────────────────────────────────────────--
export function getSizes(product) {
  const arr = Array.isArray(product?.sizes) ? product.sizes : [];
  return arr.filter((s) => s && (s.label || s.label_ar || s.id != null));
}

export function sizeId(size) {
  return String(size?.id ?? size?.label ?? size?.label_ar ?? '');
}

export function findSize(product, key) {
  if (key == null || key === '') return null;
  return getSizes(product).find((s) => sizeId(s) === String(key)) || null;
}

// Base (pre-markup) unit price for a product, honoring the selected size.
export function baseUnitPrice(product, size) {
  if (size) {
    const sp = num(size.price);
    if (sp != null) return sp;
  }
  return num(product?.price) || 0;
}

// ── Tiers / quantity offers ──────────────────────────────────────────────────
// Offers/tiers can be defined PER SIZE (size.offers) — the primary model — or
// PER PRODUCT (product.tiers) as a backward-compatible fallback. Both use the
// same shape: { min_quantity, total_price, label, label_ar, free_shipping }.
//
// Resolution rule: when a size is selected AND that size has its own (non-empty)
// offers list, use ONLY that size's offers. Otherwise fall back to the
// product-level tiers (existing behavior). This keeps products with legacy
// product-level offers working while new/edited products drive offers per size.
export function getTiers(product, size = null) {
  const sizeOffers = Array.isArray(size?.offers) ? size.offers : null;
  const arr = sizeOffers && sizeOffers.length
    ? sizeOffers
    : (Array.isArray(product?.tiers) ? product.tiers : []);
  return arr
    .filter((t) => t && num(t.min_quantity) != null && num(t.min_quantity) > 0)
    .slice()
    .sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity));
}

// The applicable tier for a chosen quantity = the highest min_quantity <= qty.
export function resolveTier(product, quantity, size = null) {
  const q = num(quantity) || 0;
  let match = null;
  for (const t of getTiers(product, size)) {
    if (q >= Number(t.min_quantity)) match = t;
  }
  return match;
}

// Find a specific tier by its min_quantity (used when the customer picks a
// concrete offer from the dropdown).
export function findTierByMin(product, minQuantity, size = null) {
  const m = num(minQuantity);
  if (m == null) return null;
  return getTiers(product, size).find((t) => Number(t.min_quantity) === m) || null;
}

// ── Core resolution ──────────────────────────────────────────────────────────
// Resolve a single line item from BASE product data + a customer selection,
// then apply markup. This is the single source of truth used by the storefront
// (live price preview) and the server (authoritative recompute at checkout).
//
// selection: { size_id?, quantity?, offer_min_quantity?, offer_quantity? }
//   offer_quantity — how many copies of the chosen bundle offer to buy (the
//   bundle multiplier). Defaults to 1. Only meaningful when an offer is chosen;
//   e.g. offer_min_quantity=5 with offer_quantity=2 → 10 pieces at 2× the
//   bundle price. Ignored for single-unit (no offer) purchases, which keep
//   using `quantity`.
// Returns a fully-resolved, markup-inclusive line descriptor.
export function resolveLineItem(product, selection = {}, globalPct = 0) {
  const size = findSize(product, selection.size_id);
  const markupPct = markupPctForProduct(product, globalPct);
  const unitBase = baseUnitPrice(product, size);

  // An explicitly chosen offer fixes the per-bundle quantity to the tier's
  // bundle size, multiplied by how many bundles the customer buys. Offers
  // resolve against the SELECTED SIZE first (per-size offers), falling back to
  // product-level tiers when the size has none.
  let tier = null;
  if (selection.offer_min_quantity != null && selection.offer_min_quantity !== '') {
    tier = findTierByMin(product, selection.offer_min_quantity, size);
  }

  let quantity;
  let baseLineTotal;
  if (tier) {
    // Whole-bundle purchase: `bundles` copies of this exact offer. Prefer an
    // explicit offer_quantity (the product page's bundle stepper); otherwise
    // derive it from the piece quantity so a stored order line — which persists
    // quantity in PIECES — recomputes to the same total on the server.
    const min = Number(tier.min_quantity);
    let bundles = num(selection.offer_quantity);
    if (bundles == null) {
      const q = num(selection.quantity);
      bundles = q != null && min > 0 ? q / min : 1;
    }
    bundles = Math.max(1, Math.floor(bundles));
    quantity = min * bundles;
    const tierTotal = num(tier.total_price);
    baseLineTotal = tierTotal != null ? tierTotal * bundles : unitBase * quantity;
  } else {
    // No explicit offer → plain quantity, auto-resolving a tier it may cross.
    quantity = Math.max(1, Math.floor(num(selection.quantity) || 1));
    tier = resolveTier(product, quantity, size);
    const tierTotal = tier ? num(tier.total_price) : null;
    if (tier && tierTotal != null) {
      baseLineTotal = quantity === Number(tier.min_quantity)
        ? tierTotal // Exact bundle → the tier's absolute total price.
        : (tierTotal / Number(tier.min_quantity)) * quantity; // per-unit-equivalent
    } else {
      baseLineTotal = unitBase * quantity;
    }
  }
  baseLineTotal = round2(baseLineTotal);

  const lineTotal = applyMarkup(baseLineTotal, markupPct);
  const unitPrice = round2(lineTotal / quantity);
  const baseUnit = round2(baseLineTotal / quantity);

  return {
    quantity,
    unit_price: unitPrice,          // markup-inclusive per-unit price
    line_total: lineTotal,          // markup-inclusive line total
    base_unit_price: baseUnit,      // pre-markup per-unit
    base_line_total: baseLineTotal, // pre-markup total
    markup_pct: markupPct,
    size_id: size ? sizeId(size) : '',
    size_label: size?.label || '',
    size_label_ar: size?.label_ar || '',
    tier_min_quantity: tier ? Number(tier.min_quantity) : null,
    tier_label: tier?.label || '',
    tier_label_ar: tier?.label_ar || '',
    free_shipping: !!(tier && tier.free_shipping),
  };
}

// Build the list of purchasable offers for a product page dropdown. Always
// includes a single-unit option first (using the size/base price), followed by
// any defined tiers. Prices are markup-inclusive so the UI can render them
// directly.
export function buildOfferOptions(product, size, globalPct = 0) {
  const markupPct = markupPctForProduct(product, globalPct);
  const unit = applyMarkup(baseUnitPrice(product, size), markupPct);
  const options = [{
    key: 'single',
    min_quantity: 1,
    quantity: 1,
    total_price: unit,
    unit_price: unit,
    label: '',
    label_ar: '',
    free_shipping: false,
  }];
  for (const t of getTiers(product, size)) {
    const q = Number(t.min_quantity);
    const tierTotal = num(t.total_price);
    const total = tierTotal != null ? applyMarkup(tierTotal, markupPct) : round2(unit * q);
    options.push({
      key: `tier-${q}`,
      min_quantity: q,
      quantity: q,
      total_price: total,
      unit_price: round2(total / q),
      label: t.label || '',
      label_ar: t.label_ar || '',
      free_shipping: !!t.free_shipping,
    });
  }
  return options;
}

// ── Manual (admin-created) order pricing ─────────────────────────────────────
// A manually-created admin order gives the operator full control over pricing:
// per-line unit prices (already resolved/overridden in the UI), an order-level
// discount (fixed $ OR percent %), an editable delivery fee, and an optional
// final-total override. These pure helpers are the single source of truth for
// that math, reused by the admin form (live preview) and the server (persisted
// authoritative total). They intentionally trust the supplied line prices —
// unlike resolveLineItem, which re-derives prices from catalog data.

// Discount amount for a subtotal given a type ('fixed' | 'percent') and value.
// Always clamped to [0, subtotal] so a discount can never exceed the subtotal
// or go negative. A percent is (value% of subtotal); anything else is a flat $.
export function orderDiscountAmount(subtotal, type, value) {
  const sub = Math.max(0, num(subtotal) || 0);
  const v = Math.max(0, num(value) || 0);
  const raw = type === 'percent' ? sub * (v / 100) : v;
  return round2(Math.min(sub, raw));
}

// Compute the full set of persisted totals for a manual order from its line
// items and adjustment fields. `items` use their supplied `price` × `quantity`
// (no catalog re-derivation). Returns subtotal, the resolved discount amount,
// the (non-negative) delivery fee, and the final total. When `total_override`
// is true and `total` is a finite number, that admin-entered total is used
// verbatim (clamped to ≥ 0); otherwise total = subtotal − discount + delivery.
export function computeManualOrderTotals({
  items = [],
  discount_type = 'fixed',
  discount_value = 0,
  delivery_fee = 0,
  total_override = false,
  total = null,
} = {}) {
  let subtotal = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const qty = Math.max(0, Math.floor(num(it?.quantity) || 0));
    const price = Math.max(0, num(it?.price) || 0);
    subtotal += price * qty;
  }
  subtotal = round2(subtotal);
  const discount = orderDiscountAmount(subtotal, discount_type, discount_value);
  const fee = Math.max(0, num(delivery_fee) || 0);
  const autoTotal = round2(Math.max(0, subtotal - discount) + fee);
  const overrideVal = num(total);
  const finalTotal = total_override && overrideVal != null
    ? round2(Math.max(0, overrideVal))
    : autoTotal;
  return {
    subtotal,
    discount: round2(discount),
    delivery_fee: round2(fee),
    auto_total: autoTotal,
    total: finalTotal,
  };
}

// ── Free delivery ─────────────────────────────────────────────────────────--
// A cart qualifies for free delivery when ANY line is flagged free_delivery
// (product-level) or free_shipping (a bundle offer).
export function cartHasFreeDelivery(items = []) {
  return (Array.isArray(items) ? items : []).some(
    (it) => it && (it.free_delivery || it.free_shipping)
  );
}

// ── Availability (pure) ──────────────────────────────────────────────────────
// Single source of truth for "is this in stock?", used by the card, the detail
// page and (optionally) the server. The rule is robust to the per-size stock
// model introduced by PRs #11/#14:
//
//   • If a specific size is passed → that size is in stock when its stock is
//     untracked (null) or > 0.
//   • Else if the product HAS sizes → in stock when ANY size is in stock.
//   • Else (simple product, no sizes) → in stock when product.stock_quantity is
//     untracked (null) or > 0.
//
// "Untracked" (null/'' → num() returns null) means the admin left stock blank,
// which the app treats as available (consistent with decrementStockPatch and the
// inventory screens). A real numeric 0 is out of stock. Strings coerce via num().
export function sizeInStock(size) {
  const q = num(size?.stock_quantity);
  return q == null ? true : q > 0;
}

export function isInStock(product, size = null) {
  if (size) return sizeInStock(size);
  const sizes = getSizes(product);
  if (sizes.length > 0) return sizes.some(sizeInStock);
  const q = num(product?.stock_quantity);
  return q == null ? true : q > 0;
}

// Total tracked stock across the per-size model, for admin "low stock" widgets.
//   • With sizes → the SUM of tracked size stocks (untracked sizes contribute
//     nothing); returns null only when every size is untracked.
//   • Without sizes → the product-level stock_quantity (null when untracked).
// Returning null means "untracked" (not a real 0), so low-stock screens can skip
// it — the same convention isInStock uses.
export function totalStock(product) {
  const sizes = getSizes(product);
  if (sizes.length > 0) {
    let sum = null;
    for (const s of sizes) {
      const q = num(s.stock_quantity);
      if (q != null) sum = (sum || 0) + q;
    }
    return sum;
  }
  return num(product?.stock_quantity);
}

// ── Unit name (pure) ─────────────────────────────────────────────────────────
// The customer-facing name for a single unit ("pc"/"قطعة" by default). Products
// may override it per language (unit_name_en / unit_name_ar) to read "pack",
// "pair", "علبة", etc. Either language falls back to the other, then to the
// hardcoded default, so products without the field render exactly as before.
export function unitLabels(product) {
  const en = String(product?.unit_name_en ?? '').trim();
  const ar = String(product?.unit_name_ar ?? '').trim();
  return { en: en || ar || 'pc', ar: ar || en || 'قطعة' };
}

// ── Per-size stock helpers (pure) ────────────────────────────────────────────
// Compute the product patch needed to DECREMENT stock for one order line. When
// the line targets a size, that size's pool is drawn down (clamped at 0);
// otherwise the top-level stock_quantity is used. Returns null when the product
// has no tracked stock for the target (nothing to change).
export function decrementStockPatch(product, sizeKey, quantity) {
  const qty = Math.max(0, Math.floor(num(quantity) || 0));
  if (!qty) return null;
  const size = findSize(product, sizeKey);
  if (size) {
    const sizes = getSizes(product).map((s) => {
      if (sizeId(s) !== sizeId(size)) return s;
      const cur = num(s.stock_quantity);
      if (cur == null) return s; // untracked size stock → leave as-is
      return { ...s, stock_quantity: Math.max(0, cur - qty) };
    });
    return { sizes };
  }
  const cur = num(product?.stock_quantity);
  if (cur == null) return null;
  return { stock_quantity: Math.max(0, cur - qty) };
}

// Mirror of decrementStockPatch used when RESTOCKING (order cancellation).
export function restockStockPatch(product, sizeKey, quantity) {
  const qty = Math.max(0, Math.floor(num(quantity) || 0));
  if (!qty) return null;
  const size = findSize(product, sizeKey);
  if (size) {
    const sizes = getSizes(product).map((s) => {
      if (sizeId(s) !== sizeId(size)) return s;
      const cur = num(s.stock_quantity) || 0;
      return { ...s, stock_quantity: cur + qty };
    });
    return { sizes };
  }
  const cur = num(product?.stock_quantity);
  if (cur == null) return null;
  return { stock_quantity: cur + qty };
}

// ── Reservations (reserve-at-placement) ──────────────────────────────────────
// A parallel `qty_reserved` counter lives alongside each stock pool: on every
// size sub-object for products with sizes, and at the product top level for
// sizeless products. Availability = stock_quantity − qty_reserved at the
// matching granularity. An UNTRACKED pool (stock_quantity null/'' → num()===null)
// is treated as unlimited, so it never blocks and carries no reservation.

// Reserved count for a stock pool (size object or product), clamped to ≥ 0.
export function getReserved(poolOwner) {
  const r = num(poolOwner?.qty_reserved);
  return r == null ? 0 : Math.max(0, r);
}

// Available (sellable) quantity accounting for held reservations. Returns null
// when the pool is untracked (unlimited). When no size is selected on a sized
// product, sums the tracked availability across all its sizes.
export function availableStock(product, sizeKey) {
  const size = findSize(product, sizeKey);
  if (size) {
    const q = num(size.stock_quantity);
    if (q == null) return null;
    return Math.max(0, q - getReserved(size));
  }
  const sizes = getSizes(product);
  if (sizes.length > 0) {
    let sum = null;
    for (const s of sizes) {
      const q = num(s.stock_quantity);
      if (q != null) sum = (sum || 0) + Math.max(0, q - getReserved(s));
    }
    return sum;
  }
  const q = num(product?.stock_quantity);
  if (q == null) return null;
  return Math.max(0, q - getReserved(product));
}

// Compute the check-and-reserve patch for ONE order line. Returns a descriptor:
//   { ok, patch, available, requested, balance }
// `ok` is false (and patch null) ONLY when the target pool is tracked and its
// availability is below the requested qty — the caller rejects the placement.
// An untracked pool always succeeds with a null patch (nothing to hold).
// `balance` is the availability AFTER a successful reserve (for the ledger).
export function reserveStockPatch(product, sizeKey, quantity) {
  const qty = Math.max(0, Math.floor(num(quantity) || 0));
  if (!qty) return { ok: true, patch: null, available: null, requested: 0, balance: null };
  const size = findSize(product, sizeKey);
  if (size) {
    const cur = num(size.stock_quantity);
    if (cur == null) return { ok: true, patch: null, available: null, requested: qty, balance: null };
    const reserved = getReserved(size);
    const available = Math.max(0, cur - reserved);
    if (available < qty) return { ok: false, patch: null, available, requested: qty, balance: available };
    const sizes = getSizes(product).map((s) => (
      sizeId(s) !== sizeId(size) ? s : { ...s, qty_reserved: reserved + qty }
    ));
    return { ok: true, patch: { sizes }, available, requested: qty, balance: available - qty };
  }
  const cur = num(product?.stock_quantity);
  if (cur == null) return { ok: true, patch: null, available: null, requested: qty, balance: null };
  const reserved = getReserved(product);
  const available = Math.max(0, cur - reserved);
  if (available < qty) return { ok: false, patch: null, available, requested: qty, balance: available };
  return { ok: true, patch: { qty_reserved: reserved + qty }, available, requested: qty, balance: available - qty };
}

// Release a hold (cancellation BEFORE commit): qty_reserved −= qty (clamped at
// 0). Returns null when there is nothing reserved to release. `balance` on the
// returned object is the availability after release.
export function releaseReservationPatch(product, sizeKey, quantity) {
  const qty = Math.max(0, Math.floor(num(quantity) || 0));
  if (!qty) return null;
  const size = findSize(product, sizeKey);
  if (size) {
    const reserved = getReserved(size);
    if (reserved <= 0) return null;
    const cur = num(size.stock_quantity);
    const newReserved = Math.max(0, reserved - qty);
    const sizes = getSizes(product).map((s) => (
      sizeId(s) !== sizeId(size) ? s : { ...s, qty_reserved: newReserved }
    ));
    const balance = cur == null ? null : Math.max(0, cur - newReserved);
    return { patch: { sizes }, balance };
  }
  const reserved = getReserved(product);
  if (reserved <= 0) return null;
  const cur = num(product?.stock_quantity);
  const newReserved = Math.max(0, reserved - qty);
  const balance = cur == null ? null : Math.max(0, cur - newReserved);
  return { patch: { qty_reserved: newReserved }, balance };
}

// Convert a hold into a sale (CONFIRMATION): decrement on-hand stock_quantity AND
// qty_reserved together so `available` is unchanged at this step (the unit moves
// from reserved to gone). Untracked on-hand stays untracked. `balance` is the
// resulting on-hand quantity (mirrors the 'sale' ledger balance semantics).
export function commitReservedStockPatch(product, sizeKey, quantity) {
  const qty = Math.max(0, Math.floor(num(quantity) || 0));
  if (!qty) return null;
  const size = findSize(product, sizeKey);
  if (size) {
    const cur = num(size.stock_quantity);
    const reserved = getReserved(size);
    const newReserved = Math.max(0, reserved - qty);
    const newStock = cur == null ? null : Math.max(0, cur - qty);
    const sizes = getSizes(product).map((s) => {
      if (sizeId(s) !== sizeId(size)) return s;
      const ns = { ...s, qty_reserved: newReserved };
      if (newStock != null) ns.stock_quantity = newStock;
      return ns;
    });
    return { patch: { sizes }, balance: newStock };
  }
  const cur = num(product?.stock_quantity);
  const reserved = getReserved(product);
  const newReserved = Math.max(0, reserved - qty);
  const patch = { qty_reserved: newReserved };
  let balance = null;
  if (cur != null) { patch.stock_quantity = Math.max(0, cur - qty); balance = patch.stock_quantity; }
  return { patch, balance };
}
