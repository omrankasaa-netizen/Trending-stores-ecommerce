import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

const ACTION_LABELS = {
  role_changed: "تغيير صلاحية",
  customer_blocked: "حظر عميل",
  customer_unblocked: "رفع حظر",
  customer_updated: "تعديل عميل",
  customer_created: "إضافة عميل",
};

function formatWhen(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.listAuditLog({ limit: 500 })
      .then((res) => setLogs(res?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center gap-2">
        <ScrollText className="w-6 h-6 text-amber-600" />
        <div>
          <h1 className="text-2xl font-black">سجل التدقيق</h1>
          <p className="text-sm text-muted-foreground mt-1">سجل الإجراءات الحساسة — للمالك فقط</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <ScrollText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-bold">لا توجد إجراءات مسجّلة بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs bg-amber-100 text-amber-700">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.entity}</span>
                    </div>
                    {log.details && <div className="text-sm mt-1" dir="ltr">{log.details}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {log.user_name} · {formatWhen(log.created_at)}
                    </div>
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
