import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit2, Trash2, Image, FolderOpen, Sparkles } from "lucide-react";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

const EMPTY = { name: "", name_ar: "", slug: "", image_url: "", display_order: 0, is_visible: true };

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();
  const { t, lang, dir } = useAdminLanguage();

  useEffect(() => {
    base44.entities.Category.list("display_order", 50).then(setCategories).finally(() => setLoading(false));
  }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setOpen(true); };
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name_ar) { toast({ title: t("Please enter the Arabic name", "يرجى إدخال الاسم بالعربية"), variant: "destructive" }); return; }
    setSaving(true);
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, "-");
    const data = { ...form, slug };
    if (editing) {
      const updated = await base44.entities.Category.update(editing.id, data);
      setCategories(prev => prev.map(c => c.id === editing.id ? updated : c));
      toast({ title: t("✅ Category updated", "✅ تم تحديث الفئة") });
    } else {
      const created = await base44.entities.Category.create(data);
      setCategories(prev => [...prev, created]);
      toast({ title: t("✅ Category added", "✅ تم إضافة الفئة") });
    }
    setSaving(false);
    setOpen(false);
  };

  const deleteCategory = async (id) => {
    if (!confirm(t("Are you sure you want to delete this category?", "هل أنت متأكد من حذف هذه الفئة؟"))) return;
    await base44.entities.Category.delete(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    toast({ title: t("Category deleted", "تم حذف الفئة") });
  };

  const cleanup = async () => {
    if (!confirm(t("Remove duplicate and empty categories?", "إزالة الفئات المكرّرة والفارغة؟"))) return;
    setCleaning(true);
    try {
      const res = await base44.functions.cleanupCategories();
      toast({ title: t("Cleanup complete", "تم التنظيف"), description: t(`Duplicates: ${res?.removed_duplicates || 0} · Empty: ${res?.removed_empty || 0}`, `مكرّر: ${res?.removed_duplicates || 0} · فارغ: ${res?.removed_empty || 0}`) });
      const fresh = await base44.entities.Category.list("display_order", 50);
      setCategories(fresh);
    } catch (e) {
      toast({ title: t("Cleanup failed", "تعذّر التنظيف"), description: e?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("image_url", file_url);
    setUploading(false);
  };

  const toggleVisible = async (cat) => {
    const updated = await base44.entities.Category.update(cat.id, { is_visible: !cat.is_visible });
    setCategories(prev => prev.map(c => c.id === cat.id ? updated : c));
  };

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">{t("Categories", "الفئات")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("Manage your store categories", "أدر فئات المتجر")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cleanup} disabled={cleaning} className="gap-2 rounded-xl h-11">
            <Sparkles className="w-4 h-4" />{cleaning ? "..." : t("Cleanup", "تنظيف")}
          </Button>
          <Button onClick={openNew} className="gap-2 rounded-xl h-11">
            <Plus className="w-4 h-4" />{t("Add Category", "إضافة فئة")}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t("No categories yet", "لا توجد فئات بعد")}</p>
              <Button onClick={openNew} className="mt-4 rounded-xl">{t("Add your first category", "إضافة أول فئة")}</Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {cat.image_url ? (
                      <img src={cat.image_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xl">📁</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{lang === "ar" ? (cat.name_ar || cat.name) : (cat.name || cat.name_ar)}</div>
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? cat.name : cat.name_ar}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!cat.is_visible} onCheckedChange={() => toggleVisible(cat)} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openEdit(cat)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="font-black">{editing ? t("Edit Category", "تعديل الفئة") : t("Add New Category", "إضافة فئة جديدة")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-bold">{t("Arabic Name *", "الاسم بالعربية *")}</Label>
              <Input className="mt-1 text-right" value={form.name_ar} onChange={e => f("name_ar", e.target.value)} style={{ direction: "rtl" }} placeholder={t("e.g. Electronics (Arabic)", "مثال: إلكترونيات")} />
            </div>
            <div>
              <Label className="font-bold">{t("English Name", "الاسم بالإنجليزية")}</Label>
              <Input className="mt-1" value={form.name} onChange={e => f("name", e.target.value)} style={{ direction: "ltr" }} placeholder="e.g. Electronics" />
            </div>
            <div>
              <Label className="font-bold">{t("Display Order", "ترتيب العرض")}</Label>
              <Input className="mt-1 w-24" type="number" value={form.display_order} onChange={e => f("display_order", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">{t("Lower numbers appear first", "الرقم الأصغر يظهر أولاً")}</p>
            </div>
            <div>
              <Label className="font-bold">{t("Category Image", "صورة الفئة")}</Label>
              {form.image_url ? (
                <div className="mt-1 flex items-center gap-3">
                  <img src={form.image_url} className="w-16 h-16 rounded-xl object-cover" />
                  <Button variant="outline" size="sm" onClick={() => f("image_url", "")}>{t("Remove", "إزالة")}</Button>
                </div>
              ) : (
                <label className="cursor-pointer block mt-1">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-sm">{uploading ? t("Uploading...", "جاري الرفع...") : t("Upload image", "رفع صورة")}</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                </label>
              )}
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <Switch checked={!!form.is_visible} onCheckedChange={v => f("is_visible", v)} />
              <span className="font-bold text-sm">{t("Visible in store", "ظاهرة في المتجر")}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">{t("Cancel", "إلغاء")}</Button>
            <Button onClick={save} disabled={saving} className="flex-1 rounded-xl font-black">
              {saving ? t("Saving...", "جاري الحفظ...") : t("💾 Save", "💾 حفظ")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}