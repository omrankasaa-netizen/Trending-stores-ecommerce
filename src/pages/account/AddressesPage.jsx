import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Pencil, Trash2, Star, X } from "lucide-react";

const EMPTY = { label: "", full_name: "", phone: "", city: "", address: "", notes: "", is_default: false };

function AddressModal({ address, onClose, onSaved, t, isRTL }) {
  const [form, setForm] = useState(address ? { ...EMPTY, ...address } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const fontStyle = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const payload = {
        label: form.label, full_name: form.full_name, phone: form.phone,
        city: form.city, address: form.address, notes: form.notes, is_default: form.is_default,
      };
      if (address?.id) payload.id = address.id;
      await base44.functions.saveMyAddress(payload);
      onSaved();
      onClose();
    } catch (e2) {
      setErr(e2?.message || t("Could not save address.", "تعذّر حفظ العنوان."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose} style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-black text-foreground" style={fontStyle}>{address?.id ? t("Edit Address", "تعديل العنوان") : t("New Address", "عنوان جديد")}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-3">
          <div>
            <Label style={fontStyle}>{t("Label (e.g. Home, Work)", "التسمية (مثل المنزل، العمل)")}</Label>
            <Input value={form.label} onChange={(e) => setF("label", e.target.value)} className="mt-1.5 h-11 rounded-xl" style={fontStyle} />
          </div>
          <div>
            <Label style={fontStyle}>{t("Full Name *", "الاسم الكامل *")}</Label>
            <Input required value={form.full_name} onChange={(e) => setF("full_name", e.target.value)} className="mt-1.5 h-11 rounded-xl" style={fontStyle} />
          </div>
          <div>
            <Label style={fontStyle}>{t("Phone", "الهاتف")}</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setF("phone", e.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label style={fontStyle}>{t("City *", "المدينة *")}</Label>
            <Input required value={form.city} onChange={(e) => setF("city", e.target.value)} className="mt-1.5 h-11 rounded-xl" style={fontStyle} placeholder={t("e.g. Tripoli, Beirut...", "مثال: طرابلس، بيروت...")} />
          </div>
          <div>
            <Label style={fontStyle}>{t("Full Address *", "العنوان الكامل *")}</Label>
            <Input required value={form.address} onChange={(e) => setF("address", e.target.value)} className="mt-1.5 h-11 rounded-xl" style={fontStyle} />
          </div>
          <div>
            <Label style={fontStyle}>{t("Notes", "ملاحظات")}</Label>
            <Input value={form.notes} onChange={(e) => setF("notes", e.target.value)} className="mt-1.5 h-11 rounded-xl" style={fontStyle} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setF("is_default", e.target.checked)} className="rounded" />
            <span className="text-sm" style={fontStyle}>{t("Set as default address", "تعيين كعنوان افتراضي")}</span>
          </label>
          {err && <p className="text-xs text-destructive" style={fontStyle}>{err}</p>}
          <Button type="submit" disabled={saving} className="w-full rounded-xl font-bold" style={fontStyle}>
            {saving ? t("Saving…", "جارٍ الحفظ…") : t("Save Address", "حفظ العنوان")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AddressesPage() {
  const { t, isRTL } = useLanguage();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'new' | address object

  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => base44.functions.listMyAddresses(),
    enabled: isAuthenticated,
  });
  const addresses = data?.addresses || [];
  const fontStyle = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-addresses"] });

  const deleteAddr = async (id) => {
    await base44.functions.deleteMyAddress({ id });
    refresh();
  };

  const setDefault = async (addr) => {
    await base44.functions.saveMyAddress({ id: addr.id, is_default: true });
    refresh();
  };

  return (
    <div className="space-y-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2" style={fontStyle}>
          <MapPin className="w-6 h-6 text-primary" /> {t("Saved Addresses", "العناوين المحفوظة")}
        </h1>
        <Button onClick={() => setModal("new")} className="rounded-xl gap-1.5 font-bold" style={fontStyle}>
          <Plus className="w-4 h-4" /> {t("Add", "إضافة")}
        </Button>
      </div>
      {isLoading && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}</div>}
      {!isLoading && addresses.length === 0 && (
        <div className="text-center py-16 text-muted-foreground" style={fontStyle}>
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t("No addresses saved yet.", "لا توجد عناوين محفوظة.")}</p>
        </div>
      )}
      {addresses.map((addr) => (
        <div key={addr.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-bold text-foreground text-sm" style={fontStyle}>{addr.full_name}</p>
                {addr.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full" style={fontStyle}>{addr.label}</span>}
                {addr.is_default && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium" style={fontStyle}>{t("Default", "افتراضي")}</span>}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={fontStyle}>
                {[addr.city, addr.address].filter(Boolean).join(", ")}
              </p>
              {addr.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{addr.phone}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              {!addr.is_default && (
                <button onClick={() => setDefault(addr)} title={t("Set default", "تعيين كافتراضي")}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setModal(addr)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => deleteAddr(addr.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {modal && (
        <AddressModal
          address={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
          t={t}
          isRTL={isRTL}
        />
      )}
    </div>
  );
}
