import { Link } from "react-router-dom";
import { useLanguage } from "@/components/useLanguage";
import { useSiteSettings } from "@/components/useSiteSettings";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Truck, MessageCircle, BadgeDollarSign } from "lucide-react";

export default function About() {
  const { t, isRTL } = useLanguage();
  const { whatsappNumber } = useSiteSettings();
  const font = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  const values = [
    { icon: BadgeDollarSign, en: "Cash on Delivery", ar: "الدفع عند الاستلام", den: "Pay only when your order arrives.", dar: "ادفع فقط عند وصول طلبك." },
    { icon: Truck, en: "Delivery Across Lebanon", ar: "توصيل لكل لبنان", den: "1-3 business days to your door.", dar: "1-3 أيام عمل حتى باب منزلك." },
    { icon: ShieldCheck, en: "Trusted Products", ar: "منتجات موثوقة", den: "Hand-picked, practical gadgets.", dar: "أدوات عملية مختارة بعناية." },
    { icon: MessageCircle, en: "Always Reachable", ar: "متواجدون دائماً", den: "Order or ask via WhatsApp anytime.", dar: "اطلب أو اسأل عبر واتساب في أي وقت." },
  ];

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl font-black mb-3" style={font}>{t("About Trending Store", "عن ترندينج ستور")}</h1>
        <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto" style={font}>
          {t(
            "Lebanon's trusted online shop for trending gadgets and practical everyday items.",
            "متجرك الموثوق في لبنان للأدوات الذكية والمنتجات العملية اليومية."
          )}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-14">
        <div className="prose max-w-none mb-12">
          <p className="text-lg leading-relaxed text-foreground/80" style={font}>
            {t(
              "Trending Store brings you carefully selected gadgets and practical products at honest prices. We focus on items that make daily life easier — for the home, kitchen, garden, and more. With cash on delivery across Lebanon and fast shipping, shopping with us is simple and risk-free.",
              "يقدّم لك ترندينج ستور مجموعة مختارة بعناية من الأدوات والمنتجات العملية بأسعار صادقة. نركّز على ما يسهّل حياتك اليومية — للمنزل والمطبخ والحديقة وأكثر. مع الدفع عند الاستلام في كل لبنان وشحن سريع، التسوق معنا بسيط وبدون مخاطر."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
          {values.map((v, i) => (
            <div key={i} className="flex items-start gap-4 bg-muted/50 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <v.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1" style={font}>{isRTL ? v.ar : v.en}</h3>
                <p className="text-sm text-muted-foreground" style={font}>{isRTL ? v.dar : v.den}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/shop">
            <Button className="h-12 px-8 rounded-xl font-bold" style={font}>{t("Browse Products", "تصفّح المنتجات")}</Button>
          </Link>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="h-12 px-8 rounded-xl font-bold" style={font}>
              <MessageCircle className="w-5 h-5 mr-2" />
              {t("Contact Us", "تواصل معنا")}
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
