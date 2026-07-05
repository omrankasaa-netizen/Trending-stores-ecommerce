import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

const STATUS_CONFIG = {
  pending:    { labelAr: "في الانتظار",  labelEn: "Pending",    color: "bg-yellow-100 text-yellow-800" },
  confirmed:  { labelAr: "مؤكد",        labelEn: "Confirmed",   color: "bg-blue-100 text-blue-800" },
  processing: { labelAr: "قيد التجهيز", labelEn: "Preparing",   color: "bg-purple-100 text-purple-800" },
  shipped:    { labelAr: "في الطريق",   labelEn: "Shipping",    color: "bg-indigo-100 text-indigo-800" },
  delivered:  { labelAr: "تم التسليم",  labelEn: "Delivered",   color: "bg-green-100 text-green-800" },
  cancelled:  { labelAr: "ملغي",        labelEn: "Cancelled",   color: "bg-red-100 text-red-800" },
  returned:   { labelAr: "مُعاد",        labelEn: "Returned",    color: "bg-gray-100 text-gray-700" },
};

function formatPrice(p) {
  return `$${(Number(p) || 0).toLocaleString("en-US")}`;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const navigate = useNavigate();
  const { t, lang, isRTL, dir } = useAdminLanguage();

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString(lang === "ar" ? "ar-LB" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  useEffect(() => {
    base44.entities.Order.list("-created_date", 200)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").includes(q);
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">{t("Orders", "الطلبات")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t(`${orders.length} orders total`, `${orders.length} طلب إجمالاً`)}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute top-2.5 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("Search by name, phone, or order number...", "ابحث بالاسم أو الهاتف أو رقم الطلب...")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`rounded-xl text-sm ${isRTL ? "pr-9 text-right" : "pl-9 text-left"}`}
              style={{ direction: isRTL ? "rtl" : "ltr" }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[["all", t("All", "الكل")], ...Object.entries(STATUS_CONFIG).map(([v, c]) => [v, t(c.labelEn, c.labelAr)])].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterStatus === val ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t("No orders", "لا توجد طلبات")}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(order => {
                const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className={`w-full px-4 py-4 hover:bg-gray-50 transition-colors flex items-center gap-4 ${isRTL ? "text-right" : "text-left"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-primary text-sm">{order.order_number}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          {t(sc.labelEn, sc.labelAr)}
                        </span>
                      </div>
                      <div className="font-bold text-sm">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span dir="ltr">{order.customer_phone}</span>
                        <span>·</span>
                        <span>{order.customer_city}</span>
                        <span>·</span>
                        <span>{t(`${(order.items || []).length} items`, `${(order.items || []).length} منتج`)}</span>
                      </div>
                    </div>
                    <div className={`flex-shrink-0 ${isRTL ? "text-right" : "text-left"}`}>
                      <div className="font-black text-lg text-foreground">{formatPrice(order.total)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(order.created_date)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
