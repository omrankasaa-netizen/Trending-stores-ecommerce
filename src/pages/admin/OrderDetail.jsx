import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, MessageCircle, Printer, Phone } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];
const STATUS_CONFIG = {
  pending:    { labelAr: "في الانتظار",  labelEn: "Pending",    color: "bg-yellow-100 text-yellow-800", next: "confirmed" },
  confirmed:  { labelAr: "مؤكد",        labelEn: "Confirmed",   color: "bg-blue-100 text-blue-800",    next: "processing" },
  processing: { labelAr: "قيد التجهيز", labelEn: "Preparing",   color: "bg-purple-100 text-purple-800", next: "shipped" },
  shipped:    { labelAr: "في الطريق",   labelEn: "Shipping",    color: "bg-indigo-100 text-indigo-800", next: "delivered" },
  delivered:  { labelAr: "تم التسليم",  labelEn: "Delivered",   color: "bg-green-100 text-green-800",   next: null },
  cancelled:  { labelAr: "ملغي",        labelEn: "Cancelled",   color: "bg-red-100 text-red-800",       next: null },
  returned:   { labelAr: "مُعاد",        labelEn: "Returned",    color: "bg-gray-100 text-gray-700",    next: null },
};
const NEXT_LABEL = {
  pending:    { ar: "تأكيد الطلب ✓",    en: "Confirm Order ✓" },
  confirmed:  { ar: "بدء التجهيز 📦",    en: "Start Preparing 📦" },
  processing: { ar: "إرسال للتوصيل 🚚",  en: "Send for Delivery 🚚" },
  shipped:    { ar: "تم التسليم ✅",     en: "Mark as Delivered ✅" },
};

