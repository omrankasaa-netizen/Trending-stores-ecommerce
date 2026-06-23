import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Lock, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
  const { user, checkUserAuth } = useAuth();
  const { t, isRTL } = useLanguage();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name || "", phone: user.phone || "" });
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await base44.auth.updateMe({ full_name: form.full_name, phone: form.phone });
      await checkUserAuth();
      setMsg(t("Profile updated!", "تم تحديث الملف الشخصي!"));
    } catch {
      setMsg(t("Failed to save.", "فشل الحفظ."));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (pwForm.newPassword.length < 8) {
      setPwErr(t("New password must be at least 8 characters.", "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل."));
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwErr(t("New passwords do not match.", "كلمتا المرور غير متطابقتين."));
      return;
    }
    setPwSaving(true);
    try {
      await base44.auth.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwMsg(t("Password changed successfully.", "تم تغيير كلمة المرور بنجاح."));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwMsg(""), 4000);
    } catch (err) {
      const map = {
        "Current password is incorrect": t("Current password is incorrect.", "كلمة المرور الحالية غير صحيحة."),
        "New password must be different from the current password": t("New password must be different from the current one.", "يجب أن تختلف كلمة المرور الجديدة عن الحالية."),
      };
      setPwErr(map[err?.message] || err?.message || t("Could not change password.", "تعذّر تغيير كلمة المرور."));
    } finally {
      setPwSaving(false);
    }
  };

  const fontStyle = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-foreground flex items-center gap-2" style={fontStyle}>
        <User className="w-6 h-6 text-primary" /> {t("My Profile", "ملفي الشخصي")}
      </h1>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label style={fontStyle}>{t("Full Name", "الاسم الكامل")}</Label>
            <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="mt-1.5 h-11 rounded-xl" style={fontStyle} />
          </div>
          <div>
            <Label style={fontStyle}>{t("Phone", "الهاتف")}</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} type="tel" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label style={fontStyle}>{t("Email", "البريد الإلكتروني")}</Label>
            <Input value={user?.email || ""} disabled className="mt-1.5 h-11 rounded-xl bg-muted text-muted-foreground" dir="ltr" />
          </div>
          {msg && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg" style={fontStyle}>{msg}</p>}
          <Button type="submit" disabled={saving} className="rounded-xl gap-2 font-bold" style={fontStyle}>
            <Save className="w-4 h-4" /> {saving ? t("Saving…", "جارٍ الحفظ…") : t("Save Changes", "حفظ التغييرات")}
          </Button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground" style={fontStyle}>{t("Change Password", "تغيير كلمة المرور")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4" style={fontStyle}>
          {t("Enter your current password and choose a new one.", "أدخل كلمة المرور الحالية واختر كلمة مرور جديدة.")}
        </p>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <Label style={fontStyle}>{t("Current Password", "كلمة المرور الحالية")}</Label>
            <Input type={showPw ? "text" : "password"} autoComplete="current-password" value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} className="mt-1.5 h-11 rounded-xl" required />
          </div>
          <div>
            <Label style={fontStyle}>{t("New Password", "كلمة المرور الجديدة")}</Label>
            <Input type={showPw ? "text" : "password"} autoComplete="new-password" value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="mt-1.5 h-11 rounded-xl" minLength={8} required />
          </div>
          <div>
            <Label style={fontStyle}>{t("Confirm New Password", "تأكيد كلمة المرور الجديدة")}</Label>
            <Input type={showPw ? "text" : "password"} autoComplete="new-password" value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className="mt-1.5 h-11 rounded-xl" minLength={8} required />
          </div>
          <button type="button" onClick={() => setShowPw((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" style={fontStyle}>
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPw ? t("Hide passwords", "إخفاء كلمات المرور") : t("Show passwords", "إظهار كلمات المرور")}
          </button>
          {pwErr && <p className="text-xs text-destructive" style={fontStyle}>{pwErr}</p>}
          {pwMsg && <p className="text-xs text-emerald-600" style={fontStyle}>{pwMsg}</p>}
          <Button type="submit" disabled={pwSaving} className="rounded-xl font-bold" style={fontStyle}>
            {pwSaving ? t("Saving...", "جارٍ الحفظ...") : t("Update Password", "تحديث كلمة المرور")}
          </Button>
        </form>
      </div>
    </div>
  );
}
