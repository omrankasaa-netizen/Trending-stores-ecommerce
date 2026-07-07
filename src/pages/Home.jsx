import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Truck, Shield, RotateCcw, X as XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { useSiteSettings } from "@/components/useSiteSettings";
import { useToast } from "@/components/ui/use-toast";
import ProductCard from "@/components/ProductCard";

const AnimatedElement = ({ children, className = "", delay = 0, direction = "up" }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const tm = setTimeout(() => setIsVisible(true), Math.min(delay, 200));
      return () => clearTimeout(tm);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => setIsVisible(true), delay);
        observer.unobserve(el);
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const translateClass = direction === "left" ? "-translate-x-12" : direction === "right" ? "translate-x-12" : "translate-y-12";

  return (
    <div ref={ref} className={`transition-all duration-1000 ease-out ${isVisible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${translateClass}`} ${className}`}>
      {children}
    </div>
  );
};

function AnnouncementBar({ isRTL, settings }) {
  const [visible, setVisible] = useState(true);
  const text = isRTL
    ? settings.get("announcement_ar", "توصيل لكل لبنان | الدفع عند الاستلام")
    : settings.get("announcement_en", "Delivery across Lebanon | Cash on Delivery");
  if (!visible || !text) return null;
  return (
    <div className="bg-primary text-primary-foreground py-2.5 px-4 text-center text-xs font-semibold relative flex items-center justify-center tracking-wide" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <Sparkles className="w-3.5 h-3.5 mx-2 opacity-70" />
      <span style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>{text}</span>
      <Sparkles className="w-3.5 h-3.5 mx-2 opacity-70" />
      <button onClick={() => setVisible(false)} className={`absolute ${isRTL ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-primary-foreground/70 hover:text-primary-foreground transition-colors p-1`}>
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function HeroSection({ t, isRTL, banner }) {
  const headline = banner ? (isRTL ? (banner.headline_ar || banner.headline) : banner.headline) : null;
  const subtext = banner ? (isRTL ? (banner.subtext_ar || banner.subtext) : banner.subtext) : null;
  const buttonText = banner ? (isRTL ? (banner.button_text_ar || banner.button_text) : banner.button_text) : null;

  // Default to the committed hero flat-lay when no admin banner image is set.
  // The artwork keeps its product flat-lay on the right and empty warm space on
  // the left, so text lives on the left in LTR. For RTL the copy flips to the
  // right, so we mirror the image to keep the empty space behind the text.
  const heroImage = banner?.image_url || "/seed/hero.jpg";

  return (
    <section className="relative w-full min-h-[70vh] flex items-center justify-center overflow-hidden bg-secondary/40" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="absolute inset-0 z-0">
        {heroImage && (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className={`w-full h-full object-cover object-center ${isRTL ? "scale-x-[-1]" : ""}`}
          />
        )}
        {/* Directional overlay: solid background on the text side fading to
            transparent over the product area keeps the headline WCAG-readable. */}
        <div className={`absolute inset-0 ${isRTL ? "bg-gradient-to-l" : "bg-gradient-to-r"} from-background via-background/85 to-transparent`} />
        {/* Extra veil on small screens where text can overlap the busy product area. */}
        <div className="absolute inset-0 bg-background/40 sm:bg-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 -left-20 w-80 h-80 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 sm:px-12 py-20 flex flex-col justify-center min-h-[70vh]">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="max-w-2xl">
          <Badge className="mb-6 bg-background/20 backdrop-blur-md text-foreground border border-border px-4 py-1.5 text-sm font-medium tracking-wide rounded-full">
            {t("Lebanon's Trending Store", "متجر ترندينج ستور - لبنان")}
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-[1.1] mb-6" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            {headline || t("Smart finds for everyday life.", "كل جديد ومفيد لحياتك اليومية.")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed font-medium" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            {subtext || t("Discover the latest smart gadgets and practical products. Delivery across Lebanon, Cash on Delivery.", "اكتشف أحدث الأدوات الذكية والمنتجات العملية. التوصيل لجميع أنحاء لبنان والدفع عند الاستلام.")}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to={banner?.link_target || "/shop"}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-10 h-14 text-base font-bold transition-all duration-300 hover:scale-105">
                {buttonText || t("Shop now", "تسوق الآن")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TrustStrip({ isRTL }) {
  const items = [
    { icon: <Truck className="w-6 h-6" />, en: "Delivery across Lebanon", ar: "توصيل لكل لبنان" },
    { icon: <Shield className="w-6 h-6" />, en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
    { icon: <RotateCcw className="w-6 h-6" />, en: "Easy Returns", ar: "إرجاع سهل" },
  ];
  return (
    <section className="bg-[#E8F0F2] border-y border-white/50" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-center gap-3 text-[#4A6E78]">
            {it.icon}
            <span className="font-bold text-sm sm:text-base" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {isRTL ? it.ar : it.en}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductRail({ t, isRTL, title, titleAr, products, onAddToCart }) {
  const scrollerRef = useRef(null);

  // Scroll roughly one viewport of cards. In RTL the scroll axis is inverted,
  // so a "next" (end-ward) tap must move scrollLeft in the reading direction.
  const scrollByViewport = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: (isRTL ? -1 : 1) * dir * amount, behavior: "smooth" });
  };

  if (!products || products.length === 0) return null;
  return (
    <section className="py-20 bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <AnimatedElement>
          <div className="flex items-end justify-between gap-6 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {isRTL ? titleAr : title}
            </h2>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  aria-label={isRTL ? "التالي" : "Previous"}
                  onClick={() => scrollByViewport(-1)}
                  className="w-10 h-10 rounded-full border border-border bg-background text-foreground flex items-center justify-center hover:bg-muted transition-colors"
                >
                  {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  aria-label={isRTL ? "السابق" : "Next"}
                  onClick={() => scrollByViewport(1)}
                  className="w-10 h-10 rounded-full border border-border bg-background text-foreground flex items-center justify-center hover:bg-muted transition-colors"
                >
                  {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
              <Link to="/shop" className="text-muted-foreground hover:text-primary font-medium text-sm transition-colors">
                {t("Shop all", "تسوق الكل")}
              </Link>
            </div>
          </div>
        </AnimatedElement>
        {/* Horizontal, swipeable rail. overflow-x-auto + scroll-snap gives native
            touch swipe; the card widths leave the next card peeking without ever
            clipping the current card or its WhatsApp/cart action row. */}
        <div
          ref={scrollerRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain scroll-smooth -mx-6 px-6 sm:-mx-8 sm:px-8 pb-2"
          style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              className="snap-start shrink-0 w-[70%] sm:w-[45%] md:w-[31%] lg:w-[23.5%]"
            >
              <ProductCard product={p} isRTL={isRTL} onAddToCart={onAddToCart} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Reliable slug -> committed image mapping so category tiles render real photos
// even for the currently-seeded rows (whose stored image_url may be blank until
// a reseed). Slugs without an entry (e.g. kids, offers) fall back to a gradient.
const CATEGORY_IMAGES = {
  garden: "/seed/cat-garden.jpg",
  electronics: "/seed/cat-electronics.jpg",
  home: "/seed/cat-home.jpg",
  health: "/seed/cat-health.jpg",
  pets: "/seed/cat-pets.jpg",
  tools: "/seed/cat-tools.jpg",
};

function CategoryCardsSection({ t, isRTL, categories }) {
  if (!categories || categories.length === 0) return null;
  return (
    <section className="py-20 bg-muted/30" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <AnimatedElement>
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Shop by Category", "تسوق حسب الفئة")}
            </h2>
            <Link to="/shop">
              <Button variant="outline" className="rounded-full px-6 border-border hover:bg-muted text-sm font-semibold transition-all">
                {t("Shop all", "تسوق الكل")}
              </Button>
            </Link>
          </div>
        </AnimatedElement>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat, i) => {
            const catImage = cat.image_url || CATEGORY_IMAGES[cat.slug];
            return (
            <AnimatedElement key={cat.id || i} delay={i * 80}>
              <Link to={`/shop?cat=${cat.slug}`} className="group block relative rounded-[2rem] overflow-hidden aspect-[4/5] bg-secondary">
                {catImage ? (
                  <img
                    src={catImage}
                    alt={isRTL ? cat.name_ar : cat.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary transition-transform duration-1000 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <h3 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? (cat.name_ar || cat.name) : cat.name}
                  </h3>
                </div>
              </Link>
            </AnimatedElement>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const settings = useSiteSettings();

  const [banner, setBanner] = useState(null);
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [newest, setNewest] = useState([]);

  useEffect(() => {
    base44.entities.Banner.filter({ is_visible: true }, "display_order", 1)
      .then(rows => setBanner(rows?.[0] || null)).catch(() => {});
    base44.entities.Category.filter({ is_visible: true }, "display_order", 8)
      .then(rows => setCategories(rows || [])).catch(() => {});
    base44.entities.Product.filter({ status: "active", is_featured: true }, "-created_date", 8)
      .then(rows => setFeatured(rows || [])).catch(() => {});
    base44.entities.Product.filter({ status: "active", is_trending: true }, "-created_date", 8)
      .then(rows => setTrending(rows || [])).catch(() => {});
    base44.entities.Product.filter({ status: "active" }, "-created_date", 8)
      .then(rows => setNewest(rows || [])).catch(() => {});
  }, []);

  const handleAddToCart = (product) => {
    addToCart(product);
    toast({ title: t("Added to cart!", "تمت الإضافة للسلة!"), description: isRTL ? product.name_ar : product.name });
  };

  // Fall back to newest products if no featured products are flagged yet.
  const featuredRail = featured.length > 0 ? featured : newest;

  return (
    <div className="bg-background min-h-screen">
      <AnnouncementBar isRTL={isRTL} settings={settings} />
      <HeroSection t={t} isRTL={isRTL} banner={banner} />
      <TrustStrip t={t} isRTL={isRTL} />
      <ProductRail t={t} isRTL={isRTL} title="Trending Products" titleAr="منتجات رائجة" products={featuredRail} onAddToCart={handleAddToCart} />
      <CategoryCardsSection t={t} isRTL={isRTL} categories={categories} />
      {trending.length > 0 && (
        <ProductRail t={t} isRTL={isRTL} title="Best Sellers" titleAr="الأكثر مبيعاً" products={trending} onAddToCart={handleAddToCart} />
      )}
    </div>
  );
}
