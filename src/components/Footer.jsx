import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Phone, Mail, MapPin, Facebook } from "lucide-react";
import { useLanguage } from "@/components/useLanguage";
import { useSiteSettings } from "@/components/useSiteSettings";

export default function Footer() {
  const { t, isRTL } = useLanguage();
  const { whatsappNumber } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
  };

  return (
    <footer className="bg-primary text-primary-foreground" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand Column */}
          <div className={isRTL ? "text-right" : "text-left"}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                <span className="text-primary-foreground font-black text-sm">TS</span>
              </div>
              <div>
                <div className="font-black text-primary-foreground text-xl leading-none">
                  {isRTL ? "ترندينج" : "Trending"}
                </div>
                <div className="text-xs text-primary-foreground/70 leading-none">
                  {isRTL ? "ستور" : "Store"}
                </div>
              </div>
            </div>
            <p className="text-primary-foreground/70 text-sm mb-5 leading-relaxed"
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t(
                "Lebanon's trusted online shop for trending gadgets and practical everyday items. Fast delivery, cash on delivery.",
                "متجرك الموثوق في لبنان للأدوات الذكية والمنتجات العملية. توصيل سريع ودفع عند الاستلام."
              )}
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors group">
                <MessageCircle className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span dir="ltr">+961 81 751 841</span>
              </a>
              <a href="tel:+96181751841"
                className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors group">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span dir="ltr">+961 81 751 841</span>
              </a>
              <a href="mailto:support@trending-stores.com"
                className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors group">
                <Mail className="w-4 h-4 flex-shrink-0" />
                support@trending-stores.com
              </a>
              <div className="flex items-start gap-2 text-primary-foreground/70">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Rafic Hariri Street, Tripoli, Lebanon", "شارع رفيق الحريري، طرابلس، لبنان")}
                </span>
              </div>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="font-black text-primary-foreground mb-4 text-base"
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Shop", "المتجر")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {[
                { en: "All Products", ar: "جميع المنتجات", to: "/shop" },
                { en: "Electronics", ar: "إلكترونيات", to: "/shop?cat=electronics" },
                { en: "Home & Kitchen", ar: "منزل ومطبخ", to: "/shop?cat=home" },
                { en: "Health & Beauty", ar: "صحة وجمال", to: "/shop?cat=health" },
                { en: "Kids & Baby", ar: "أطفال وأمومة", to: "/shop?cat=kids" },
                { en: "Garden & Irrigation", ar: "حديقة وري", to: "/shop?cat=garden" },
                { en: "Pets", ar: "حيوانات أليفة", to: "/shop?cat=pets" },
                { en: "Tools", ar: "أدوات", to: "/shop?cat=tools" },
              ].map((item, i) => (
                <li key={i}>
                  <Link to={item.to} className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-colors"
                    style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? item.ar : item.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info Links */}
          <div>
            <h3 className="font-black text-primary-foreground mb-4 text-base"
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Information", "معلومات")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {[
                { en: "About Us", ar: "من نحن", to: "/about" },
                { en: "FAQ", ar: "الأسئلة الشائعة", to: "/faq" },
                { en: "Shipping Policy", ar: "سياسة الشحن", to: "/shipping" },
                { en: "Returns & Exchanges", ar: "الإرجاع والاستبدال", to: "/returns" },
                { en: "Contact Us", ar: "تواصل معنا", to: "/contact" },
              ].map((item, i) => (
                <li key={i}>
                  <Link to={item.to} className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-colors"
                    style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? item.ar : item.en}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Delivery Info */}
            <div className="mt-6 bg-primary-foreground/10 rounded-2xl p-4">
              <h4 className="font-bold text-primary-foreground text-sm mb-2"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Delivery Info", "معلومات التوصيل")}
              </h4>
              <div className="text-xs text-primary-foreground/70 flex flex-col gap-1"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <span>{t("Cash on Delivery available", "الدفع عند الاستلام متاح")}</span>
                <span>{t("Delivery across Lebanon", "التوصيل لجميع لبنان")}</span>
                <span>{t("1-3 business days", "1-3 أيام عمل")}</span>
              </div>
            </div>
          </div>

          {/* Newsletter + Social */}
          <div>
            <h3 className="font-black text-primary-foreground mb-4 text-base"
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Stay Updated", "ابقَ على اطلاع")}
            </h3>
            <p className="text-primary-foreground/70 text-sm mb-4"
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Subscribe for exclusive deals and new products.", "اشترك للحصول على عروض حصرية ومنتجات جديدة.")}
            </p>
            {subscribed ? (
              <div className="bg-primary-foreground/10 text-primary-foreground font-bold rounded-xl px-4 py-3 text-sm"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Thanks! You're subscribed.", "شكراً! تم اشتراكك.")}
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t("Your email", "بريدك الإلكتروني")}
                  className="rounded-xl bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 h-10"
                  style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
                  required
                />
                <Button type="submit" className="w-full bg-primary-foreground text-primary hover:bg-secondary rounded-xl h-10 font-bold text-sm"
                  style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Subscribe", "اشترك")}
                </Button>
              </form>
            )}

            {/* Social */}
            <div className="mt-6">
              <h4 className="font-bold text-primary-foreground text-sm mb-3"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Follow Us", "تابعنا")}
              </h4>
              <div className="flex gap-3">
                <a href="https://www.facebook.com/people/Trending-Store/61557075004536/" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110">
                  <Facebook className="w-5 h-5 text-primary-foreground" />
                </a>
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110">
                  <MessageCircle className="w-5 h-5 text-primary-foreground" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-primary-foreground/10" />

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-primary-foreground/60 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          <div style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            © 2025 Trending Store.{" "}
            {t("All rights reserved.", "جميع الحقوق محفوظة.")}
          </div>
          <div className={`flex items-center gap-4 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
            <Link to="/about" className="hover:text-primary-foreground transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("About", "من نحن")}
            </Link>
            <Link to="/delivery" className="hover:text-primary-foreground transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Delivery", "التوصيل")}
            </Link>
            <Link to="/contact" className="hover:text-primary-foreground transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Contact", "تواصل")}
            </Link>
            <Link to="/privacy" className="hover:text-primary-foreground transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Privacy", "الخصوصية")}
            </Link>
            <Link to="/terms" className="hover:text-primary-foreground transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Terms", "الشروط")}
            </Link>
            <div className="flex items-center gap-2 text-primary-foreground/50">
              <span style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Cash on Delivery", "الدفع عند الاستلام")}
              </span>
              <span>|</span>
              <span style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Delivery Across Lebanon", "التوصيل لكل لبنان")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}