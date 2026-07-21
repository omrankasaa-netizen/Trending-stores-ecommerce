import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { useSiteSettings } from "@/components/useSiteSettings";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, CheckCircle2, Truck, ShoppingBag, Tag, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cartHasFreeDelivery, availableStock, findSize } from "@/lib/pricing";
import { trackInitiateCheckout, trackPurchase, newEventId } from "@/lib/metaPixel";
import { sendServerCapiEvent } from "@/lib/metaServer";
import { trackTiktokInitiateCheckout, trackTiktokPurchase, newTiktokEventId } from "@/lib/tiktokPixel";
import { buildContents } from "@/lib/metaShared";

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
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [stockError, setStockError] = useState("");
  const [selectedAddrId, setSelectedAddrId] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);

  // Logged-in shoppers: prefill name/email from their account once.
  useEffect(() => {
    if (isAuthenticated && user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.full_name || "",
        email: f.email || user.email || "",
        phone: f.phone || user.phone || "",
      }));
    }
  }, [isAuthenticated, user]);

  // Saved shipping addresses for fast checkout (ownership-gated server function).
  const { data: addrData } = useQuery({
    queryKey: ["my-addresses", "checkout"],
    queryFn: () => base44.functions.listMyAddresses(),
    enabled: isAuthenticated,
  });
  const savedAddresses = addrData?.addresses || [];

  // Auto-apply the default saved address the first time addresses load.
  useEffect(() => {
    if (!selectedAddrId && savedAddresses.length > 0) {
      const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
      if (def) applyAddress(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses]);

  const applyAddress = (addr) => {
    if (!addr) return;
    setSelectedAddrId(addr.id);
    setSaveAddress(false);
    setForm((f) => ({
      ...f,
      name: addr.full_name || f.name,
      phone: addr.phone || f.phone,
      city: addr.city || f.city,
      address: addr.address || f.address,
      notes: addr.notes || f.notes,
    }));
  };

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const WHATSAPP = whatsappNumber || WHATSAPP_FALLBACK;
  // Any free-delivery item (product flag or bundle offer) waives the fee. The
  // server re-derives this authoritatively; this keeps the displayed total in sync.
  const freeDelivery = cartHasFreeDelivery(cart);
  const deliveryFee = subtotal > 0 && !freeDelivery ? settingsDelivery : 0;
  const discount = couponDiscount(coupon, subtotal);
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Meta InitiateCheckout — fire once when the checkout page loads with items.
  // No-op without pixel id / consent.
  useEffect(() => {
    if (cart.length > 0) {
      // Browser Pixel + server-side CAPI twin share one event_id for dedup.
      const eventId = trackInitiateCheckout({ items: cart, value: total });
      const { contents, content_ids } = buildContents(cart);
      sendServerCapiEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        content_ids,
        contents,
        value: Number(total) || undefined,
      });
      // TikTok InitiateCheckout twin — separate event_id (independent dedup namespace).
      trackTiktokInitiateCheckout({ items: cart, value: total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const lines = cart.map(i => {
      const nm = isRTL ? (i.product_name_ar || i.product_name) : i.product_name;
      const sz = isRTL ? (i.size_label_ar || i.size_label) : (i.size_label || i.size_label_ar);
      const of = isRTL ? (i.offer_label_ar || i.offer_label) : (i.offer_label || i.offer_label_ar);
      const extra = [sz, of].filter(Boolean).join(" · ");
      return `• ${nm}${extra ? ` (${extra})` : ""} x${i.quantity} = ${formatPrice(i.price * i.quantity)}`;
    });
    const msg = isRTL
      ? `🛒 طلب جديد #${oNum}\nالاسم: ${form.name}\nالهاتف: ${form.phone}\nالعنوان: ${form.city}, ${form.address}\n\nالمنتجات:\n${lines.join("\n")}\n\nالمجموع: ${formatPrice(total)}\nالدفع: عند الاستلام`
      : `🛒 New Order #${oNum}\nName: ${form.name}\nPhone: ${form.phone}\nAddress: ${form.city}, ${form.address}\n\nItems:\n${lines.join("\n")}\n\nTotal: ${formatPrice(total)}\nPayment: Cash on Delivery`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  // Earlier, nicer stock warning: re-read each cart product and compare the
  // requested pieces against reservation-aware availability (stock − reserved)
  // BEFORE placing the order, so the shopper sees "Only N left / reserved"
  // up front instead of only after the server rejects. This is advisory — the
  // atomic server reserve on Order.create remains the source of truth. Returns
  // the first shortage { name, available } or null when everything fits.
  const revalidateStock = async () => {
    const ids = [...new Set(cart.map((i) => i.product_id))];
    const fetched = await Promise.all(
      ids.map((id) => base44.entities.Product.filter({ id }).then(([p]) => p).catch(() => null))
    );
    const byId = Object.fromEntries(fetched.filter(Boolean).map((p) => [p.id, p]));
    for (const item of cart) {
      const product = byId[item.product_id];
      if (!product) continue; // can't verify → let the server decide
      const avail = availableStock(product, item.size_id);
      if (avail == null) continue; // untracked → unlimited
      if (item.quantity > avail) {
        const base = isRTL ? (product.name_ar || product.name) : (product.name || product.name_ar);
        const size = findSize(product, item.size_id);
        const sizeLabel = size ? (isRTL ? (size.label_ar || size.label) : (size.label || size.label_ar)) : "";
        const name = sizeLabel ? `${base} (${sizeLabel})` : base;
        return { name, available: avail };
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStockError("");

    // Pre-check availability so the shopper is warned before we attempt to place.
    const shortage = await revalidateStock();
    if (shortage) {
      setStockError(
        shortage.available > 0
          ? t(
              `Only ${shortage.available} left of ${shortage.name}. Please reduce the quantity.`,
              `تبقى ${shortage.available} فقط من ${shortage.name}. يرجى تقليل الكمية.`
            )
          : t(
              `${shortage.name} is no longer available (reserved by another customer).`,
              `${shortage.name} لم يعد متوفراً (محجوز من قبل عميل آخر).`
            )
      );
      setLoading(false);
      return;
    }

    const oNum = genOrderNum();
    // Logged-in shoppers: stamp the order with their account email + id so it
    // shows up in their order history (getMyOrders matches on these). Guests are
    // unaffected — the guest path stays exactly as before.
    const orderEmail = form.email || (isAuthenticated ? user?.email : "") || undefined;
    // Order creation now ATOMICALLY holds (reserves) the inventory server-side.
    // If any item was just taken by another shopper / is out of stock, the server
    // rejects the placement (409) and nothing is persisted — surface that clearly.
    let order;
    try {
      order = await base44.entities.Order.create({
        order_number: oNum,
        customer_name: form.name,
        customer_phone: form.phone,
        customer_email: orderEmail,
        customer_address: form.address,
        customer_city: form.city,
        customer_notes: form.notes,
        customer_id: isAuthenticated ? user?.id : undefined,
        items: cart,
        subtotal,
        discount,
        coupon_code: coupon?.code || undefined,
        delivery_fee: deliveryFee,
        total,
        status: "pending",
        payment_method: "cod",
      });
    } catch (err) {
      const msg = err?.status === 409
        ? t(
            err?.data?.error || "Sorry, one or more items are out of stock.",
            err?.data?.error_ar || "عذراً، نفدت الكمية من واحد أو أكثر من العناصر."
          )
        : t("Could not place your order. Please try again.", "تعذّر تسجيل طلبك. حاول مرة أخرى.");
      setStockError(msg);
      setLoading(false);
      return;
    }

    // Meta Purchase: fire the browser Pixel event and the server-side CAPI event
    // with the SAME event_id so Meta deduplicates them into one conversion. The
    // authoritative purchase value comes from the server-recomputed order. Both
    // are no-ops when Meta is not configured / consent withheld (browser side).
    const purchaseEventId = newEventId();
    const purchaseValue = Number(order?.total ?? total) || 0;
    trackPurchase({ items: cart, value: purchaseValue, eventId: purchaseEventId });

    // TikTok CompletePayment — separate event_id (independent dedup namespace).
    // Browser Pixel + server Events API share this id so TikTok dedupes the pair.
    const tiktokPurchaseEventId = newTiktokEventId();
    trackTiktokPurchase({ items: cart, value: purchaseValue, eventId: tiktokPurchaseEventId });

    // Order automation (best-effort — never block the confirmation screen). Stock
    // is already held by the reservation above; it is converted to a sale when an
    // admin confirms the order, and released if the order is cancelled.
    try {
      const orderId = order?.id;
      await Promise.allSettled([
        base44.functions.metaTrackPurchase({ order_id: orderId, event_id: purchaseEventId }),
        base44.functions.tiktokTrackPurchase({ order_id: orderId, event_id: tiktokPurchaseEventId }),
        base44.functions.sendOrderNotification({ order_id: orderId }),
        orderEmail ? base44.functions.sendOrderConfirmation({ order_id: orderId }) : Promise.resolve(),
        coupon ? base44.entities.Coupon.update(coupon.id, { usage_count: Number(coupon.usage_count || 0) + 1 }) : Promise.resolve(),
        // Offer to remember this address for next time (logged-in shoppers only).
        (isAuthenticated && saveAddress && form.address && form.city)
          ? base44.functions.saveMyAddress({
              full_name: form.name, phone: form.phone, city: form.city,
              address: form.address, notes: form.notes,
              is_default: savedAddresses.length === 0,
            })
          : Promise.resolve(),
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

              {/* Fast checkout: pick a saved address (logged-in shoppers) */}
              {isAuthenticated && savedAddresses.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="font-bold text-sm" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                      {t("Use a saved address", "استخدم عنواناً محفوظاً")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => applyAddress(addr)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          selectedAddrId === addr.id ? "border-primary bg-primary/10" : "border-border bg-white hover:border-primary/40"
                        }`}
                        style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{addr.full_name}</span>
                          {addr.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{addr.label}</span>}
                          {addr.is_default && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{t("Default", "افتراضي")}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{[addr.city, addr.address].filter(Boolean).join(", ")}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Full Name *", "الاسم الكامل *")}</Label>
                  <Input value={form.name} onChange={e => updateForm("name", e.target.value)} required autoComplete="name" className={`mt-1.5 ${inputClass}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
                </div>
                <div>
                  <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Phone Number *", "رقم الهاتف *")}</Label>
                  <Input value={form.phone} onChange={e => updateForm("phone", e.target.value)} required type="tel" inputMode="tel" autoComplete="tel" className={`mt-1.5 ${inputClass}`} />
                </div>
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Email (optional — for order updates)", "البريد الإلكتروني (اختياري — لتحديثات الطلب)")}</Label>
                <Input value={form.email} onChange={e => updateForm("email", e.target.value)} type="email" inputMode="email" autoComplete="email" className={`mt-1.5 ${inputClass}`} style={{ direction: "ltr" }} />
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("City *", "المدينة *")}</Label>
                <Input value={form.city} onChange={e => updateForm("city", e.target.value)} required autoComplete="address-level2" className={`mt-1.5 ${inputClass}`} placeholder={t("e.g. Tripoli, Beirut, Sidon...", "مثال: طرابلس، بيروت، صيدا...")} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
              </div>
              <div>
                <Label style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{t("Full Address *", "العنوان الكامل *")}</Label>
                <Input value={form.address} onChange={e => updateForm("address", e.target.value)} required autoComplete="street-address" className={`mt-1.5 ${inputClass}`} style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }} />
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

            {isAuthenticated && (
              <label className="flex items-center gap-2 cursor-pointer px-1" style={{ direction: isRTL ? "rtl" : "ltr" }}>
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="rounded" />
                <span className="text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Save this address to my account", "حفظ هذا العنوان في حسابي")}
                </span>
              </label>
            )}

            {stockError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
              >
                {stockError}
              </div>
            )}

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
              {cart.map(item => {
                const sz = isRTL ? (item.size_label_ar || item.size_label) : (item.size_label || item.size_label_ar);
                const of = isRTL ? (item.offer_label_ar || item.offer_label) : (item.offer_label || item.offer_label_ar);
                return (
                <div key={item.cart_key || item.product_id} className="flex gap-3 items-center">
                  <img src={item.image_url} alt="" className="w-14 h-14 object-cover rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{isRTL ? item.product_name_ar : item.product_name}</p>
                    {(sz || of) && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {sz && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sz}</span>}
                        {of && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{of}</span>}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">x{item.quantity}</p>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                </div>
                );
              })}
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
              <div className="flex justify-between"><span className="text-muted-foreground">{t("Delivery", "التوصيل")}</span><span className="text-green-600 font-medium">{freeDelivery && subtotal > 0 ? t("Free", "مجاني") : formatPrice(deliveryFee)}</span></div>
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