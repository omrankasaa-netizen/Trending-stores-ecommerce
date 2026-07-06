import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

// Bilingual labels for each ledger reason/type.
const REASON_LABELS = {
  sale: { en: "Sale", ar: "بيع" },
  cancel_restock: { en: "Cancel Restock", ar: "إرجاع (إلغاء)" },
  manual_adjust: { en: "Manual Adjust", ar: "تعديل يدوي" },
  initial: { en: "Initial / Import", ar: "رصيد ابتدائي" },
};

const REASON_STYLES = {
  sale: "bg-red-100 text-red-700",
  cancel_restock: "bg-green-100 text-green-700",
  manual_adjust: "bg-amber-100 text-amber-700",
  initial: "bg-blue-100 text-blue-700",
};

function formatWhen(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminStockHistory() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const { t, dir, isRTL } = useAdminLanguage();

  useEffect(() => {
    // Newest first; generous limit for an audit log.
    base44.entities.StockMovement.list("-at", 2000)
      .then((rows) => setMovements(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    return movements.filter((m) => {
      if (reasonFilter && m.reason !== reasonFilter) return false;
      if (q) {
        const hay = `${m.product_name || ""} ${m.product_name_ar || ""} ${m.size_label || ""} ${m.reference || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movements, productFilter, reasonFilter]);

  const reasonLabel = (r) => (REASON_LABELS[r] ? t(REASON_LABELS[r].en, REASON_LABELS[r].ar) : r);

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center gap-2">
        <History className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black">{t("Stock History", "سجل حركة المخزون")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Every stock change — read-only audit log", "كل تغيير في المخزون — سجل تدقيق للقراءة فقط")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder={t("Filter by product, size or reference...", "تصفية حسب المنتج أو المقاس أو المرجع...")}
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-xl sm:max-w-xs"
          style={isRTL ? { direction: "rtl" } : { direction: "ltr" }}
        />
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:max-w-[220px]"
        >
          <option value="">{t("All reasons", "كل الأسباب")}</option>
          {Object.keys(REASON_LABELS).map((r) => (
            <option key={r} value={r}>{reasonLabel(r)}</option>
          ))}
        </select>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 font-bold">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-bold">{t("No stock movements yet", "لا توجد حركات مخزون بعد")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground bg-gray-50">
                    <th className={`px-4 py-2 ${isRTL ? "text-right" : "text-left"} font-bold`}>{t("Date", "التاريخ")}</th>
                    <th className={`px-4 py-2 ${isRTL ? "text-right" : "text-left"} font-bold`}>{t("Product", "المنتج")}</th>
                    <th className={`px-4 py-2 ${isRTL ? "text-right" : "text-left"} font-bold`}>{t("Size", "المقاس")}</th>
                    <th className="px-4 py-2 text-center font-bold">{t("Change", "التغيير")}</th>
                    <th className="px-4 py-2 text-center font-bold">{t("Balance", "الرصيد")}</th>
                    <th className={`px-4 py-2 ${isRTL ? "text-right" : "text-left"} font-bold`}>{t("Reason", "السبب")}</th>
                    <th className={`px-4 py-2 ${isRTL ? "text-right" : "text-left"} font-bold`}>{t("Reference", "المرجع")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((m) => {
                    const name = isRTL ? (m.product_name_ar || m.product_name) : (m.product_name || m.product_name_ar);
                    const up = Number(m.delta) >= 0;
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground" dir="ltr">{formatWhen(m.at || m.created_date)}</td>
                        <td className="px-4 py-2.5 font-semibold">{name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{m.size_label || "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 font-bold ${up ? "text-green-600" : "text-red-600"}`}>
                            {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {up ? "+" : ""}{Number(m.delta) || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold">{m.balance == null ? "—" : m.balance}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={`text-xs ${REASON_STYLES[m.reason] || "bg-gray-100 text-gray-700"}`}>
                            {reasonLabel(m.reason)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground" dir="ltr">{m.reference || m.actor || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
