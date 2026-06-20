import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Search, Image, Upload, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  { label: "حديقة وري", labelEn: "Garden & Irrigation", value: "garden" },
  { label: "إلكترونيات", labelEn: "Electronics",         value: "electronics" },
  { label: "منزل ومطبخ", labelEn: "Home & Kitchen",      value: "home" },
  { label: "صحة وجمال",  labelEn: "Health & Beauty",     value: "health" },
  { label: "أطفال وأمومة",labelEn: "Kids & Baby",        value: "kids" },
  { label: "حيوانات أليفة",labelEn: "Pets",              value: "pets" },
  { label: "أدوات",       labelEn: "Tools",               value: "tools" },
];

const EMPTY = {
  name: "", name_ar: "", short_description: "", short_description_ar: "",
  category: "garden", price: "", compare_at_price: "", stock_quantity: "",
  image_url: "", video_url: "", status: "active",
  is_featured: false, is_trending: false, is_bestseller: false, is_new: false,
};

function DiscountPreview({ price, compareAt }) {
  const p = Number(price);
  const c = Number(compareAt);
  if (!p || !c || c <= p) return null;
  const pct = Math.round(((c - p) / c) * 100);
  const fmt = formatPrice;
  return (
    <div className="flex items-center gap-2 mt-2 bg-green-50 rounded-xl p-2.5">
      <span className="font-black text-green-700 text-lg">{fmt(p)}</span>
      <span className="text-muted-foreground line-through text-sm">{fmt(c)}</span>
      <Badge className="bg-red-500 text-white text-xs">-{pct}% خصم</Badge>
    </div>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const location = useLocation();
  const imageInputRef = useRef();

  useEffect(() => {
    base44.entities.Product.list("-created_date", 200).then(setProducts).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new")) { openNew(); }
    if (params.get("edit")) {
      base44.entities.Product.filter({ id: params.get("edit") }).then(([p]) => { if (p) openEdit(p); });
    }
  }, [location.search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...EMPTY, ...p }); setOpen(true); };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async (addAnother = false) => {
    if (!form.name || !form.price) { toast({ title: "يرجى إدخال الاسم والسعر", variant: "destructive" }); return; }
    setSaving(true);
    const data = {
      ...form,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock_quantity: form.stock_quantity !== "" ? Number(form.stock_quantity) : null,
    };
    if (editing) {
      const updated = await base44.entities.Product.update(editing.id, data);
      setProducts(prev => prev.map(p => p.id === editing.id ? updated : p));
      toast({ title: "✅ تم تحديث المنتج بنجاح!" });
    } else {
      const created = await base44.entities.Product.create(data);
      setProducts(prev => [created, ...prev]);
      toast({ title: "✅ تم إضافة المنتج بنجاح!" });
    }
    setSaving(false);
    if (addAnother) { setForm(EMPTY); setEditing(null); }
    else setOpen(false);
  };

  const deleteProduct = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    await base44.entities.Product.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    toast({ title: "تم حذف المنتج" });
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("image_url", file_url);
    setUploading(false);
  };

  const uploadVideo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVideo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("video_url", file_url);
    setUploadingVideo(false);
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.name_ar || "").includes(search);
    const matchCat = filterCat === "all" || p.category === filterCat;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">المنتجات</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} منتج</p>
        </div>
        <Button onClick={openNew} className="gap-2 rounded-xl h-11">
          <Plus className="w-4 h-4" />
          إضافة منتج
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتج..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 text-right rounded-xl text-sm"
              style={{ direction: "rtl" }}
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none"
          >
            <option value="all">كل الفئات</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="draft">مسودة</option>
          </select>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <div key={i} className="aspect-square bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => {
            const fmt = formatPrice;
            return (
              <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="aspect-video bg-muted relative overflow-hidden">
                  <img src={p.image_url || "https://placehold.co/400x250?text=?"} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    {p.is_trending && <Badge className="bg-orange-500 text-white text-xs px-1.5">🔥</Badge>}
                    {p.is_bestseller && <Badge className="bg-amber-500 text-white text-xs px-1.5">⭐</Badge>}
                    {p.is_new && <Badge className="bg-primary text-white text-xs px-1.5">جديد</Badge>}
                    {p.video_url && <Badge className="bg-black/60 text-white text-xs px-1.5">▶</Badge>}
                  </div>
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {p.status === "active" ? "نشط" : "مخفي"}
                  </div>
                  {p.stock_quantity != null && p.stock_quantity <= 5 && (
                    <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {p.stock_quantity === 0 ? "نفد!" : `${p.stock_quantity} قطعة`}
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="font-bold text-sm leading-tight line-clamp-1 mb-0.5">{p.name_ar || p.name}</p>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-primary">{fmt(p.price)}</span>
                      {p.compare_at_price && <span className="text-xs text-muted-foreground line-through mr-1">{fmt(p.compare_at_price)}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="col-span-full p-12 text-center text-muted-foreground">لا توجد منتجات</div>
          )}
        </div>
      )}

      {/* Product Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{editing ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="font-bold">الاسم بالعربية *</Label>
                <Input className="mt-1 text-right" value={form.name_ar} onChange={e => f("name_ar", e.target.value)} style={{ direction: "rtl" }} placeholder="مثال: مضخة هواء محمولة" />
              </div>
              <div>
                <Label className="font-bold">الاسم بالإنجليزية *</Label>
                <Input className="mt-1" value={form.name} onChange={e => f("name", e.target.value)} style={{ direction: "ltr" }} placeholder="e.g. Portable Air Pump" />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="font-bold">الوصف بالعربية</Label>
                <textarea
                  className="mt-1 w-full border border-input rounded-xl px-3 py-2 text-sm resize-none h-20 text-right outline-none focus:ring-1 focus:ring-primary"
                  value={form.short_description_ar}
                  onChange={e => f("short_description_ar", e.target.value)}
                  style={{ direction: "rtl" }}
                  placeholder="وصف قصير للمنتج بالعربية"
                />
              </div>
              <div>
                <Label className="font-bold">الوصف بالإنجليزية</Label>
                <textarea
                  className="mt-1 w-full border border-input rounded-xl px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-primary"
                  value={form.short_description}
                  onChange={e => f("short_description", e.target.value)}
                  style={{ direction: "ltr" }}
                  placeholder="Short product description in English"
                />
              </div>
            </div>

            {/* Category + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-bold">الفئة</Label>
                <Select value={form.category} onValueChange={v => f("category", v)}>
                  <SelectTrigger className="mt-1 text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-bold">الحالة</Label>
                <Select value={form.status} onValueChange={v => f("status", v)}>
                  <SelectTrigger className="mt-1 text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط (ظاهر)</SelectItem>
                    <SelectItem value="draft">مخفي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <Label className="font-black text-base block mb-3">السعر</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">السعر الحالي ($) *</Label>
                  <Input
                    className="mt-1" type="number" value={form.price}
                    onChange={e => f("price", e.target.value)}
                    placeholder="مثال: 25000 = $25"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">السعر القديم ($)</Label>
                  <Input
                    className="mt-1" type="number" value={form.compare_at_price}
                    onChange={e => f("compare_at_price", e.target.value)}
                    placeholder="اتركه فارغاً إذا لا يوجد خصم"
                  />
                  <p className="text-xs text-muted-foreground mt-1">أدخل السعر الأصلي لإظهار خصم. اتركه فارغاً إذا لا يوجد.</p>
                </div>
              </div>
              <DiscountPreview price={form.price} compareAt={form.compare_at_price} />
            </div>

            {/* Stock */}
            <div>
              <Label className="font-bold">الكمية في المخزون</Label>
              <Input
                className="mt-1 w-40" type="number" value={form.stock_quantity}
                onChange={e => f("stock_quantity", e.target.value)}
                placeholder="مثال: 50"
              />
              <p className="text-xs text-muted-foreground mt-1">اتركه فارغاً إذا لا تريد تتبع الكمية.</p>
            </div>

            {/* Image Upload */}
            <div>
              <Label className="font-black text-base block mb-2">صورة المنتج</Label>
              {form.image_url ? (
                <div className="relative w-32 h-32">
                  <img src={form.image_url} className="w-full h-full object-cover rounded-2xl" />
                  <button onClick={() => f("image_url", "")} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                    <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-bold">{uploading ? "جاري الرفع..." : "اضغط لرفع صورة"}</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG</p>
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
                </label>
              )}
            </div>

            {/* Video */}
            <div>
              <Label className="font-black text-base block mb-2">فيديو المنتج (اختياري)</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">رابط الفيديو (يوتيوب / MP4)</Label>
                  <Input
                    className="mt-1" value={form.video_url}
                    onChange={e => f("video_url", e.target.value)}
                    placeholder="https://youtube.com/... أو https://..."
                    style={{ direction: "ltr" }}
                  />
                </div>
                <div className="text-center text-xs text-muted-foreground">أو</div>
                <label className="cursor-pointer block">
                  <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{uploadingVideo ? "جاري رفع الفيديو..." : "رفع ملف فيديو"}</span>
                  </div>
                  <input type="file" accept="video/*" className="hidden" onChange={uploadVideo} disabled={uploadingVideo} />
                </label>
                {form.video_url && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl px-3 py-2 text-xs">
                    ✅ تم إضافة الفيديو
                    <button onClick={() => f("video_url", "")} className="text-red-500 mr-auto">إزالة</button>
                  </div>
                )}
              </div>
            </div>

            {/* Flags */}
            <div>
              <Label className="font-black text-base block mb-3">الأقسام (أين يظهر المنتج في الصفحة الرئيسية؟)</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "is_featured", label: "⭐ مميز" },
                  { key: "is_trending", label: "🔥 رائج" },
                  { key: "is_bestseller", label: "🏆 الأكثر مبيعاً" },
                  { key: "is_new", label: "🆕 جديد" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <Switch checked={!!form[key]} onCheckedChange={v => f(key, v)} />
                    <span className="text-sm font-bold">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save buttons */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={() => save(false)} disabled={saving || !form.name_ar || !form.price} className="flex-1 rounded-xl h-11 font-black">
              {saving ? "جاري الحفظ..." : "💾 حفظ المنتج"}
            </Button>
            {!editing && (
              <Button variant="outline" onClick={() => save(true)} disabled={saving} className="flex-1 rounded-xl h-11">
                حفظ وإضافة آخر
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}