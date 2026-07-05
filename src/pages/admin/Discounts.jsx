import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

export default function AdminDiscounts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();
  const { t, lang, isRTL, dir } = useAdminLanguage();

  // Coupons are stored as a real backend entity so they can be validated at checkout.
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: "", type: "percent", value: "", min_order: "", usage_limit: "", expiry: "", active: true });
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Resolve a record id robustly ('id' or Mongo-style '_id') so requests never hit /entities/<Name>/undefined.
  const rid = (o) => o?.id || o?._id;
  // Extract a human-readable error message from a failed request.
  const errMsg = (e) => e?.data?.error || e?.message || t("An unexpected error occurred", "حدث خطأ غير متوقع");
  const productName = (p) => lang === "ar" ? (p.name_ar || p.name) : (p.name || p.name_ar);

  const loadCoupons = () => base44.entities.Coupon.list("-created_date", 200).then(setCoupons).catch(() => setCoupons([]));

  useEffect(() => {
    base44.entities.Product.list("-created_date", 200).then(setProducts).finally(() => setLoading(false));
    loadCoupons();
  }, []);

  const fmt = formatPrice;

  const applyBulkDiscount = async () => {
    if (!discountValue || Number(discountValue) <= 0 || selectedProducts.length === 0) {
      toast({ title: t("Select products and enter a discount value greater than zero", "اختر منتجات وأدخل قيمة خصم أكبر من صفر"), variant: "destructive" }); return;
    }
    setApplying(true);
    try {
      for (const id of selectedProducts) {
        const p = products.find(x => rid(x) === id);
        if (!p) continue;
        const currentPrice = Number(p.price);
        const newPrice = discountType === "percent"
          ? Math.round(currentPrice * (1 - Number(discountValue) / 100))
          : Math.max(0, currentPrice - Number(discountValue));
        await base44.entities.Product.update(id, { price: newPrice, compare_at_price: currentPrice });
      }
      const updated = await base44.entities.Product.list("-created_date", 200);
      setProducts(updated);
      const count = selectedProducts.length;
      setSelectedProducts([]);
      setDiscountValue("");
      toast({ title: t(`✅ Discount applied to ${count} products`, `✅ تم تطبيق الخصم على ${count} منتج`) });
    } catch (e) {
      toast({ title: t("Failed to apply discount", "تعذّر تطبيق الخصم"), description: errMsg(e), variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const removeDiscount = async (id) => {
    try {
      await base44.entities.Product.update(id, { compare_at_price: null });
      setProducts(prev => prev.map(p => rid(p) === id ? { ...p, compare_at_price: null } : p));
      toast({ title: t("Discount removed", "تم إزالة الخصم") });
    } catch (e) {
      toast({ title: t("Failed to remove discount", "تعذّر إزالة الخصم"), description: errMsg(e), variant: "destructive" });
    }
  };

  const addCoupon = async () => {
    if (!couponForm.code || !couponForm.value || Number(couponForm.value) <= 0) {
      toast({ title: t("Enter a code and a value greater than zero", "أدخل الكود وقيمة أكبر من صفر"), variant: "destructive" }); return;
    }
    setSavingCoupon(true);
    try {
      await base44.entities.Coupon.create({
        code: couponForm.code.toUpperCase(),
        type: couponForm.type,
        value: Number(couponForm.value),
        min_order: couponForm.min_order ? Number(couponForm.min_order) : 0,
        usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : 0,
        usage_count: 0,
        expiry: couponForm.expiry || null,
        active: couponForm.active,
      });
      await loadCoupons();
      setCouponForm({ code: "", type: "percent", value: "", min_order: "", usage_limit: "", expiry: "", active: true });
      toast({ title: t("✅ Coupon added", "✅ تم إضافة الكوبون") });
    } catch (e) {
      toast({ title: t("Failed to add coupon", "تعذّر إضافة الكوبون"), description: errMsg(e), variant: "destructive" });
    } finally {
      setSavingCoupon(false);
    }
  };

  const deleteCoupon = async (id) => {
    if (!confirm(t("Do you want to delete this coupon?", "هل تريد حذف هذا الكوبون؟"))) return;
    try {
      await base44.entities.Coupon.delete(id);
      await loadCoupons();
      toast({ title: t("Coupon deleted", "تم حذف الكوبون") });
    } catch (e) {
      toast({ title: t("Failed to delete coupon", "تعذّر حذف الكوبون"), description: errMsg(e), variant: "destructive" });
    }
  };

  const toggleCoupon = async (c) => {
    try {
      await base44.entities.Coupon.update(rid(c), { active: !c.active });
      await loadCoupons();
    } catch (e) {
      toast({ title: t("Failed to update coupon", "تعذّر تحديث الكوبون"), description: errMsg(e), variant: "destructive" });
    }
  };

  const discountedProducts = products.filter(p => p.compare_at_price && p.compare_at_price > p.price);

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">{t("Offers & Discounts", "العروض والخصومات")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("Manage product discounts and discount coupons", "أدر خصومات المنتجات وكوبونات الخصم")}</p>
      </div>

      <Tabs defaultValue="bulk">
        <TabsList className="bg-gray-100 rounded-xl mb-6">
          <TabsTrigger value="bulk" className="rounded-lg">{t("Bulk Discount", "خصم جماعي")}</TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg">{t("Active Offers", "العروض النشطة")}</TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-lg">{t("Discount Coupons", "كوبونات الخصم")}</TabsTrigger>
        </TabsList>

        {/* Bulk Discount */}
        <TabsContent value="bulk">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base font-black">{t("Discount Settings", "إعدادات الخصم")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-bold">{t("Discount Type", "نوع الخصم")}</Label>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setDiscountType("percent")}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${discountType === "percent" ? "bg-primary text-white" : "bg-gray-100"}`}>
                        {t("Percentage %", "نسبة %")}
                      </button>
                      <button onClick={() => setDiscountType("fixed")}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${discountType === "fixed" ? "bg-primary text-white" : "bg-gray-100"}`}>
                        {t("Fixed Amount", "مبلغ ثابت")}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="font-bold">{discountType === "percent" ? t("Discount Percentage (%)", "نسبة الخصم (%)") : t("Discount Amount ($)", "مبلغ الخصم ($)")}</Label>
                    <Input className="mt-1" type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percent" ? t("e.g. 20", "مثال: 20") : t("e.g. 5", "مثال: 5")} />
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                    {isRTL ? (<>تم اختيار <b>{selectedProducts.length}</b> منتج</>) : (<><b>{selectedProducts.length}</b> products selected</>)}
                  </div>
                  <Button onClick={applyBulkDiscount} disabled={applying || selectedProducts.length === 0 || !discountValue} className="w-full rounded-xl font-black h-11">
                    {applying ? t("Applying...", "جاري التطبيق...") : t("✅ Apply Discount", "✅ تطبيق الخصم")}
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-black">{t("Select Products", "اختر المنتجات")}</CardTitle>
                  <button className="text-xs text-primary font-bold" onClick={() => setSelectedProducts(products.map(p => rid(p)))}>{t("Select All", "اختر الكل")}</button>
                </CardHeader>
                <CardContent className="p-0 max-h-96 overflow-y-auto">
                  {products.map(p => (
                    <label key={rid(p)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${selectedProducts.includes(rid(p)) ? "bg-primary/5" : ""}`}>
                      <input type="checkbox" checked={selectedProducts.includes(rid(p))}
                        onChange={e => setSelectedProducts(prev => e.target.checked ? [...prev, rid(p)] : prev.filter(x => x !== rid(p)))}
                        className="rounded" />
                      <img src={p.image_url || "https://placehold.co/40?text=?"} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{productName(p)}</div>
                        <div className="text-xs text-muted-foreground">{fmt(p.price)}</div>
                      </div>
                      {p.compare_at_price && <Badge className="bg-red-100 text-red-600 text-xs">{t("Discount active", "خصم نشط")}</Badge>}
                    </label>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Active Discounts */}
        <TabsContent value="active">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-black">{t(`Products with active discounts (${discountedProducts.length})`, `المنتجات ذات الخصومات النشطة (${discountedProducts.length})`)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {discountedProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{t("No active discounts", "لا توجد خصومات نشطة")}</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {discountedProducts.map(p => {
                    const pct = Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100);
                    return (
                      <div key={rid(p)} className="flex items-center gap-3 px-4 py-3">
                        <img src={p.image_url || "https://placehold.co/40?text=?"} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{productName(p)}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-black text-primary">{fmt(p.price)}</span>
                            <span className="text-xs text-muted-foreground line-through">{fmt(p.compare_at_price)}</span>
                            <Badge className="bg-red-500 text-white text-xs">-{pct}%</Badge>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeDiscount(rid(p))} className="text-red-500 border-red-200 hover:bg-red-50 rounded-xl text-xs">
                          {t("Remove Discount", "إزالة الخصم")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons */}
        <TabsContent value="coupons">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-black">{t("Add New Coupon", "إضافة كوبون جديد")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="font-bold">{t("Discount Code *", "كود الخصم *")}</Label>
                  <Input className="mt-1 uppercase" value={couponForm.code} onChange={e => setCouponForm(f => ({...f, code: e.target.value.toUpperCase()}))}
                    placeholder="e.g. SAVE10" style={{ direction: "ltr", letterSpacing: "0.1em", fontWeight: "bold" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bold">{t("Discount Type", "نوع الخصم")}</Label>
                    <select value={couponForm.type} onChange={e => setCouponForm(f => ({...f, type: e.target.value}))}
                      className="mt-1 w-full border border-input rounded-xl px-3 py-2 text-sm bg-white outline-none">
                      <option value="percent">{t("Percentage %", "نسبة %")}</option>
                      <option value="fixed">{t("Fixed Amount", "مبلغ ثابت")}</option>
                    </select>
                  </div>
                  <div>
                    <Label className="font-bold">{t("Value *", "القيمة *")}</Label>
                    <Input className="mt-1" type="number" value={couponForm.value} onChange={e => setCouponForm(f => ({...f, value: e.target.value}))}
                      placeholder={couponForm.type === "percent" ? "20" : "5"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bold">{t("Minimum Order ($)", "الحد الأدنى للطلب ($)")}</Label>
                    <Input className="mt-1" type="number" value={couponForm.min_order} onChange={e => setCouponForm(f => ({...f, min_order: e.target.value}))} placeholder={t("Optional", "اختياري")} />
                  </div>
                  <div>
                    <Label className="font-bold">{t("Expiry Date", "تاريخ الانتهاء")}</Label>
                    <Input className="mt-1" type="date" value={couponForm.expiry} onChange={e => setCouponForm(f => ({...f, expiry: e.target.value}))} />
                  </div>
                </div>
                <Button onClick={addCoupon} disabled={savingCoupon} className="w-full rounded-xl font-black h-11">
                  <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {savingCoupon ? t("Saving...", "جاري الحفظ...") : t("Add Coupon", "إضافة الكوبون")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-black">{t(`Coupons (${coupons.length})`, `الكوبونات (${coupons.length})`)}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {coupons.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">{t("No coupons yet", "لا توجد كوبونات بعد")}</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {coupons.map(c => (
                      <div key={rid(c)} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-primary" style={{ letterSpacing: "0.1em", direction: "ltr" }}>{c.code}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.type === "percent" ? t(`${c.value}% off`, `${c.value}% خصم`) : t(`$${c.value} off`, `$${c.value} خصم`)}
                            {c.min_order ? t(` · min $${c.min_order}`, ` · حد أدنى $${c.min_order}`) : ""}
                            {c.expiry ? t(` · expires ${c.expiry}`, ` · ينتهي ${c.expiry}`) : ""}
                          </div>
                        </div>
                        <Switch checked={!!c.active} onCheckedChange={() => toggleCoupon(c)} />
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive" onClick={() => deleteCoupon(rid(c))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
