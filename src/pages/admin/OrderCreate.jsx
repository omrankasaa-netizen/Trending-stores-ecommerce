import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Plus, Trash2, Search, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";
import {
  getSizes, sizeId, findSize, buildOfferOptions, computeManualOrderTotals,
} from "@/lib/pricing";

function genOrderNum() { return "TS-" + Date.now().toString().slice(-6); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

export default function OrderCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, lang, isRTL, dir } = useAdminLanguage();

  const [products, setProducts] = useState([]);
  const [globalPct, setGlobalPct] = useState(0);
  const [defaultFee, setDefaultFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Customer + order fields.
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", city: "", address: "", notes: "" });
  const [items, setItems] = useState([]);
  const [discountType, setDiscountType] = useState("fixed"); // 'fixed' | 'percent'
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [totalOverride, setTotalOverride] = useState(false);
  const [totalInput, setTotalInput] = useState("");

  // Product picker state.
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [selectedOfferKey, setSelectedOfferKey] = useState("single");

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.functions.getMarkupConfig().catch(() => null),
      base44.entities.SiteSettings.filter({ key: "delivery_fee" }).catch(() => []),
    ]).then(([prods, markup, feeRows]) => {
      setProducts(Array.isArray(prods) ? prods : []);
      setGlobalPct(Number(markup?.global_pct) || 0);
      const fee = Number(feeRows?.[0]?.value) || 0;
      setDefaultFee(fee);
      setDeliveryFee(String(fee));
    }).finally(() => setLoading(false));
  }, []);

  const updateCustomer = (k, v) => setCustomer((c) => ({ ...c, [k]: v }));

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId)) || null;
  const selectedSize = selectedProduct ? findSize(selectedProduct, selectedSizeId) : null;
  const offerOptions = useMemo(
    () => (selectedProduct ? buildOfferOptions(selectedProduct, selectedSize, globalPct) : []),
    [selectedProduct, selectedSize, globalPct]
  );

  // Reset size/offer when the product changes.
  useEffect(() => { setSelectedSizeId(""); setSelectedOfferKey("single"); }, [selectedProductId]);
  useEffect(() => { setSelectedOfferKey("single"); }, [selectedSizeId]);

  const pName = (p) => (lang === "ar" ? (p?.name_ar || p?.name) : (p?.name || p?.name_ar)) || "";

  const filteredProducts = products.filter((p) => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (p.name || "").toLowerCase().includes(q) || (p.name_ar || "").includes(pickerSearch.trim());
  });

  const addItem = () => {
    if (!selectedProduct) return;
    const opt = offerOptions.find((o) => o.key === selectedOfferKey) || offerOptions[0];
    if (!opt) return;
    const quantity = opt.quantity || 1;
    // Default unit price = the customer-facing effective price (size + bundle
    // offer + hidden markup) via the shared pricing logic. Admin can override.
    const unitPrice = opt.unit_price;
    setItems((prev) => [
      ...prev,
      {
        key: `${selectedProduct.id}-${selectedSizeId}-${opt.key}-${Date.now()}`,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name || "",
        product_name_ar: selectedProduct.name_ar || "",
        image_url: selectedProduct.image_url || (selectedProduct.images?.[0] || ""),
        size_id: selectedSize ? sizeId(selectedSize) : "",
        size_label: selectedSize?.label || "",
        size_label_ar: selectedSize?.label_ar || "",
        offer_min_quantity: opt.key === "single" ? null : opt.min_quantity,
        offer_label: opt.label || "",
        offer_label_ar: opt.label_ar || "",
        free_delivery: !!selectedProduct.free_delivery || !!opt.free_shipping,
        quantity,
        price: unitPrice,
      },
    ]);
    setSelectedProductId("");
    setPickerSearch("");
  };

  const updateItem = (key, patch) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  // Live totals — same pure math the server persists.
  const totals = useMemo(() => computeManualOrderTotals({
    items: items.map((it) => ({ price: it.price, quantity: it.quantity })),
    discount_type: discountType,
    discount_value: discountValue,
    delivery_fee: deliveryFee,
    total_override: totalOverride,
    total: totalInput,
  }), [items, discountType, discountValue, deliveryFee, totalOverride, totalInput]);

  // Keep the total field synced to the auto total until the admin overrides it.
  useEffect(() => {
    if (!totalOverride) setTotalInput(String(totals.auto_total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.auto_total, totalOverride]);

  const canSubmit = customer.name.trim() && customer.phone.trim() && items.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const oNum = genOrderNum();
    try {
      const order = await base44.entities.Order.create({
        order_number: oNum,
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_email: customer.email.trim() || undefined,
        customer_address: customer.address.trim(),
        customer_city: customer.city.trim(),
        customer_notes: customer.notes.trim(),
        items: items.map(({ key, ...rest }) => ({ ...rest, price: round2(rest.price), quantity: Math.max(1, Math.floor(Number(rest.quantity) || 1)) })),
        manual: true,
        discount_type: discountType,
        discount_value: Math.max(0, Number(discountValue) || 0),
        delivery_fee: Math.max(0, Number(deliveryFee) || 0),
        total_override: totalOverride,
        total: totalOverride ? round2(Number(totalInput) || 0) : undefined,
        status: "pending",
        payment_method: "cod",
      });
      // Commit stock + best-effort notifications, mirroring the checkout flow.
      try {
        await Promise.allSettled([
          base44.functions.commitStock({ order_id: order?.id }),
          customer.email.trim() ? base44.functions.sendOrderConfirmation({ order_id: order?.id }) : Promise.resolve(),
          base44.functions.sendOrderNotification({ order_id: order?.id }),
        ]);
      } catch { /* automation must not block order creation */ }
      toast({ title: t("Order created", "تم إنشاء الطلب") });
      navigate(`/admin/orders/${order.id}`);
    } catch (e) {
      toast({ title: t("Failed to create order", "تعذّر إنشاء الطلب"), description: e?.data?.error || e?.message || "", variant: "destructive" });
      setSaving(false);
    }
  };

  const inputClass = `mt-1.5 h-11 rounded-xl ${isRTL ? "text-right" : "text-left"}`;

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }} dir={dir}>{t("Loading...", "جاري التحميل...")}</div>;
  }

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/admin/orders")} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowRight className={`w-5 h-5 ${!isRTL ? "rotate-180" : ""}`} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-foreground">{t("New Manual Order", "طلب يدوي جديد")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Create an order with full pricing control", "أنشئ طلباً مع تحكم كامل بالتسعير")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: customer + products */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Customer info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{t("Customer Information", "معلومات العميل")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Full Name *", "الاسم الكامل *")}</Label>
                  <Input value={customer.name} onChange={(e) => updateCustomer("name", e.target.value)} className={inputClass} style={{ direction: isRTL ? "rtl" : "ltr" }} />
                </div>
                <div>
                  <Label>{t("Phone Number *", "رقم الهاتف *")}</Label>
                  <Input value={customer.phone} onChange={(e) => updateCustomer("phone", e.target.value)} className={inputClass} dir="ltr" />
                </div>
                <div>
                  <Label>{t("City", "المدينة")}</Label>
                  <Input value={customer.city} onChange={(e) => updateCustomer("city", e.target.value)} className={inputClass} style={{ direction: isRTL ? "rtl" : "ltr" }} />
                </div>
                <div>
                  <Label>{t("Email (optional)", "البريد الإلكتروني (اختياري)")}</Label>
                  <Input value={customer.email} onChange={(e) => updateCustomer("email", e.target.value)} type="email" className={inputClass} dir="ltr" />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("Full Address", "العنوان الكامل")}</Label>
                  <Input value={customer.address} onChange={(e) => updateCustomer("address", e.target.value)} className={inputClass} style={{ direction: isRTL ? "rtl" : "ltr" }} />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("Notes (optional)", "ملاحظات (اختياري)")}</Label>
                  <Input value={customer.notes} onChange={(e) => updateCustomer("notes", e.target.value)} className={inputClass} style={{ direction: isRTL ? "rtl" : "ltr" }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product picker */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{t("Add Products", "إضافة منتجات")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className={`absolute top-3 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                <Input
                  placeholder={t("Search products...", "ابحث عن منتجات...")}
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className={`h-11 rounded-xl ${isRTL ? "pr-9 text-right" : "pl-9 text-left"}`}
                  style={{ direction: isRTL ? "rtl" : "ltr" }}
                />
              </div>

              {/* Product select */}
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                style={{ direction: isRTL ? "rtl" : "ltr" }}
              >
                <option value="">{t("— Select a product —", "— اختر منتجاً —")}</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>{pName(p)}</option>
                ))}
              </select>

              {selectedProduct && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Size */}
                  {getSizes(selectedProduct).length > 0 && (
                    <div>
                      <Label className="text-xs">{t("Size", "الحجم")}</Label>
                      <select
                        value={selectedSizeId}
                        onChange={(e) => setSelectedSizeId(e.target.value)}
                        className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-2 text-sm"
                        style={{ direction: isRTL ? "rtl" : "ltr" }}
                      >
                        <option value="">{t("Default", "افتراضي")}</option>
                        {getSizes(selectedProduct).map((s) => (
                          <option key={sizeId(s)} value={sizeId(s)}>{lang === "ar" ? (s.label_ar || s.label) : (s.label || s.label_ar)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Offer */}
                  <div>
                    <Label className="text-xs">{t("Offer", "العرض")}</Label>
                    <select
                      value={selectedOfferKey}
                      onChange={(e) => setSelectedOfferKey(e.target.value)}
                      className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-2 text-sm"
                      style={{ direction: isRTL ? "rtl" : "ltr" }}
                    >
                      {offerOptions.map((o) => {
                        const lbl = o.key === "single"
                          ? t(`Single — ${formatPrice(o.unit_price)}`, `قطعة — ${formatPrice(o.unit_price)}`)
                          : `${(lang === "ar" ? (o.label_ar || o.label) : (o.label || o.label_ar)) || t(`${o.min_quantity} pcs`, `${o.min_quantity} قطع`)} — ${formatPrice(o.total_price)}`;
                        return <option key={o.key} value={o.key}>{lbl}</option>;
                      })}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={addItem} className="w-full h-10 rounded-xl gap-1.5">
                      <Plus className="w-4 h-4" /> {t("Add", "إضافة")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Line items */}
              {items.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <ShoppingBag className="w-8 h-8 opacity-30" />
                  {t("No items yet — add products above", "لا توجد منتجات — أضف منتجات بالأعلى")}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((it) => {
                    const sz = lang === "ar" ? (it.size_label_ar || it.size_label) : (it.size_label || it.size_label_ar);
                    const of = lang === "ar" ? (it.offer_label_ar || it.offer_label) : (it.offer_label || it.offer_label_ar);
                    return (
                      <div key={it.key} className="py-3 flex items-center gap-3">
                        {it.image_url && <img src={it.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{lang === "ar" ? (it.product_name_ar || it.product_name) : (it.product_name || it.product_name_ar)}</div>
                          {(sz || of) && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {sz && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{sz}</span>}
                              {of && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{of}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t("Qty", "الكمية")}</Label>
                            <Input
                              type="number" min="1" dir="ltr"
                              value={it.quantity}
                              onChange={(e) => updateItem(it.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                              className="h-9 w-16 rounded-lg text-center"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t("Unit $", "سعر الوحدة $")}</Label>
                            <Input
                              type="number" min="0" step="0.01" dir="ltr"
                              value={it.price}
                              onChange={(e) => updateItem(it.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                              className="h-9 w-24 rounded-lg text-center"
                            />
                          </div>
                          <div className="text-right min-w-[70px]">
                            <Label className="text-[10px] text-muted-foreground block">{t("Line", "السطر")}</Label>
                            <span className="font-black text-primary text-sm">{formatPrice(round2(it.price * it.quantity))}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(it.key)} className="h-9 w-9">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: pricing summary */}
        <Card className="border-0 shadow-sm h-fit lg:sticky lg:top-24">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{t("Order Total", "إجمالي الطلب")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Subtotal", "المجموع الفرعي")}</span>
              <span className="font-bold">{formatPrice(totals.subtotal)}</span>
            </div>

            {/* Order-level discount */}
            <div>
              <Label className="text-xs">{t("Order Discount", "خصم الطلب")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <div className="inline-flex rounded-lg border border-input overflow-hidden">
                  <button type="button" onClick={() => setDiscountType("fixed")} className={`px-3 h-10 text-sm font-bold ${discountType === "fixed" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>$</button>
                  <button type="button" onClick={() => setDiscountType("percent")} className={`px-3 h-10 text-sm font-bold ${discountType === "percent" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>%</button>
                </div>
                <Input
                  type="number" min="0" step="0.01" dir="ltr"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-lg flex-1"
                />
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-xs text-red-500 font-medium mt-1">
                  <span>{t("Discount applied", "الخصم المطبّق")}</span>
                  <span>-{formatPrice(totals.discount)}</span>
                </div>
              )}
            </div>

            {/* Delivery fee */}
            <div>
              <Label className="text-xs">{t("Delivery Fee", "رسوم التوصيل")}</Label>
              <Input
                type="number" min="0" step="0.01" dir="ltr"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="h-10 rounded-lg mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t(`Store default: ${formatPrice(defaultFee)} — set 0 to waive`, `الافتراضي: ${formatPrice(defaultFee)} — اضبط 0 للإعفاء`)}</p>
            </div>

            {/* Final total (auto + override) */}
            <div className="border-t border-gray-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={totalOverride} onChange={(e) => setTotalOverride(e.target.checked)} className="rounded" />
                <span className="text-xs text-muted-foreground">{t("Override final total", "تجاوز الإجمالي النهائي")}</span>
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-base">{t("Total", "المجموع")}</span>
                {totalOverride ? (
                  <Input
                    type="number" min="0" step="0.01" dir="ltr"
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value)}
                    className="h-11 w-32 rounded-lg text-right font-black text-primary"
                  />
                ) : (
                  <span className="font-black text-xl text-primary">{formatPrice(totals.total)}</span>
                )}
              </div>
              {totalOverride && (
                <p className="text-[10px] text-amber-600 mt-1">{t(`Auto total: ${formatPrice(totals.auto_total)} (overridden)`, `الإجمالي التلقائي: ${formatPrice(totals.auto_total)} (تم تجاوزه)`)}</p>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full h-12 rounded-xl font-black text-base">
              {saving ? t("Creating...", "جاري الإنشاء...") : t("Create Order", "إنشاء الطلب")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
