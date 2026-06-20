import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { useSiteSettings } from "@/components/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, CheckCircle2, Truck, ShoppingBag, Tag } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const WHATSAPP_FALLBACK = "96181751841";
function genOrderNum() { return "TS-" + Date.now().toString().slice(-6); }

function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === "percent") return Math.round(subtotal * (Number(coupon.value) / 100));
  return Math.min(subtotal, Number(coupon.value) || 0);
}

export default function Checkout() {
  const { t, isRTL } = useLanguage();
  const { cart, subtotal, clearCart } = useCart();
  const { whatsappNumber, deliveryFee: settingsDelivery } = useSiteSettings();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNum, setOrderNum] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const WHATSAPP = whatsappNumber || WHATSAPP_FALLBACK;
  const deliveryFee = subtotal > 0 ? settingsDelivery : 0;
  const discount = couponDiscount(coupon, subtotal);
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponMsg("");
    try {
      const [found] = await base44.entities.Coupon.filter({ code });
      if (!found || !found.active) {
        setCoupon(null);
        setCouponMsg(t("Invalid coupon code", "كود الخصم غير صالح"));
      } else if (found.expiry && new Date(found.expiry) < new Date()) {
        setCoupon(null);
        setCouponMsg(t("This coupon has expired", "انتهت صلاحية هذا الكوبون"));
      } else if (found.usage_limit && Number(found.usage_count) >= Number(found.usage_limit)) {
        setCoupon(null);
        setCouponMsg(t("This coupon has reached its usage limit", "تم استخدام هذا الكوبون بالكامل"));
      } else if (found.min_order && subtotal < Number(found.min_order)) {
        setCoupon(null);
        setCouponMsg(t(`Minimum order is ${formatPrice(found.min_order)}`, `الحد الأدنى للطلب ${formatPrice(found.min_order)}`));
      } else {
        setCoupon(found);
        setCouponMsg(t("Coupon applied!", "تم تطبيق الكوبون!"));
      }
    } catch {
      setCoupon(null);
      setCouponMsg(t("Could not validate coupon", "تعذر التحقق من الكوبون"));
    }
    setCheckingCoupon(false);
  };

  const buildWhatsAppMessage = (oNum) => {
    const lines = cart.map(i => `• ${isRTL ? i.product_name_ar : i.product_name} x${i.quantity} = ${formatPrice(i.price * i.quantity)}`);
    const msg = isRTL
      ? `🛒 طلب جديد #${oNum}\nالاسم: ${form.name}\nالهاتف: ${form.phone}\nالعنوان: ${form.city}, ${form.address}\n\nالمنتجات:\n${lines.join("\n")}\n\nالمجموع: ${formatPrice(total)}\nالدفع: عند الاستلام`
      : `🛒 New Order #${oNum}\nName: ${form.name}\nPhone: ${form.phone}\nAddress: ${form.city}, ${form.address}\n\nItems:\n${lines.join("\n")}\n\nTotal: ${formatPrice(total)}\nPayment: Cash on Delivery`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const oNum = genOrderNum();
    const order = await base44.entities.Order.create({
      order_number: oNum,
      customer_name: form.name,
      customer_phone: form.phone,
      customer_email: form.email || undefined,
      customer_address: form.address,
      customer_city: form.city,
      customer_notes: form.notes,
      items: cart,
      subtotal,
      discount,
      coupon_code: coupon?.code || undefined,
      delivery_fee: deliveryFee,
      total,
      status: "pending",
      payment_method: "cod",
    });

    // Order automation (best-effort — never block the confirmation screen).
    try {
      const orderId = order?.id;
      await Promise.allSettled([
        base44.functions.commitStock({ order_id: orderId }),
        base44.functions.sendOrderNotification({ order_id: orderId }),
        form.email ? base44.functions.sendOrderConfirmation({ order_id: orderId }) : Promise.resolve(),
        coupon ? base44.entities.Coupon.update(coupon.id, { usage_count: Number(coupon.usage_count || 0) + 1 }) : Promise.resolve(),
      ]);
    } catch { /* automation failures must not break checkout */ }

    setOrderNum(oNum);
    setSubmitted(true);
    clearCart();
    setLoading(false);
  };

  const inputClass = `h-12 rounded-xl border-border focus:border-primary ${isRTL ? "text-right" : "text-left"}`;

  if (cart.length === 0 && !submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <ShoppingBag className="w-20 h-20 text-muted opacity-30" />
      <h2 className="text-2xl font-black" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Your cart is empty", "سلتك فارغة")}</h2>
      <Link to="/shop"><Button className="rounded-full px-8">{t("Start Shopping", "ابدأ التسوق")}</Button></Link>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
      </div>
      <div>
        <h2 className="text-3xl font-black mb-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Order Placed! 🎉", "تم الطلب! 🎉")}
        </h2>
        <p className="text-muted-foreground text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t(`Order #${orderNum}`, `رقم الطلب #${orderNum}`)}
        </p>
        <p className="text-muted-foreground mt-2 max-w-sm" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("We'll contact you soon to confirm your order.", "سنتواصل معك قريباً لتأكيد طلبك.")}
        </p>
      </div>
      <a href={buildWhatsAppMessage(orderNum)} target="_blank" rel="noopener noreferrer">
        <Button className="bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full px-8 h-14 text-lg font-black gap-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          <MessageCircle className="w-6 h-6" fill="white" />
          {t("Confirm on WhatsApp", "تأكيد عبر واتساب")}
        </Button>
      </a>
      <Link to="/shop" className="text-primary underline font-semibold" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
        {t("Continue Shopping", "تابع التسوق")}
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <h1 className="text-3xl font-black mb-8" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Checkout", "إتمام الطلب")}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="bg-white rounded-3xl border border-border p-6 flex flex-col gap-4">
              <h2 className="font-black text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Delivery Details", "تفاصيل التوصيل")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Full Name *", "الاسم الكامل *")}</Label>
                  <Input value={form.name} onChange={e => updateForm("name", e.target.value)} required className={`mt-1.5 ${inputClass}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
                </div>
                <div>
                  <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Phone Number *", "رقم الهاتف *")}</Label>
                  <Input value={form.phone} onChange={e => updateForm("phone", e.target.value)} required type="tel" className={`mt-1.5 ${inputClass}`} />
                </div>
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Email (optional — for order updates)", "البريد الإلكتروني (اختياري — لتحديثات الطلب)")}</Label>
                <Input value={form.email} onChange={e => updateForm("email", e.target.value)} type="email" className={`mt-1.5 ${inputClass}`} style={{ direction: "ltr" }} />
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("City *", "المدينة *")}</Label>
                <Input value={form.city} onChange={e => updateForm("city", e.target.value)} required className={`mt-1.5 ${inputClass}`} placeholder={t("e.g. Tripoli, Beirut, Sidon...", "مثال: طرابلس، بيروت، صيدا...")} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Full Address *", "العنوان الكامل *")}</Label>
                <Input value={form.address} onChange={e => updateForm("address", e.target.value)} required className={`mt-1.5 ${inputClass}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Notes (optional)", "ملاحظات (اختياري)")}</Label>
                <Input value={form.notes} onChange={e => updateForm("notes", e.target.value)} className={`mt-1.5 ${inputClass}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
              </div>
            </div>

            <div className="bg-muted/50 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Cash on Delivery", "الدفع عند الاستلام")}</p>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Pay when you receive your order — available across all Lebanon", "ادفع عند استلام طلبك — متاح في جميع أنحاء لبنان")}</p>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-black rounded-2xl bg-primary hover:bg-primary/90" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {loading ? t("Placing Order...", "جاري تسجيل الطلب...") : t("Place Order", "تسجيل الطلب")}
            </Button>
          </form>

          {/* Order Summary */}
          <div className="bg-white rounded-3xl border border-border p-6 h-fit sticky top-24">
            <h2 className="font-black text-lg mb-4" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Order Summary", "ملخص الطلب")}
            </h2>
            <div className="flex flex-col gap-3 mb-4">
              {cart.map(item => (
                <div key={item.product_id} className="flex gap-3 items-center">
                  <img src={item.image_url} alt="" className="w-14 h-14 object-cover rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{isRTL ? item.product_name_ar : item.product_name}</p>
                    <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />

            {/* Coupon */}
            <div className="flex gap-2 mb-3">
              <Input
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder={t("Coupon code", "كود الخصم")}
                className="h-10 rounded-xl uppercase"
                style={{ direction: "ltr", letterSpacing: "0.08em" }}
              />
              <Button type="button" variant="outline" onClick={applyCoupon} disabled={checkingCoupon || !couponCode.trim()} className="h-10 rounded-xl font-bold gap-1.5">
                <Tag className="w-4 h-4" />
                {t("Apply", "تطبيق")}
              </Button>
            </div>
            {couponMsg && (
              <p className={`text-xs mb-3 ${coupon ? "text-green-600" : "text-red-500"}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {couponMsg}
              </p>
            )}

            <div className="flex flex-col gap-2 text-sm" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("Subtotal", "المجموع الفرعي")}</span><span>{formatPrice(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-red-500 font-medium"><span>{t("Discount", "الخصم")} ({coupon?.code})</span><span>-{formatPrice(discount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">{t("Delivery", "التوصيل")}</span><span className="text-green-600 font-medium">{formatPrice(deliveryFee)}</span></div>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between font-black text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              <span>{t("Total", "المجموع")}</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}