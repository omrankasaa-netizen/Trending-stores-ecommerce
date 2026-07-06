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
export function getTiers(product) {
  const arr = Array.isArray(product?.tiers) ? product.tiers : [];
  return arr
    .filter((t) => t && num(t.min_quantity) != null && num(t.min_quantity) > 0)
    .slice()
    .sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity));
}

// The applicable tier for a chosen quantity = the highest min_quantity <= qty.
export function resolveTier(product, quantity) {
  const q = num(quantity) || 0;
  let match = null;
  for (const t of getTiers(product)) {
    if (q >= Number(t.min_quantity)) match = t;
  }
  return match;
}

// Find a specific tier by its min_quantity (used when the customer picks a
// concrete offer from the dropdown).
export function findTierByMin(product, minQuantity) {
  const m = num(minQuantity);
  if (m == null) return null;
  return getTiers(product).find((t) => Number(t.min_quantity) === m) || null;
}

// ── Core resolution ──────────────────────────────────────────────────────────
// Resolve a single line item from BASE product data + a customer selection,
// then apply markup. This is the single source of truth used by the storefront
// (live price preview) and the server (authoritative recompute at checkout).
//
// selection: { size_id?, quantity?, offer_min_quantity? }
// Returns a fully-resolved, markup-inclusive line descriptor.
export function resolveLineItem(product, selection = {}, globalPct = 0) {
  const size = findSize(product, selection.size_id);
  const markupPct = markupPctForProduct(product, globalPct);

  // An explicitly chosen offer fixes the quantity to the tier's bundle size.
  let tier = null;
  if (selection.offer_min_quantity != null && selection.offer_min_quantity !== '') {
    tier = findTierByMin(product, selection.offer_min_quantity);
  }
  let quantity = Math.max(1, Math.floor(num(selection.quantity) || (tier ? Number(tier.min_quantity) : 1)));
  if (tier) quantity = Number(tier.min_quantity);
  if (!tier) tier = resolveTier(product, quantity);

  const unitBase = baseUnitPrice(product, size);

  let baseLineTotal;
  const tierTotal = tier ? num(tier.total_price) : null;
  if (tier && tierTotal != null) {
    if (quantity === Number(tier.min_quantity)) {
      // Exact bundle → the tier's absolute total price.
      baseLineTotal = tierTotal;
    } else {
      // Between/above defined tiers → per-unit-equivalent of the best tier.
      baseLineTotal = (tierTotal / Number(tier.min_quantity)) * quantity;
    }
  } else {
    baseLineTotal = unitBase * quantity;
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
  for (const t of getTiers(product)) {
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

// ── Free delivery ─────────────────────────────────────────────────────────--
// A cart qualifies for free delivery when ANY line is flagged free_delivery
// (product-level) or free_shipping (a bundle offer).
export function cartHasFreeDelivery(items = []) {
  return (Array.isArray(items) ? items : []).some(
    (it) => it && (it.free_delivery || it.free_shipping)
  );
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