// Customer-facing WhatsApp message — kept in Arabic since the store's customers are Arabic-speaking.
function buildWhatsAppMsg(order) {
  const itemsText = (order.items || []).map(i => `- ${i.product_name_ar || i.product_name} ×${i.quantity}`).join("\n");
  const msg = `مرحباً ${order.customer_name}! 🎉\n\nطلبك رقم ${order.order_number} من متجر ترندينج ستور:\n\n${itemsText}\n\nالمجموع: ${formatPrice(order.total)} (دفع عند الاستلام)\n\nشكراً لثقتك بنا! 💙`;
  return `https://wa.me/${(order.customer_phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
}

// Printed packing slip for the local delivery courier — kept in Arabic.
function buildPackingSlip(order) {
  const items = (order.items || []).map(i =>
    `<tr><td>${i.product_name_ar || i.product_name}</td><td>${i.quantity}</td><td>${formatPrice(i.price * i.quantity)}</td></tr>`
  ).join("");
  return `
    <html><body dir="rtl" style="font-family:'Cairo',sans-serif;padding:24px;max-width:600px">
    <h2 style="color:#127a8a">طلب توصيل - متجر ترندينج ستور</h2>
    <p><b>رقم الطلب:</b> ${order.order_number}</p>
    <p><b>الاسم:</b> ${order.customer_name}</p>
    <p><b>الهاتف:</b> <span dir="ltr">${order.customer_phone}</span></p>
    <p><b>العنوان:</b> ${order.customer_address}, ${order.customer_city}</p>
    ${order.customer_notes ? `<p><b>ملاحظات:</b> ${order.customer_notes}</p>` : ""}
    <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead>
    <tbody>${items}</tbody>
    </table>
    <p style="font-size:18px;margin-top:16px"><b>المبلغ المطلوب تحصيله (نقداً): ${formatPrice(order.total)}</b></p>
    </body></html>`;
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, lang, isRTL, dir } = useAdminLanguage();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    base44.entities.Order.filter({ id }).then(([o]) => { setOrder(o); }).finally(() => setLoading(false));
  }, [id]);

  const notifyStatus = (orderId, status) => {
    // Customer status emails are best-effort; the server skips when no email is on file.
    base44.functions.sendOrderStatusUpdate({ order_id: orderId, new_status: status }).catch(() => {});
  };

  const advanceStatus = async () => {
    const next = STATUS_CONFIG[order.status]?.next;
    if (!next) return;
    setUpdating(true);
    const updated = await base44.entities.Order.update(order.id, { status: next });
    setOrder(updated);
    notifyStatus(order.id, next);
    toast({ title: t(`Status updated to: ${STATUS_CONFIG[next]?.labelEn}`, `تم تحديث الحالة إلى: ${STATUS_CONFIG[next]?.labelAr}`) });
    setUpdating(false);
  };

  const cancelOrder = async () => {
    if (!confirm(t("Are you sure you want to cancel this order?", "هل أنت متأكد من إلغاء هذا الطلب؟"))) return;
    const updated = await base44.entities.Order.update(order.id, { status: "cancelled" });
    setOrder(updated);
    notifyStatus(order.id, "cancelled");
    toast({ title: t("Order cancelled", "تم إلغاء الطلب") });
  };

  const printSlip = () => {
    const w = window.open("", "_blank");
    w.document.write(buildPackingSlip(order));
    w.document.close();
    w.print();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("Loading...", "جاري التحميل...")}</div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("Order not found", "الطلب غير موجود")}</div>;

  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const nextLabel = NEXT_LABEL[order.status];

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/orders")} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowRight className={`w-5 h-5 ${!isRTL ? "rotate-180" : ""}`} />
          </button>
          <div>
            <h1 className="text-xl font-black">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${sc.color}`}>
                {t(sc.labelEn, sc.labelAr)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_date).toLocaleDateString(lang === "ar" ? "ar-LB" : "en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
        <Button onClick={printSlip} variant="outline" size="sm" className="gap-2">
          <Printer className="w-4 h-4" />
          {t("Print Packing Slip", "طباعة وصل التوصيل")}
        </Button>
      </div>

      {/* Status Workflow */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          {/* Progress bar */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {FLOW.map((s, i) => {
              const idx = FLOW.indexOf(order.status);
              const done = i <= idx;
              return (
                <div key={s} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${done ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs whitespace-nowrap ${done ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {t(STATUS_CONFIG[s]?.labelEn, STATUS_CONFIG[s]?.labelAr)}
                  </span>
                  {i < FLOW.length - 1 && <div className={`w-8 h-0.5 mx-1 ${done && i < idx ? "bg-primary" : "bg-gray-200"}`} />}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 flex-wrap">
            {nextLabel && (
              <Button onClick={advanceStatus} disabled={updating} className="gap-2 rounded-xl h-11 flex-1">
                {updating ? t("Updating...", "جاري التحديث...") : t(nextLabel.en, nextLabel.ar)}
              </Button>
            )}
            <a href={buildWhatsAppMsg(order)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 rounded-xl h-11 text-green-600 border-green-200 hover:bg-green-50">
                <MessageCircle className="w-4 h-4" />
                {t("WhatsApp", "تواصل واتساب")}
              </Button>
            </a>
            <a href={`tel:${order.customer_phone}`}>
              <Button variant="outline" className="gap-2 rounded-xl h-11">
                <Phone className="w-4 h-4" />
                {t("Call", "اتصال")}
              </Button>
            </a>
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <Button variant="outline" onClick={cancelOrder} className="gap-2 rounded-xl h-11 text-red-500 border-red-200 hover:bg-red-50">
                {t("Cancel Order", "إلغاء الطلب")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black">{t("Customer Information", "معلومات العميل")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t("Name", "الاسم")}</div>
              <div className="font-bold">{order.customer_name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t("Phone", "الهاتف")}</div>
              <div className="font-bold" dir="ltr">{order.customer_phone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t("City", "المدينة")}</div>
              <div className="font-bold">{order.customer_city}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t("Address", "العنوان")}</div>
              <div className="font-bold">{order.customer_address}</div>
            </div>
            {order.customer_notes && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">{t("Customer Notes", "ملاحظات العميل")}</div>
                <div className="bg-amber-50 text-amber-800 rounded-xl p-2 text-xs">{order.customer_notes}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t("Payment Method", "طريقة الدفع")}</div>
              <div className="font-bold">{t("Cash on Delivery 💵", "الدفع عند الاستلام 💵")}</div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black">{t("Products", "المنتجات")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.image_url && (
                    <img src={item.image_url} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{lang === "ar" ? (item.product_name_ar || item.product_name) : (item.product_name || item.product_name_ar)}</div>
                    <div className="text-xs text-muted-foreground">{t("Quantity", "الكمية")}: {item.quantity}</div>
                  </div>
                  <div className="font-black text-primary">{formatPrice(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Subtotal", "المجموع الفرعي")}</span>
                <span className="font-bold">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Delivery Fee", "رسوم التوصيل")}</span>
                <span className="font-bold">{formatPrice(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="font-black text-base">{t("Amount to Collect", "المبلغ المطلوب تحصيله")}</span>
                <span className="font-black text-xl text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
