import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Search, ShoppingCart, Menu, MessageCircle, Globe } from "lucide-react";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { useSiteSettings } from "@/components/useSiteSettings";
import CartDrawer from "@/components/CartDrawer";

export default function Header() {
  const { lang, toggleLang, t, isRTL } = useLanguage();
  const { cart, cartCount, subtotal, updateQty, removeFromCart } = useCart();
  const { whatsappNumber } = useSiteSettings();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border" : "bg-background border-b border-transparent"}`}
        style={{ direction: isRTL ? "rtl" : "ltr" }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between h-20 gap-4">

            {/* Left Nav (Desktop) */}
            <nav className="hidden lg:flex items-center gap-8 flex-1">
              <Link to="/shop" className="text-sm font-semibold text-foreground hover:text-primary transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Shop All", "تسوق الكل")}
              </Link>
              <Link to="/shop?cat=garden" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Garden & Tools", "حديقة وأدوات")}
              </Link>
              <Link to="/shop?cat=electronics" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Electronics", "إلكترونيات")}
              </Link>
              <Link to="/shop?cat=home" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Home & Kitchen", "منزل ومطبخ")}
              </Link>
            </nav>

            {/* Center Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center justify-center flex-1 lg:flex-none">
              <div className="flex flex-col items-center">
                <div className="font-black text-foreground tracking-widest text-2xl uppercase leading-none">
                  {isRTL ? "ترندينج" : "TRENDING"}
                </div>
                <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
                  {t("Store", "ستور")}
                </div>
              </div>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center justify-end gap-3 flex-1">
              {/* Search */}
              <Link to="/search" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary rounded-full transition-colors">
                  <Search className="w-5 h-5" />
                </Button>
              </Link>

              {/* Language Toggle */}
              <Button onClick={toggleLang} variant="ghost" size="sm" className="hidden sm:flex items-center gap-1.5 text-foreground hover:bg-muted rounded-full font-bold text-xs">
                <Globe className="w-4 h-4" />
                {lang === "ar" ? "EN" : "AR"}
              </Button>

              {/* WhatsApp */}
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary rounded-full transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </a>

              {/* Cart */}
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Button>

              {/* Mobile Menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-muted">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRTL ? "right" : "left"} className="w-full sm:w-96 p-6" style={{ direction: isRTL ? "rtl" : "ltr" }}>
                  <div className="flex flex-col h-full">
                    <div className="font-black text-foreground tracking-widest text-xl uppercase mb-8">
                      {isRTL ? "ترندينج" : "TRENDING"}
                    </div>
                    <nav className="flex flex-col gap-1 flex-1">
                      {[
                        { to: "/", en: "Home", ar: "الرئيسية" },
                        { to: "/shop", en: "Shop All", ar: "جميع المنتجات" },
                        { to: "/shop?cat=garden", en: "Garden & Tools", ar: "حديقة وأدوات" },
                        { to: "/shop?cat=electronics", en: "Electronics", ar: "إلكترونيات" },
                        { to: "/shop?cat=home", en: "Home & Kitchen", ar: "منزل ومطبخ" },
                        { to: "/shop?cat=health", en: "Health & Beauty", ar: "صحة وجمال" },
                        { to: "/shop?cat=kids", en: "Kids & Baby", ar: "أطفال وأمومة" },
                        { to: "/shop?cat=pets", en: "Pets", ar: "حيوانات أليفة" },
                      ].map(item => (
                        <Link
                          key={item.to + item.en}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className="text-xl font-bold py-4 border-b border-border transition-colors hover:text-primary"
                          style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                        >
                          {isRTL ? item.ar : item.en}
                        </Link>
                      ))}
                    </nav>
                    <div className="mt-auto pt-8 flex flex-col gap-3">
                      <Button onClick={toggleLang} variant="outline" className="w-full justify-center h-12 rounded-xl text-base font-bold">
                        <Globe className="w-5 h-5 mr-2" />
                        {lang === "ar" ? "Switch to English" : "التبديل للعربية"}
                      </Button>
                      <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button className="w-full justify-center h-12 rounded-xl text-base font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                          <MessageCircle className="w-5 h-5 mr-2" />
                          {t("Order via WhatsApp", "اطلب عبر واتساب")}
                        </Button>
                      </a>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        updateQty={updateQty}
        removeFromCart={removeFromCart}
        subtotal={subtotal}
        isRTL={isRTL}
        t={t}
      />

      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("مرحبا، أريد الاستفسار عن منتج من ترندينج ستور")}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed bottom-6 ${isRTL ? "left-6" : "right-6"} z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300`}
        title="WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" fill="currentColor" />
      </a>
    </>
  );
}