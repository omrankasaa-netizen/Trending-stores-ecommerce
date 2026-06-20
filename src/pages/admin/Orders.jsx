import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const STATUS_CONFIG = {
  pending:    { label: "في الانتظار",  color: "bg-yellow-100 text-yellow-800" },
  confirmed:  { label: "مؤكد",        color: "bg-blue-100 text-blue-800" },
  processing: { label: "قيد التجهيز", color: "bg-purple-100 text-purple-800" },
  shipped:    { label: "في الطريق",   color: "bg-indigo-100 text-indigo-800" },
  delivered:  { label: "تم التسليم",  color: "bg-green-100 text-green-800" },
  cancelled:  { label: "ملغي",        color: "bg-red-100 text-red-800" },
  returned:   { label: "مُعاد",        color: "bg-gray-100 text-gray-700" },
};

function formatPrice(p) {
  return `$${(Number(p) || 0).toLocaleString("en-US")}`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ar-LB", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const navigate = useNavigate();

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
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} طلب إجمالاً</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو الهاتف أو رقم الطلب..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 text-right rounded-xl text-sm"
              style={{ direction: "rtl" }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[["all", "الكل"], ...Object.entries(STATUS_CONFIG).map(([v, c]) => [v, c.label])].map(([val, label]) => (
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
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد طلبات</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(order => {
                const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="w-full px-4 py-4 hover:bg-gray-50 transition-colors text-right flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-primary text-sm">{order.order_number}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="font-bold text-sm">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span dir="ltr">{order.customer_phone}</span>
                        <span>·</span>
                        <span>{order.customer_city}</span>
                        <span>·</span>
                        <span>{(order.items || []).length} منتج</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
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