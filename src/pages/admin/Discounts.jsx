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

export default function AdminDiscounts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  // Coupons are stored as a real backend entity so they can be validated at checkout.
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: "", type: "percent", value: "", min_order: "", usage_limit: "", expiry: "", active: true });

  const loadCoupons = () => base44.entities.Coupon.list("-created_date", 200).then(setCoupons).catch(() => setCoupons([]));

  useEffect(() => {
    base44.entities.Product.list("-created_date", 200).then(setProducts).finally(() => setLoading(false));
    loadCoupons();
  }, []);

  const fmt = formatPrice;

  const applyBulkDiscount = async () => {
    if (!discountValue || selectedProducts.length === 0) {
      toast({ title: "اختر منتجات وأدخل قيمة الخصم", variant: "destructive" }); return;
    }
    setApplying(true);
    for (const id of selectedProducts) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      const currentPrice = Number(p.price);
      if (discountType === "percent") {
        const newPrice = Math.round(currentPrice * (1 - Number(discountValue) / 100));
        await base44.entities.Product.update(id, { price: newPrice, compare_at_price: currentPrice });
      } else {
        const newPrice = Math.max(0, currentPrice - Number(discountValue));
        await base44.entities.Product.update(id, { price: newPrice, compare_at_price: currentPrice });
      }
    }
    const updated = await base44.entities.Product.list("-created_date", 200);
    setProducts(updated);
    setSelectedProducts([]);
    setDiscountValue("");
    toast({ title: `✅ تم تطبيق الخصم على ${selectedProducts.length} منتج` });
    setApplying(false);
  };

  const removeDiscount = async (id) => {
    await base44.entities.Product.update(id, { compare_at_price: null });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, compare_at_price: null } : p));
    toast({ title: "تم إزالة الخصم" });
  };

  const addCoupon = async () => {
    if (!couponForm.code || !couponForm.value) { toast({ title: "أدخل الكود والقيمة", variant: "destructive" }); return; }
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
    toast({ title: "✅ تم إضافة الكوبون" });
  };

  const deleteCoupon = async (id) => {
    if (!confirm("هل تريد حذف هذا الكوبون؟")) return;
    await base44.entities.Coupon.delete(id);
    await loadCoupons();
  };

  const toggleCoupon = async (c) => {
    await base44.entities.Coupon.update(c.id, { active: !c.active });
    await loadCoupons();
  };

  const discountedProducts = products.filter(p => p.compare_at_price && p.compare_at_price > p.price);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">العروض والخصومات</h1>
        <p className="text-sm text-muted-foreground mt-1">أدر خصومات المنتجات وكوبونات الخصم</p>
      </div>

      <Tabs defaultValue="bulk">
        <TabsList className="bg-gray-100 rounded-xl mb-6">
          <TabsTrigger value="bulk" className="rounded-lg">خصم جماعي</TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg">العروض النشطة</TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-lg">كوبونات الخصم</TabsTrigger>
        </TabsList>

        {/* Bulk Discount */}
        <TabsContent value="bulk">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base font-black">إعدادات الخصم</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-bold">نوع الخصم</Label>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setDiscountType("percent")}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${discountType === "percent" ? "bg-primary text-white" : "bg-gray-100"}`}>
                        نسبة %
                      </button>
                      <button onClick={() => setDiscountType("fixed")}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${discountType === "fixed" ? "bg-primary text-white" : "bg-gray-100"}`}>
                        مبلغ ثابت
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="font-bold">{discountType === "percent" ? "نسبة الخصم (%)" : "مبلغ الخصم ($)"}</Label>
                    <Input className="mt-1" type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percent" ? "مثال: 20" : "مثال: 5"} />
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                    تم اختيار <b>{selectedProducts.length}</b> منتج
                  </div>
                  <Button onClick={applyBulkDiscount} disabled={applying || selectedProducts.length === 0 || !discountValue} className="w-full rounded-xl font-black h-11">
                    {applying ? "جاري التطبيق..." : "✅ تطبيق الخصم"}
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-black">اختر المنتجات</CardTitle>
                  <button className="text-xs text-primary font-bold" onClick={() => setSelectedProducts(products.map(p => p.id))}>اختر الكل</button>
                </CardHeader>
                <CardContent className="p-0 max-h-96 overflow-y-auto">
                  {products.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${selectedProducts.includes(p.id) ? "bg-primary/5" : ""}`}>
                      <input type="checkbox" checked={selectedProducts.includes(p.id)}
                        onChange={e => setSelectedProducts(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                        className="rounded" />
                      <img src={p.image_url || "https://placehold.co/40?text=?"} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{p.name_ar || p.name}</div>
                        <div className="text-xs text-muted-foreground">{fmt(p.price)}</div>
                      </div>
                      {p.compare_at_price && <Badge className="bg-red-100 text-red-600 text-xs">خصم نشط</Badge>}
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
            <CardHeader><CardTitle className="text-base font-black">المنتجات ذات الخصومات النشطة ({discountedProducts.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {discountedProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">لا توجد خصومات نشطة</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {discountedProducts.map(p => {
                    const pct = Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <img src={p.image_url || "https://placehold.co/40?text=?"} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{p.name_ar || p.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-black text-primary">{fmt(p.price)}</span>
                            <span className="text-xs text-muted-foreground line-through">{fmt(p.compare_at_price)}</span>
                            <Badge className="bg-red-500 text-white text-xs">-{pct}%</Badge>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeDiscount(p.id)} className="text-red-500 border-red-200 hover:bg-red-50 rounded-xl text-xs">
                          إزالة الخصم
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
              <CardHeader><CardTitle className="text-base font-black">إضافة كوبون جديد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="font-bold">كود الخصم *</Label>
                  <Input className="mt-1 uppercase" value={couponForm.code} onChange={e => setCouponForm(f => ({...f, code: e.target.value.toUpperCase()}))}
                    placeholder="مثال: SAVE10" style={{ direction: "ltr", letterSpacing: "0.1em", fontWeight: "bold" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bold">نوع الخصم</Label>
                    <select value={couponForm.type} onChange={e => setCouponForm(f => ({...f, type: e.target.value}))}
                      className="mt-1 w-full border border-input rounded-xl px-3 py-2 text-sm bg-white outline-none">
                      <option value="percent">نسبة %</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </select>
                  </div>
                  <div>
                    <Label className="font-bold">القيمة *</Label>
                    <Input className="mt-1" type="number" value={couponForm.value} onChange={e => setCouponForm(f => ({...f, value: e.target.value}))}
                      placeholder={couponForm.type === "percent" ? "20" : "5"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bold">الحد الأدنى للطلب ($)</Label>
                    <Input className="mt-1" type="number" value={couponForm.min_order} onChange={e => setCouponForm(f => ({...f, min_order: e.target.value}))} placeholder="اختياري" />
                  </div>
                  <div>
                    <Label className="font-bold">تاريخ الانتهاء</Label>
                    <Input className="mt-1" type="date" value={couponForm.expiry} onChange={e => setCouponForm(f => ({...f, expiry: e.target.value}))} />
                  </div>
                </div>
                <Button onClick={addCoupon} className="w-full rounded-xl font-black h-11">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة الكوبون
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-black">الكوبونات ({coupons.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {coupons.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">لا توجد كوبونات بعد</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {coupons.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-primary" style={{ letterSpacing: "0.1em", direction: "ltr" }}>{c.code}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.type === "percent" ? `${c.value}% خصم` : `$${c.value} خصم`}
                            {c.min_order && ` · حد أدنى $${c.min_order}`}
                            {c.expiry && ` · ينتهي ${c.expiry}`}
                          </div>
                        </div>
                        <Switch checked={!!c.active} onCheckedChange={() => toggleCoupon(c)} />
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive" onClick={() => deleteCoupon(c.id)}>
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