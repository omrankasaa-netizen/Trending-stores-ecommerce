import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

function formatPrice(p) {
  return p >= 1000 ? `$${(p / 1000).toFixed(0)}` : `$${p}`;
}

export default function CartDrawer({ open, onClose, cart, updateQty, removeFromCart, subtotal, isRTL, t }) {
  const deliveryFee = subtotal > 0 ? 3000 : 0;
  const total = subtotal + deliveryFee;

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
              <Separator />
              <div className="flex justify-between font-black text-foreground text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <span>{t("Total", "المجموع")}</span>
                <span>{formatPrice(total)}</span>
              </div>

              <Link to="/checkout" onClick={onClose}>
                <Button className="w-full h-12 rounded-xl font-bold text-base mt-1 bg-primary hover:bg-primary/90" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
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