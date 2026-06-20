import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, MessageCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useSiteSettings } from "@/components/useSiteSettings";

function buildWhatsAppOrder(cart, total, savings, isRTL) {
  const lines = cart.map(
    (i) => `• ${isRTL ? (i.product_name_ar || i.product_name) : i.product_name} x${i.quantity} = ${formatPrice(i.price * i.quantity)}`
  );
  if (isRTL) {
    return [
      "🛒 طلب جديد من ترندينج ستور",
      "",
      ...lines,
      "",
      `المجموع: ${formatPrice(total)}`,
      savings > 0 ? `التوفير: ${formatPrice(savings)}` : null,
      "الدفع: عند الاستلام",
    ].filter(Boolean).join("\n");
  }
  return [
    "🛒 New order from Trending Store",
    "",
    ...lines,
    "",
    `Total: ${formatPrice(total)}`,
    savings > 0 ? `You save: ${formatPrice(savings)}` : null,
    "Payment: Cash on Delivery",
  ].filter(Boolean).join("\n");
}

export default function CartDrawer({ open, onClose, cart, updateQty, removeFromCart, subtotal, isRTL, t }) {
  const { whatsappNumber, deliveryFee: settingsDelivery } = useSiteSettings();
  const deliveryFee = subtotal > 0 ? settingsDelivery : 0;
  const total = subtotal + deliveryFee;

  const savings = cart.reduce((s, i) => {
    const cmp = Number(i.compare_at_price) || 0;
    return cmp > i.price ? s + (cmp - i.price) * i.quantity : s;
  }, 0);

  const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildWhatsAppOrder(cart, total, savings, isRTL))}`;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:w-[420px] flex flex-col p-0" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            {t("Your Cart", "سلة التسوق")}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
            <ShoppingBag className="w-16 h-16 opacity-20" />
            <p className="font-medium" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Your cart is empty", "سلتك فارغة")}
            </p>
            <Button variant="outline" onClick={onClose} className="rounded-full" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Continue Shopping", "تابع التسوق")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex gap-4 items-start">
                  <img
                    src={item.image_url || "https://placehold.co/80x80"}
                    alt={isRTL ? item.product_name_ar : item.product_name}
                    className="w-20 h-20 object-cover rounded-xl bg-muted flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground line-clamp-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                      {isRTL ? item.product_name_ar : item.product_name}
                    </p>
                    <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQty(item.product_id, item.quantity - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQty(item.product_id, item.quantity + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeFromCart(item.product_id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-5 flex flex-col gap-3 bg-muted/30">
              <div className="flex justify-between text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <span>{t("Subtotal", "المجموع الفرعي")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <span>{t("Delivery", "التوصيل")}</span>
                <span className="text-green-600 font-medium">{formatPrice(deliveryFee)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-sm font-medium text-red-500" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  <span>{t("You save", "توفيرك")}</span>
                  <span>-{formatPrice(savings)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-black text-foreground text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <span>{t("Total", "المجموع")}</span>
                <span>{formatPrice(total)}</span>
              </div>

              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full h-12 rounded-xl font-bold text-base bg-[#25D366] hover:bg-[#1ebe5d] text-white gap-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  <MessageCircle className="w-5 h-5" fill="white" />
                  {t("Send Order via WhatsApp", "أرسل الطلب عبر واتساب")}
                </Button>
              </a>

              <Link to="/checkout" onClick={onClose}>
                <Button variant="outline" className="w-full h-12 rounded-xl font-bold text-base border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Proceed to Checkout", "إتمام الطلب")}
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
