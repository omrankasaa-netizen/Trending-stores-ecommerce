import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, ChevronRight, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const STATUS_COLORS = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-orange-50 text-orange-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_AR = {
  pending: "قيد الانتظار", confirmed: "مؤكد", processing: "قيد التجهيز",
  shipped: "تم الشحن", delivered: "تم التوصيل", cancelled: "ملغى",
};

function statusLabel(status, lang) {
  const key = String(status || "pending").toLowerCase();
  return lang === "ar" ? (STATUS_AR[key] || status) : status;
}

function OrderDetailModal({ order, onClose, t, isRTL, lang }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const key = String(order.status || "pending").toLowerCase();
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose} style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-black text-foreground">#{order.order_number}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[key] || "bg-muted text-muted-foreground"}`}>
              {statusLabel(order.status, lang)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("Items", "المنتجات")}</h4>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm gap-2 bg-muted/40 px-3 py-2 rounded-xl">
                  <span className="text-foreground flex-1 line-clamp-1">
                    {(isRTL ? item.product_name_ar : item.product_name) || item.product_name} ×{item.quantity}
                  </span>
                  <span className="font-semibold shrink-0">{formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("Subtotal", "المجموع الفرعي")}</span><span>{formatPrice(order.subtotal || 0)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-700"><span>{t("Discount", "الخصم")}</span><span>-{formatPrice(order.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">{t("Delivery", "التوصيل")}</span><span>{formatPrice(order.delivery_fee || 0)}</span></div>
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-1.5"><span>{t("Total", "المجموع")}</span><span>{formatPrice(order.total || 0)}</span></div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t("Delivery Address", "عنوان التوصيل")}</h4>
            <p className="text-sm text-muted-foreground">{[order.customer_city, order.customer_address].filter(Boolean).join(", ")}</p>
            {order.customer_phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{order.customer_phone}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderHistoryPage() {
  const { t, isRTL, lang } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => base44.functions.getMyOrders(),
    enabled: isAuthenticated,
  });
  const orders = data?.orders || [];
  const fontStyle = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-foreground flex items-center gap-2" style={fontStyle}>
        <ShoppingBag className="w-6 h-6 text-primary" /> {t("My Orders", "طلباتي")}
      </h1>
      {isLoading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}</div>}
      {!isLoading && orders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground" style={fontStyle}>
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t("No orders yet.", "لا توجد طلبات حتى الآن.")}</p>
        </div>
      )}
      {orders.map((order) => {
        const key = String(order.status || "pending").toLowerCase();
        return (
          <button key={order.id} onClick={() => setSelected(order)}
            className="w-full bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow text-left group" style={{ direction: isRTL ? "rtl" : "ltr" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-foreground text-sm">#{order.order_number}</p>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[key] || "bg-muted text-muted-foreground"}`}>
                    {statusLabel(order.status, lang)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.created_date ? new Date(order.created_date).toLocaleDateString() : "—"} · {formatPrice(order.total || 0)}
                </p>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ${isRTL ? "rotate-180" : ""}`} />
            </div>
          </button>
        );
      })}
      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} t={t} isRTL={isRTL} lang={lang} />}
    </div>
  );
}
