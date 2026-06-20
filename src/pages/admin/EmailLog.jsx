import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, XCircle, Clock } from "lucide-react";

// EmailLog reads from a local key we'd write on email send
// For now show placeholder + explain to user
const TYPE_LABELS = {
  order_confirmation: "تأكيد الطلب",
  status_update: "تحديث الحالة",
  new_order_alert: "إشعار طلب جديد",
  welcome: "ترحيب",
};

export default function AdminEmailLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read from localStorage (written by email functions)
    try {
      const stored = JSON.parse(localStorage.getItem("ts_email_log") || "[]");
      setLogs(stored.reverse());
    } catch {}
    setLoading(false);
  }, []);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black">سجل الإيميلات</h1>
        <p className="text-sm text-muted-foreground mt-1">كل الإيميلات التي أرسلها المتجر</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-bold">لا توجد إيميلات مُرسلة بعد</p>
              <p className="text-xs text-muted-foreground mt-1">سيظهر هنا سجل الإيميلات بعد تفعيل إشعارات الطلبات</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 ${log.status === "sent" ? "text-green-500" : "text-red-500"}`}>
                    {log.status === "sent" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${log.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {log.status === "sent" ? "تم الإرسال" : "فشل"}
                      </Badge>
                      <span className="text-xs font-bold">{TYPE_LABELS[log.type] || log.type}</span>
                    </div>
                    <div className="text-sm font-bold mt-0.5 truncate">{log.subject}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{log.recipient}</div>
                    {log.error && <div className="text-xs text-red-500 mt-1 bg-red-50 rounded-lg px-2 py-1">{log.error}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {log.sent_at ? new Date(log.sent_at).toLocaleString("ar-LB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}