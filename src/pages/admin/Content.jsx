import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit2, Trash2, Image, GripVertical } from "lucide-react";

const EMPTY_BANNER = { headline: "", headline_ar: "", subtext: "", subtext_ar: "", button_text: "", button_text_ar: "", link_target: "/shop", image_url: "", display_order: 0, is_visible: true };

export default function AdminContent() {
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BANNER);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      base44.entities.Banner.list("display_order", 20),
      base44.entities.SiteSettings.list("-created_date", 50),
    ]).then(([b, s]) => {
      setBanners(b);
      const map = {};
      s.forEach(item => { map[item.key] = { id: item.id, value: item.value }; });
      setSettings(map);
    }).finally(() => setLoading(false));
  }, []);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_BANNER); setOpen(true); };
  const openEdit = (b) => { setEditing(b); setForm({ ...EMPTY_BANNER, ...b }); setOpen(true); };

  const saveBanner = async () => {
    setSaving(true);
    if (editing) {
      const updated = await base44.entities.Banner.update(editing.id, form);
      setBanners(prev => prev.map(b => b.id === editing.id ? updated : b));
      toast({ title: "✅ تم تحديث البانر" });
    } else {
      const created = await base44.entities.Banner.create(form);
      setBanners(prev => [...prev, created]);
      toast({ title: "✅ تم إضافة البانر" });
    }
    setSaving(false);
    setOpen(false);
  };

  const deleteBanner = async (id) => {
    if (!confirm("حذف هذا البانر؟")) return;
    await base44.entities.Banner.delete(id);
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const toggleBanner = async (b) => {
    const updated = await base44.entities.Banner.update(b.id, { is_visible: !b.is_visible });
    setBanners(prev => prev.map(x => x.id === b.id ? updated : x));
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("image_url", file_url);
    setUploading(false);
  };

  const saveSetting = async (key, value) => {
    const existing = settings[key];
    if (existing?.id) {
      await base44.entities.SiteSettings.update(existing.id, { value });
    } else {
      const created = await base44.entities.SiteSettings.create({ key, value });
      setSettings(prev => ({ ...prev, [key]: { id: created.id, value } }));
    }
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], value } }));
    toast({ title: "✅ تم حفظ الإعداد" });
  };

  const getSetting = (key, def = "") => settings[key]?.value ?? def;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">إدارة المحتوى</h1>
        <p className="text-sm text-muted-foreground mt-1">عدّل البانرات وشريط الإعلانات</p>
      </div>

      <Tabs defaultValue="banners">
        <TabsList className="bg-gray-100 rounded-xl mb-6">
          <TabsTrigger value="banners" className="rounded-lg">البانرات</TabsTrigger>
          <TabsTrigger value="announcement" className="rounded-lg">شريط الإعلانات</TabsTrigger>
        </TabsList>

        {/* Banners */}
        <TabsContent value="banners">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">أضف وعدّل بانرات الصفحة الرئيسية</p>
            <Button onClick={openNew} className="gap-2 rounded-xl h-10">
              <Plus className="w-4 h-4" />إضافة بانر
            </Button>
          </div>
          <div className="space-y-3">
            {banners.map(b => (
              <Card key={b.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-20 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {b.image_url ? <img src={b.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Image className="w-5 h-5" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{b.headline_ar || b.headline || "(بدون عنوان)"}</div>
                    <div className="text-xs text-muted-foreground truncate">{b.subtext_ar}</div>
                  </div>
                  <Switch checked={!!b.is_visible} onCheckedChange={() => toggleBanner(b)} />
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openEdit(b)}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive" onClick={() => deleteBanner(b.id)}><Trash2 className="w-4 h-4" /></Button>
                </CardContent>
              </Card>
            ))}
            {banners.length === 0 && !loading && (
              <div className="p-12 text-center text-muted-foreground">لا توجد بانرات بعد</div>
            )}
          </div>
        </TabsContent>

        {/* Announcement Bar */}
        <TabsContent value="announcement">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-black">شريط الإعلانات (أعلى الصفحة)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <AnnouncementField label="نص الإعلان (عربي)" settingKey="announcement_ar" getSetting={getSetting} saveSetting={saveSetting} dir="rtl" placeholder="مثال: شحن مجاني لجميع أنحاء لبنان 🎉" />
              <AnnouncementField label="نص الإعلان (English)" settingKey="announcement_en" getSetting={getSetting} saveSetting={saveSetting} dir="ltr" placeholder="Free shipping across Lebanon 🎉" />
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <Switch
                  checked={getSetting("announcement_enabled", "true") === "true"}
                  onCheckedChange={v => saveSetting("announcement_enabled", v ? "true" : "false")}
                />
                <span className="font-bold text-sm">تفعيل شريط الإعلانات</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Banner Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="font-black">{editing ? "تعديل البانر" : "إضافة بانر جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-bold">صورة البانر</Label>
              {form.image_url ? (
                <div className="mt-1 relative">
                  <img src={form.image_url} className="w-full h-32 object-cover rounded-xl" />
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => f("image_url", "")}>إزالة</Button>
                </div>
              ) : (
                <label className="cursor-pointer block mt-1">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-sm">{uploading ? "جاري الرفع..." : "رفع صورة البانر"}</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="font-bold">العنوان (عربي)</Label><Input className="mt-1 text-right" value={form.headline_ar} onChange={e => f("headline_ar", e.target.value)} style={{ direction: "rtl" }} /></div>
              <div><Label className="font-bold">العنوان (English)</Label><Input className="mt-1" value={form.headline} onChange={e => f("headline", e.target.value)} style={{ direction: "ltr" }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="font-bold">النص الفرعي (عربي)</Label><Input className="mt-1 text-right" value={form.subtext_ar} onChange={e => f("subtext_ar", e.target.value)} style={{ direction: "rtl" }} /></div>
              <div><Label className="font-bold">النص الفرعي (English)</Label><Input className="mt-1" value={form.subtext} onChange={e => f("subtext", e.target.value)} style={{ direction: "ltr" }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="font-bold">نص الزر (عربي)</Label><Input className="mt-1 text-right" value={form.button_text_ar} onChange={e => f("button_text_ar", e.target.value)} style={{ direction: "rtl" }} /></div>
              <div><Label className="font-bold">نص الزر (English)</Label><Input className="mt-1" value={form.button_text} onChange={e => f("button_text", e.target.value)} style={{ direction: "ltr" }} /></div>
            </div>
            <div>
              <Label className="font-bold">رابط الزر</Label>
              <Input className="mt-1" value={form.link_target} onChange={e => f("link_target", e.target.value)} placeholder="/shop" style={{ direction: "ltr" }} />
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <Switch checked={!!form.is_visible} onCheckedChange={v => f("is_visible", v)} />
              <span className="font-bold text-sm">ظاهر في الصفحة الرئيسية</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={saveBanner} disabled={saving} className="flex-1 rounded-xl font-black">
              {saving ? "جاري الحفظ..." : "💾 حفظ البانر"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementField({ label, settingKey, getSetting, saveSetting, dir, placeholder }) {
  const [val, setVal] = useState(getSetting(settingKey, ""));
  useEffect(() => { setVal(getSetting(settingKey, "")); }, [settingKey]);
  return (
    <div>
      <Label className="font-bold">{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input value={val} onChange={e => setVal(e.target.value)} style={{ direction: dir }} className={dir === "rtl" ? "text-right" : ""} placeholder={placeholder} />
        <Button onClick={() => saveSetting(settingKey, val)} className="rounded-xl flex-shrink-0">حفظ</Button>
      </div>
    </div>
  );
}