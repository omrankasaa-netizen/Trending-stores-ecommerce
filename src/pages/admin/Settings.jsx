import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Image, ChevronDown, ChevronUp } from "lucide-react";

const SETTINGS_KEYS = [
  "store_name", "store_name_ar", "whatsapp_number", "facebook_url",
  "address", "address_ar", "delivery_fee", "delivery_coverage_ar", "delivery_coverage_en",
  "admin_emails", "logo_url",
];

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.SiteSettings.list("-created_date", 100).then(items => {
      const map = {};
      items.forEach(item => { map[item.key] = { id: item.id, value: item.value }; });
      setSettings(map);
      const formData = {};
      SETTINGS_KEYS.forEach(k => { formData[k] = map[k]?.value ?? ""; });
      setForm(formData);
    }).finally(() => setLoading(false));
  }, []);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(form)) {
      const existing = settings[key];
      if (existing?.id) {
        await base44.entities.SiteSettings.update(existing.id, { value });
      } else {
        const created = await base44.entities.SiteSettings.create({ key, value });
        setSettings(prev => ({ ...prev, [key]: { id: created.id, value } }));
      }
    }
    toast({ title: "✅ تم حفظ الإعدادات بنجاح" });
    setSaving(false);
  };

  const uploadLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("logo_url", file_url);
    setUploading(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>جاري التحميل...</div>;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إعدادات المتجر والتوصيل</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Store Profile */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">معلومات المتجر</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <Label className="font-bold">شعار المتجر (Logo)</Label>
              <div className="flex items-center gap-3 mt-2">
                {form.logo_url ? (
                  <img src={form.logo_url} className="w-16 h-16 rounded-xl object-contain bg-gray-50 border border-gray-100" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                    <span className="font-black text-primary">TS</span>
                  </div>
                )}
                <label className="cursor-pointer">
                  <div className="border border-dashed border-gray-200 rounded-xl px-4 py-2 text-sm hover:border-primary hover:bg-primary/5 transition-colors">
                    {uploading ? "جاري الرفع..." : "رفع شعار جديد"}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">اسم المتجر (عربي)</Label>
                <Input className="mt-1 text-right" value={form.store_name_ar} onChange={e => f("store_name_ar", e.target.value)} style={{ direction: "rtl" }} />
              </div>
              <div>
                <Label className="font-bold">Store Name (English)</Label>
                <Input className="mt-1" value={form.store_name} onChange={e => f("store_name", e.target.value)} style={{ direction: "ltr" }} />
              </div>
            </div>

            <div>
              <Label className="font-bold">رقم واتساب</Label>
              <Input className="mt-1" value={form.whatsapp_number} onChange={e => f("whatsapp_number", e.target.value)}
                placeholder="مثال: 96181751841" style={{ direction: "ltr" }} />
              <p className="text-xs text-muted-foreground mt-1">بدون + وبدون مسافات. مثال: 96181751841</p>
            </div>

            <div>
              <Label className="font-bold">رابط فيسبوك</Label>
              <Input className="mt-1" value={form.facebook_url} onChange={e => f("facebook_url", e.target.value)}
                placeholder="https://facebook.com/..." style={{ direction: "ltr" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">العنوان (عربي)</Label>
                <Input className="mt-1 text-right" value={form.address_ar} onChange={e => f("address_ar", e.target.value)} style={{ direction: "rtl" }} />
              </div>
              <div>
                <Label className="font-bold">Address (English)</Label>
                <Input className="mt-1" value={form.address} onChange={e => f("address", e.target.value)} style={{ direction: "ltr" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">التوصيل</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-bold">رسوم التوصيل ($)</Label>
              <Input className="mt-1 w-32" type="number" value={form.delivery_fee} onChange={e => f("delivery_fee", e.target.value)} placeholder="مثال: 3000 = $3" />
            </div>
            <div>
              <Label className="font-bold">منطقة التغطية (عربي)</Label>
              <Input className="mt-1 text-right" value={form.delivery_coverage_ar} onChange={e => f("delivery_coverage_ar", e.target.value)}
                style={{ direction: "rtl" }} placeholder="مثال: جميع مناطق لبنان" />
            </div>
            <div>
              <Label className="font-bold">Coverage Area (English)</Label>
              <Input className="mt-1" value={form.delivery_coverage_en} onChange={e => f("delivery_coverage_en", e.target.value)}
                style={{ direction: "ltr" }} placeholder="e.g. All of Lebanon" />
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">إعدادات البريد الإلكتروني</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-bold">بريد المشرف (للإشعارات)</Label>
              <Input className="mt-1" value={form.admin_emails} onChange={e => f("admin_emails", e.target.value)}
                style={{ direction: "ltr" }} placeholder="email1@example.com, email2@example.com" />
              <p className="text-xs text-muted-foreground mt-1">يمكن إضافة أكثر من عنوان مفصولة بفاصلة</p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveAll} disabled={saving} className="w-full h-12 font-black text-base rounded-xl">
          {saving ? "جاري الحفظ..." : "💾 حفظ جميع الإعدادات"}
        </Button>
      </div>
    </div>
  );
}