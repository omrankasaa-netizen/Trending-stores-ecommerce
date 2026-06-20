import { useLanguage } from "@/components/useLanguage";
import { useSiteSettings } from "@/components/useSiteSettings";
import { formatPrice } from "@/lib/utils";
import { Truck, BadgeDollarSign, RotateCcw, Clock } from "lucide-react";

export default function Delivery() {
  const { t, isRTL } = useLanguage();
  const { deliveryFee, freeDeliveryThreshold } = useSiteSettings();
  const font = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  const blocks = [
    {
      icon: Truck,
      en: "Delivery Across Lebanon",
      ar: "التوصيل لكل لبنان",
      den: "We deliver to all regions of Lebanon. Most orders arrive within 1-3 business days.",
      dar: "نوصّل إلى جميع المناطق اللبنانية. تصل معظم الطلبات خلال 1-3 أيام عمل.",
    },
    {
      icon: BadgeDollarSign,
      en: "Cash on Delivery",
      ar: "الدفع عند الاستلام",
      den: "Pay in cash when your order arrives — no prepayment required.",
      dar: "ادفع نقداً عند وصول طلبك — لا حاجة للدفع المسبق.",
    },
    {
      icon: Clock,
      en: "Delivery Fee",
      ar: "رسوم التوصيل",
      den: `A flat delivery fee of $${formatPrice(deliveryFee)} applies per order.${freeDeliveryThreshold ? ` Orders over $${formatPrice(freeDeliveryThreshold)} ship free.` : ""}`,
      dar: `رسوم توصيل ثابتة $${formatPrice(deliveryFee)} لكل طلب.${freeDeliveryThreshold ? ` الطلبات فوق $${formatPrice(freeDeliveryThreshold)} توصيل مجاني.` : ""}`,
    },
    {
      icon: RotateCcw,
      en: "Returns & Exchanges",
      ar: "الإرجاع والاستبدال",
      den: "If a product arrives damaged or faulty, contact us within 48 hours and we'll make it right.",
      dar: "إذا وصل المنتج تالفاً أو معطّلاً، تواصل معنا خلال 48 ساعة وسنحلّ المشكلة.",
    },
  ];

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl font-black mb-3" style={font}>{t("Delivery & Returns", "التوصيل والإرجاع")}</h1>
        <p className="text-primary-foreground/80 text-lg" style={font}>
          {t("Simple, transparent, and risk-free.", "بسيط، شفّاف، وبدون مخاطر.")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14 flex flex-col gap-5">
        {blocks.map((b, i) => (
          <div key={i} className="flex items-start gap-4 bg-muted/50 rounded-3xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <b.icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1" style={font}>{isRTL ? b.ar : b.en}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed" style={font}>{isRTL ? b.dar : b.den}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
