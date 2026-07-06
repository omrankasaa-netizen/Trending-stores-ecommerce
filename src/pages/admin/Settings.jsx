import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

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
  const [markupPct, setMarkupPct] = useState("");
  const { toast } = useToast();
  const { t, dir } = useAdminLanguage();

  useEffect(() => {
    base44.entities.SiteSettings.list("-created_date", 100).then(items => {
      const map = {};
      items.forEach(item => { map[item.key] = { id: item.id, value: item.value }; });
      setSettings(map);
      const formData = {};
      SETTINGS_KEYS.forEach(k => { formData[k] = map[k]?.value ?? ""; });
      setForm(formData);
    }).finally(() => setLoading(false));
    // Hidden price markup lives in the kv store, not SiteSettings.
    base44.functions.getMarkupConfig().then((cfg) => {
      setMarkupPct(cfg?.global_pct != null ? String(cfg.global_pct) : "");
    }).catch(() => {});
  }, []);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const saveAll = async () => {
    // Reject negative / non-numeric delivery fee and markup before saving.
    if (form.delivery_fee !== "" && form.delivery_fee != null) {
      const fee = Number(form.delivery_fee);
      if (!Number.isFinite(fee) || fee < 0) {
        toast({ title: t("Delivery fee must be a valid number (0 or more)", "رسوم التوصيل يجب أن تكون رقماً صحيحاً (0 أو أكثر)"), variant: "destructive" });
        return;
      }
    }
    if (markupPct !== "" && markupPct != null) {
      const m = Number(markupPct);
      if (!Number.isFinite(m) || m < 0) {
        toast({ title: t("Markup must be a valid percentage (0 or more)", "نسبة الربح يجب أن تكون رقماً صحيحاً (0 أو أكثر)"), variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = settings[key];
        if (existing?.id) {
          await base44.entities.SiteSettings.update(existing.id, { value });
        } else {
          const created = await base44.entities.SiteSettings.create({ key, value });
          setSettings(prev => ({ ...prev, [key]: { id: created.id, value } }));
        }
      }
      // Persist the hidden global markup (reversible; base prices are never mutated).
      await base44.functions.saveMarkupConfig({ global_pct: markupPct === "" ? 0 : Number(markupPct) });
      toast({ title: t("✅ Settings saved successfully", "✅ تم حفظ الإعدادات بنجاح") });
    } catch (err) {
      toast({ title: t("Failed to save settings", "تعذّر حفظ الإعدادات"), description: err?.message || "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      f("logo_url", file_url);
    } catch (err) {
      toast({ title: t("Failed to upload logo", "تعذّر رفع الشعار"), description: err?.message || "", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("Loading...", "جاري التحميل...")}</div>;

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">{t("Settings", "الإعدادات")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("Store and delivery settings", "إعدادات المتجر والتوصيل")}</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Store Profile */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">{t("Store Information", "معلومات المتجر")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <Label className="font-bold">{t("Store Logo", "شعار المتجر (Logo)")}</Label>
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
                    {uploading ? t("Uploading...", "جاري الرفع...") : t("Upload new logo", "رفع شعار جديد")}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">{t("Store Name (Arabic)", "اسم المتجر (عربي)")}</Label>
                <Input className="mt-1 text-right" value={form.store_name_ar} onChange={e => f("store_name_ar", e.target.value)} style={{ direction: "rtl" }} />
              </div>
              <div>
                <Label className="font-bold">{t("Store Name (English)", "Store Name (English)")}</Label>
                <Input className="mt-1" value={form.store_name} onChange={e => f("store_name", e.target.value)} style={{ direction: "ltr" }} />
              </div>
            </div>

            <div>
              <Label className="font-bold">{t("WhatsApp Number", "رقم واتساب")}</Label>
              <Input className="mt-1" value={form.whatsapp_number} onChange={e => f("whatsapp_number", e.target.value)}
                placeholder={t("e.g. 96181751841", "مثال: 96181751841")} style={{ direction: "ltr" }} />
              <p className="text-xs text-muted-foreground mt-1">{t("No + and no spaces. Example: 96181751841", "بدون + وبدون مسافات. مثال: 96181751841")}</p>
            </div>

            <div>
              <Label className="font-bold">{t("Facebook URL", "رابط فيسبوك")}</Label>
              <Input className="mt-1" value={form.facebook_url} onChange={e => f("facebook_url", e.target.value)}
                placeholder="https://facebook.com/..." style={{ direction: "ltr" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">{t("Address (Arabic)", "العنوان (عربي)")}</Label>
                <Input className="mt-1 text-right" value={form.address_ar} onChange={e => f("address_ar", e.target.value)} style={{ direction: "rtl" }} />
              </div>
              <div>
                <Label className="font-bold">{t("Address (English)", "Address (English)")}</Label>
                <Input className="mt-1" value={form.address} onChange={e => f("address", e.target.value)} style={{ direction: "ltr" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">{t("Delivery", "التوصيل")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-bold">{t("Delivery Fee ($)", "رسوم التوصيل ($)")}</Label>
              <Input className="mt-1 w-32" type="number" value={form.delivery_fee} onChange={e => f("delivery_fee", e.target.value)} placeholder={t("e.g. 3 ($)", "مثال: 3 ($)")} />
            </div>
            <div>
              <Label className="font-bold">{t("Coverage Area (Arabic)", "منطقة التغطية (عربي)")}</Label>
              <Input className="mt-1 text-right" value={form.delivery_coverage_ar} onChange={e => f("delivery_coverage_ar", e.target.value)}
                style={{ direction: "rtl" }} placeholder={t("e.g. All regions of Lebanon", "مثال: جميع مناطق لبنان")} />
            </div>
            <div>
              <Label className="font-bold">{t("Coverage Area (English)", "Coverage Area (English)")}</Label>
              <Input className="mt-1" value={form.delivery_coverage_en} onChange={e => f("delivery_coverage_en", e.target.value)}
                style={{ direction: "ltr" }} placeholder="e.g. All of Lebanon" />
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">{t("Email Settings", "إعدادات البريد الإلكتروني")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-bold">{t("Admin email (for notifications)", "بريد المشرف (للإشعارات)")}</Label>
              <Input className="mt-1" value={form.admin_emails} onChange={e => f("admin_emails", e.target.value)}
                style={{ direction: "ltr" }} placeholder="email1@example.com, email2@example.com" />
              <p className="text-xs text-muted-foreground mt-1">{t("You can add multiple addresses separated by commas", "يمكن إضافة أكثر من عنوان مفصولة بفاصلة")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Hidden Price Markup */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-black">{t("Hidden Price Markup", "هامش الربح المخفي")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="font-bold">{t("Global markup (%)", "نسبة الربح العامة (%)")}</Label>
              <Input className="mt-1 w-32" type="number" min="0" value={markupPct} onChange={e => setMarkupPct(e.target.value)} placeholder={t("e.g. 10", "مثال: 10")} />
              <p className="text-xs text-muted-foreground mt-1">
                {t("A hidden percentage added on top of every product price across the store (listing, product page, cart, checkout). Customers never see it. Base prices are never changed, so set back to 0 to remove it. A per-product override can be set in the product editor.", "نسبة مخفية تُضاف فوق سعر كل منتج في المتجر (القوائم، صفحة المنتج، السلة، الدفع). لا يراها العملاء. الأسعار الأساسية لا تتغير، لذا أعِدها إلى 0 لإلغائها. يمكن تحديد نسبة خاصة لكل منتج من محرر المنتجات.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveAll} disabled={saving} className="w-full h-12 font-black text-base rounded-xl">
          {saving ? t("Saving...", "جاري الحفظ...") : t("💾 Save all settings", "💾 حفظ جميع الإعدادات")}
        </Button>
      </div>
    </div>
  );
}
