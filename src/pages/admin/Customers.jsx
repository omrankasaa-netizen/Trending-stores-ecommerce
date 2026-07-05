import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Users, Download, MessageCircle, Search } from "lucide-react";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const { t, isRTL, dir } = useAdminLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    base44.functions.listCustomers()
      .then((res) => setCustomers(res?.customers || []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = async () => {
    try {
      const res = await base44.functions.exportCustomersCsv();
      if (res?.csv) downloadCsv(res.filename, res.csv);
    } catch (e) {
      toast({ title: t("Export failed", "تعذّر التصدير"), description: e?.data?.error || e?.message, variant: "destructive" });
    }
  };

  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? customers.filter((c) =>
        (c.name || "").toLowerCase().includes(ql) ||
        (c.phone || "").includes(ql) ||
        (c.email || "").toLowerCase().includes(ql))
    : customers;

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black">{t("Customers", "العملاء")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t(`${customers.length} customers — derived from orders`, `${customers.length} عميل — مُستخرَج من الطلبات`)}</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className={`w-4 h-4 ${isRTL ? "ml-1" : "mr-1"}`} /> {t("Export CSV", "تصدير CSV")}
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className={`w-4 h-4 absolute top-3 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
        <Input placeholder={t("Search by name, phone, or email", "ابحث بالاسم أو الهاتف أو الإيميل")} value={q} onChange={(e) => setQ(e.target.value)} className={isRTL ? "pr-9" : "pl-9"} style={{ direction: isRTL ? "rtl" : "ltr" }} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-bold">{t("No customers yet", "لا يوجد عملاء بعد")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <div key={c.key} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{c.name || c.phone || c.email}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{c.phone} {c.email ? `· ${c.email}` : ""}</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    <div className="font-bold text-foreground">{c.orders_count}</div>
                    <div>{t("orders", "طلب")}</div>
                  </div>
                  {c.total_spent != null && (
                    <div className="text-xs text-muted-foreground text-center">
                      <div className="font-bold text-foreground">${Number(c.total_spent).toLocaleString("en-US")}</div>
                      <div>{t("total", "إجمالي")}</div>
                    </div>
                  )}
                  {c.phone && (
                    <a href={`https://wa.me/${String(c.phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
