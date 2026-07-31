import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, MessageCircle, Printer, Phone, Pencil, Plus, Minus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { getSizes, sizeId } from "@/lib/pricing";
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

  // ── Edit-items mode (pending / confirmed / processing only) ─────────────
  const canEdit = ["pending", "confirmed", "processing"].includes(order?.status);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editProducts, setEditProducts] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editShortages, setEditShortages] = useState([]);
  const [addSearch, setAddSearch] = useState("");

  const startEditing = async () => {
    setEditErr("");
    setEditShortages([]);
    setAddSearch("");
    setEditItems((order.items || []).map((it, i) => ({
      key: `old-${i}`,
      product_id: it.product_id,
      product_name: it.product_name,
      product_name_ar: it.product_name_ar,
      image_url: it.image_url || "",
      size_id: it.size_id || "",
      size_label: it.size_label || "",
      size_label_ar: it.size_label_ar || "",
      quantity: it.quantity,
      price: Number(it.price) || 0,
      keepPrice: true, // preserve agreed price unless the size changes
    })));
    setEditing(true);
    try {
      const prods = await base44.entities.Product.list("-created_date", 500);
      setEditProducts(prods || []);
    } catch { setEditProducts([]); }
  };

  const patchEditItem = (key, patch) =>
    setEditItems(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)));

  const addProductToEdit = (product) => {
    const sizes = getSizes(product);
    const first = sizes[0];
    setEditItems(prev => [...prev, {
      key: `new-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.name || "",
      product_name_ar: product.name_ar || "",
      image_url: product.image_url || (product.images?.[0] || ""),
      size_id: first ? sizeId(first) : "",
      size_label: first?.label || "",
      size_label_ar: first?.label_ar || "",
      quantity: 1,
      price: null, // server resolves the storefront-effective price
      keepPrice: false,
    }]);
    setAddSearch("");
  };

  const editSubtotal = editItems.reduce((sum, it) => sum + (Number(it.price) || 0) * it.quantity, 0);
  const hasUnresolvedPrice = editItems.some(it => it.price == null);

  const saveEdit = async () => {
    setEditErr("");
    setEditShortages([]);
    if (editItems.length === 0) {
      setEditErr(t("An order needs at least one item — cancel the order instead.", "الطلب يحتاج منتجاً واحداً على الأقل — ألغِ الطلب بدلاً من ذلك."));
      return;
    }
    setEditSaving(true);
    try {
      const res = await base44.functions.editOrder({
        order_id: order.id,
        items: editItems.map(it => ({
          product_id: it.product_id,
          size_id: it.size_id || "",
          size_label: it.size_label || "",
          size_label_ar: it.size_label_ar || "",
          quantity: it.quantity,
          ...(it.keepPrice && it.price != null ? { price: it.price } : {}),
        })),
      });
      const payload = res?.data || res;
      if (!payload?.ok) {
        setEditShortages(payload?.shortages || []);
        setEditErr(payload?.error || t("Not enough stock — nothing was changed.", "لا يوجد مخزون كافٍ — لم يتغير شيء."));
        return;
      }
      const fresh = await base44.entities.Order.filter({ id: order.id }).then(([o]) => o);
      setOrder(fresh);
      setEditing(false);
      toast({ title: t("Order updated — stock adjusted automatically", "تم تحديث الطلب — عُدّل المخزون تلقائياً") });
    } catch (e) {
      const data = e?.data?.data || e?.data || {};
      setEditShortages(data.shortages || []);
      setEditErr(data.error || e.message || t("Edit failed — nothing was changed.", "فشل التعديل — لم يتغير شيء."));
    } finally {
      setEditSaving(false);
    }
  };

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
    try {
      const updated = await base44.entities.Order.update(order.id, { status: next });
      setOrder(updated);
      notifyStatus(order.id, next);
      toast({ title: t(`Status updated to: ${STATUS_CONFIG[next]?.labelEn}`, `تم تحديث الحالة إلى: ${STATUS_CONFIG[next]?.labelAr}`) });
    } catch (err) {
      toast({ title: t("Failed to update status", "تعذّر تحديث الحالة"), description: err?.message || "", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!confirm(t("Are you sure you want to cancel this order?", "هل أنت متأكد من إلغاء هذا الطلب؟"))) return;
    setUpdating(true);
    try {
      // Route cancellation through the server function so inventory is restocked
      // to the correct size (once — guarded against double-restock).
      const res = await base44.functions.cancelOrder({ order_id: order.id });
      setOrder(res?.order || await base44.entities.Order.filter({ id: order.id }).then(([o]) => o));
      notifyStatus(order.id, "cancelled");
      toast({ title: t("Order cancelled", "تم إلغاء الطلب") });
    } catch (err) {
      toast({ title: t("Failed to cancel order", "تعذّر إلغاء الطلب"), description: err?.message || "", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black">{t("Products", "المنتجات")}</CardTitle>
              {canEdit && !editing && (
                <Button onClick={startEditing} variant="outline" size="sm" className="gap-1.5 rounded-xl">
                  <Pencil className="w-3.5 h-3.5" />
                  {t("Edit Items", "تعديل المنتجات")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing && (
              <div className="space-y-3 mb-4">
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {editItems.map((it) => {
                    const product = editProducts.find(p => p.id === it.product_id);
                    const sizes = product ? getSizes(product) : [];
                    return (
                      <div key={it.key} className="p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          {it.image_url && <img src={it.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{lang === "ar" ? (it.product_name_ar || it.product_name) : (it.product_name || it.product_name_ar)}</div>
                            <div className="text-xs text-muted-foreground">
                              {it.price != null ? `${formatPrice(it.price)} ${t("each", "للقطعة")}` : t("price auto-resolves on save", "السعر يُحسب عند الحفظ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => patchEditItem(it.key, { quantity: Math.max(1, it.quantity - 1) })}
                              className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="w-7 text-center text-sm font-black">{it.quantity}</span>
                            <button onClick={() => patchEditItem(it.key, { quantity: Math.min(999, it.quantity + 1) })}
                              className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                          <span className="text-sm font-black w-16 text-right">{it.price != null ? formatPrice(it.price * it.quantity) : "—"}</span>
                          <button onClick={() => setEditItems(prev => prev.filter(x => x.key !== it.key))}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {sizes.length > 0 && (
                          <select
                            value={it.size_id}
                            onChange={e => {
                              const sz = sizes.find(x => sizeId(x) === e.target.value);
                              // Size change invalidates the old price — let the
                              // server re-resolve the storefront-effective price.
                              patchEditItem(it.key, { size_id: e.target.value, size_label: sz?.label || "", size_label_ar: sz?.label_ar || "", price: null, keepPrice: false });
                            }}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-full">
                            {sizes.map(sz => (
                              <option key={sizeId(sz)} value={sizeId(sz)}>
                                {(lang === "ar" ? (sz.label_ar || sz.label) : (sz.label || sz.label_ar))}
                                {sz.stock_quantity != null ? ` — ${Math.max(0, Number(sz.stock_quantity || 0) - Number(sz.qty_reserved || 0))} ${t("available", "متوفر")}` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                  {editItems.length === 0 && (
                    <p className="p-6 text-sm text-muted-foreground text-center">{t("All items removed — add one below, or cancel the order instead.", "أزلت كل المنتجات — أضف واحداً أدناه أو ألغِ الطلب.")}</p>
                  )}
                </div>

                {/* Add item */}
                <div className="relative">
                  <input
                    value={addSearch}
                    onChange={e => setAddSearch(e.target.value)}
                    placeholder={t("Search products to add…", "ابحث عن منتجات لإضافتها…")}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
                  />
                  {addSearch.trim() && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {editProducts
                        .filter(pr => (pr.name || "").toLowerCase().includes(addSearch.trim().toLowerCase()) || (pr.name_ar || "").includes(addSearch.trim()))
                        .slice(0, 8)
                        .map(pr => (
                          <button key={pr.id} onClick={() => addProductToEdit(pr)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm">
                            <span className="flex-1 truncate">{lang === "ar" ? (pr.name_ar || pr.name) : (pr.name || pr.name_ar)}</span>
                            <span className="text-xs text-muted-foreground">{formatPrice(pr.price)}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Totals hint */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("New subtotal", "المجموع الفرعي الجديد")}</span>
                    <span className="font-bold">{hasUnresolvedPrice ? "≈ " : ""}{formatPrice(editSubtotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.total_override
                      ? t("This order has a manually overridden total — it stays as set.", "هذا الطلب له إجمالي مخصص يدوياً — سيبقى كما هو.")
                      : t("Discount and delivery fee are kept; the total recalculates on save.", "يُحتفظ بالخصم ورسوم التوصيل؛ يُعاد حساب الإجمالي عند الحفظ.")}
                  </p>
                </div>

                {editErr && <p className="text-xs text-red-600">{editErr}</p>}
                {editShortages.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-red-600">{t("Not enough stock — the order was NOT changed:", "لا يوجد مخزون كافٍ — لم يتغير الطلب:")}</p>
                    {editShortages.map((sh, i) => (
                      <p key={i} className="text-xs text-red-600">• {lang === "ar" ? (sh.product_name_ar || sh.product_name) : (sh.product_name || sh.product_name_ar)}: {sh.available} {t("available", "متوفر")}, {sh.requested} {t("needed", "مطلوب")}</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={editSaving} className="rounded-xl">
                    {editSaving ? t("Saving…", "جارٍ الحفظ…") : t("Save Changes", "حفظ التغييرات")}
                  </Button>
                  <Button onClick={() => setEditing(false)} disabled={editSaving} variant="outline" className="rounded-xl">
                    {t("Discard", "إلغاء")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("Stock adjusts automatically: freed items go back on sale, new items are taken out — all-or-nothing.", "يُعدَّل المخزون تلقائياً: المنتجات المحررة تعود للبيع والجديدة تُخصم — كل شيء أو لا شيء.")}</p>
              </div>
            )}
            {!editing && (
            <div className="space-y-3 mb-4">
              {(order.items || []).map((item, i) => {
                const sz = lang === "ar" ? (item.size_label_ar || item.size_label) : (item.size_label || item.size_label_ar);
                const of = lang === "ar" ? (item.offer_label_ar || item.offer_label) : (item.offer_label || item.offer_label_ar);
                return (
                <div key={i} className="flex items-center gap-3">
                  {item.image_url && (
                    <img src={item.image_url} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{lang === "ar" ? (item.product_name_ar || item.product_name) : (item.product_name || item.product_name_ar)}</div>
                    {(sz || of) && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {sz && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{sz}</span>}
                        {of && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{of}</span>}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">{t("Quantity", "الكمية")}: {item.quantity}</div>
                  </div>
                  <div className="font-black text-primary">{formatPrice(item.price * item.quantity)}</div>
                </div>
                );
              })}
            </div>
            )}
            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Subtotal", "المجموع الفرعي")}</span>
                <span className="font-bold">{formatPrice(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-red-500 font-medium">
                  <span>
                    {t("Discount", "الخصم")}
                    {order.discount_type === "percent" && order.discount_value ? ` (${order.discount_value}%)` : ""}
                    {order.coupon_code ? ` (${order.coupon_code})` : ""}
                  </span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Delivery Fee", "رسوم التوصيل")}{order.free_delivery_applied ? ` (${t("Free", "مجاني")})` : ""}</span>
                <span className="font-bold">{formatPrice(order.delivery_fee)}</span>
              </div>
              {order.total_override && (
                <div className="flex justify-between text-amber-600 text-xs">
                  <span>{t("Total manually overridden", "تم تجاوز الإجمالي يدوياً")}</span>
                </div>
              )}
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
