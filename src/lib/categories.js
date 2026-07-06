// Category options shared between the admin product form/filter and the
// storefront. Products store their `category` as a slug string (e.g. "garden"),
// so option values are always slugs. New categories created in the admin
// Categories section live in the Category entity; we merge them with the static
// defaults so existing products keep their labels and freshly created
// categories show up in the product form dropdown without any code change.

// Static defaults. These are the categories the store shipped with, and some
// existing products reference their slugs — never drop them from the options.
export const DEFAULT_CATEGORIES = [
  { labelAr: "حديقة وري", labelEn: "Garden & Irrigation", value: "garden" },
  { labelAr: "إلكترونيات", labelEn: "Electronics", value: "electronics" },
  { labelAr: "منزل ومطبخ", labelEn: "Home & Kitchen", value: "home" },
  { labelAr: "صحة وجمال", labelEn: "Health & Beauty", value: "health" },
  { labelAr: "أطفال وأمومة", labelEn: "Kids & Baby", value: "kids" },
  { labelAr: "حيوانات أليفة", labelEn: "Pets", value: "pets" },
  { labelAr: "أدوات", labelEn: "Tools", value: "tools" },
];

// Mirror the slug generation used when saving a Category so a category created
// without an explicit slug resolves to the same value the product form expects.
export function slugifyCategory(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

// Merge live Category rows into the static defaults, keyed by slug value.
// Defaults are seeded first (so existing products always have a label and
// ordering stays stable); live rows then override/append by value. Returns a
// list of { value, labelEn, labelAr }.
export function mergeCategoryOptions(rows, defaults = DEFAULT_CATEGORIES) {
  const byValue = new Map();
  for (const c of defaults) byValue.set(c.value, c);
  if (Array.isArray(rows)) {
    for (const c of rows) {
      if (!c) continue;
      const value = c.slug || slugifyCategory(c.name || c.name_ar);
      if (!value) continue;
      byValue.set(value, {
        value,
        labelEn: c.name || c.name_ar || value,
        labelAr: c.name_ar || c.name || value,
      });
    }
  }
  return Array.from(byValue.values());
}
