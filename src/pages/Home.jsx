import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Star, ChevronRight, MessageCircle, Truck, Shield, RotateCcw, Phone, Zap, Play, ChevronLeft, Award, Sparkles, Droplets, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/useLanguage";

// --- ANIMATION UTILITY ---
const AnimatedElement = ({ children, className = "", delay = 0, direction = "up" }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    
    // Check if already in viewport on mount to avoid unnecessary delays
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      // Small timeout ensures styles are applied after initial render
      const t = setTimeout(() => setIsVisible(true), Math.min(delay, 200));
      return () => clearTimeout(t);
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

  const translateClass = direction === "up" ? "translate-y-12" : direction === "left" ? "-translate-x-12" : direction === "right" ? "translate-x-12" : "translate-y-12";

  return (
    <div ref={ref} className={`transition-all duration-1000 ease-out ${isVisible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${translateClass}`} ${className}`}>
      {children}
    </div>
  );
};



// --- SECTIONS ---

function AnnouncementBar({ t, isRTL }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="bg-primary text-primary-foreground py-2.5 px-4 text-center text-xs font-semibold relative flex items-center justify-center tracking-wide" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <Sparkles className="w-3.5 h-3.5 mx-2 opacity-70" />
      <span style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
        {t("Free delivery on orders over $50 | Cash on Delivery across Lebanon", "توصيل مجاني للطلبات فوق 50$ | الدفع عند الاستلام في كل لبنان")}
      </span>
      <Sparkles className="w-3.5 h-3.5 mx-2 opacity-70" />
      <button onClick={() => setVisible(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-foreground/70 hover:text-primary-foreground transition-colors p-1">
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
const XIcon = (props) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;

function HeroSection({ t, isRTL }) {
  return (
    <section className="relative w-full min-h-[85vh] flex items-center justify-center overflow-hidden" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Background Image & Overlays */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/f46e11016_generated_image.png" 
          alt="Hero Background" 
          className="w-full h-full object-cover object-center"
          style={{ animation: 'slowZoom 20s ease-in-out infinite alternate' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-black/40" />
        {/* Decorative Orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none" style={{ animation: 'floatA 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 -left-20 w-80 h-80 bg-accent/30 rounded-full blur-[100px] mix-blend-screen pointer-events-none" style={{ animation: 'floatB 10s ease-in-out infinite reverse' }} />
      </div>

      {/* Store Logo — top center */}
      <div className="absolute top-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: "'Cairo', sans-serif" }}>TS</span>
          </div>
          <span className="text-white/80 font-bold text-sm tracking-widest uppercase" style={{ letterSpacing: '0.2em' }}>
            Trending Store
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 sm:px-12 py-20 flex flex-col justify-end min-h-[85vh] pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
             <Badge className="mb-6 bg-background/20 backdrop-blur-md text-white border border-white/20 px-4 py-1.5 text-sm font-medium tracking-wide rounded-full">
              {t("Lebanon's Trending Store", "متجر ترندينج ستور - لبنان")}
            </Badge>
          </motion.div>
          
          <h1 
            className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.1] mb-6"
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            {t("Smart finds for", "كل جديد ومفيد")}
            <br />
            {t("everyday life.", "لحياتك اليومية.")}
          </h1>
          
          <p 
            className="text-lg sm:text-xl text-white/90 mb-10 max-w-lg leading-relaxed font-medium"
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            {t("Even the hardest person to shop for loves our practical gadgets. It's a no-brainer.", "اكتشف أحدث الأدوات الذكية والمنتجات العملية. التوصيل لجميع أنحاء لبنان والدفع عند الاستلام.")}
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Link to="/Shop">
              <Button size="lg" className="bg-white text-foreground hover:bg-gray-100 rounded-full px-10 h-14 text-base font-bold transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                {t("Shop now", "تسوق الآن")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturedProductsSection({ t, isRTL }) {
  const [products, setProducts] = useState([]);
  const ProductEntity = base44.entities.Product;

  useEffect(() => {
    ProductEntity.list("-created_date", 4).then(setProducts).catch(() => {});
  }, []);

  const staticFallback = [
    { id: "1", name: "Smart Car Organizer", name_ar: "منظم مقعد السيارة", short_description: "Hydration tracking, Self cleaning", short_description_ar: "منافذ USB وحامل تابلت", price: 35000, compare_at_price: 55000, image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/fb68face9_generated_09de377e.png", is_new: true },
    { id: "2", name: "Portable Air Pump", name_ar: "مضخة هواء محمولة", short_description: "Inflate tires in seconds", short_description_ar: "انفخ الإطارات في ثوان", price: 42000, compare_at_price: 65000, image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/00ffda5f9_generated_f33c20db.png" },
    { id: "3", name: "Smart LED Desk Lamp", name_ar: "مصباح مكتب LED", short_description: "Touch control, USB charger", short_description_ar: "تحكم باللمس، شاحن USB", price: 38000, compare_at_price: 58000, image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/111222b7b_generated_a6d6809a.png", is_new: true },
    { id: "4", name: "Silicone Food Bags", name_ar: "أكياس سيليكون", short_description: "Eco-friendly, airtight", short_description_ar: "صديقة للبيئة، محكمة الإغلاق", price: 22000, image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/8e7c0ca65_generated_85cecbc1.png" },
  ];
  const displayItems = products.length > 0 ? products.slice(0, 4) : staticFallback;
  const formatPrice = (p) => `$${(p / 1000).toFixed(0)}`;

  return (
    <section className="py-24 bg-muted/30" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <AnimatedElement>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Trending Products", "منتجات رائجة")}
              </h2>
              <div className="flex gap-3">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors">Featured</Badge>
                <Badge className="bg-transparent text-muted-foreground hover:text-foreground border-none px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors">Smart Gadgets</Badge>
                <Badge className="bg-transparent text-muted-foreground hover:text-foreground border-none px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors">Home & Kitchen</Badge>
              </div>
            </div>
            <Link to="/Shop" className="text-muted-foreground hover:text-primary font-medium text-sm transition-colors hidden md:block">
              {t("Shop all", "تسوق الكل")}
            </Link>
          </div>
        </AnimatedElement>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayItems.map((product, i) => (
            <AnimatedElement key={product.id || i} delay={i * 100}>
              <Link to={`/product/${product.id || i}`} className="group flex flex-col h-full">
                <div className="relative aspect-[4/5] bg-secondary/40 rounded-2xl overflow-hidden mb-4 p-8 flex items-center justify-center transition-all duration-500 group-hover:shadow-xl group-hover:bg-secondary/60">
                  {product.is_new && (
                    <span className="absolute top-4 left-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">NEW</span>
                  )}
                  <img
                    src={product.image_url}
                    alt={isRTL ? product.name_ar : product.name}
                    className="w-full h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Decorative Swatches overlaying card */}
                   <div className="absolute bottom-4 left-4 flex gap-1.5 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                      <div className="w-5 h-5 rounded-full bg-[#E5E7EB] border-2 border-white shadow-sm" />
                      <div className="w-5 h-5 rounded-full bg-[#127a8a] border-2 border-white shadow-sm" />
                   </div>
                </div>
                
                <div className="px-1 flex flex-col flex-1">
                  <h3 className="font-bold text-foreground text-lg mb-1" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? product.name_ar : product.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-1 flex-1" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? product.short_description_ar : product.short_description}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-foreground">{formatPrice(product.price)}</span>
                    {product.compare_at_price && (
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
                    )}
                  </div>
                </div>
              </Link>
            </AnimatedElement>
          ))}
        </div>
        
        <div className="mt-8 text-center md:hidden">
            <Link to="/Shop">
                <Button variant="outline" className="rounded-full w-full max-w-xs">{t("Shop all", "تسوق الكل")}</Button>
            </Link>
        </div>
      </div>
    </section>
  );
}

function PromoBanner({ t, isRTL }) {
  return (
    <AnimatedElement>
      <section className="w-full bg-[#E8F0F2] py-6 overflow-hidden border-y border-white/50" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <div className="max-w-[1400px] mx-auto px-6">
           <div className="flex justify-between items-center whitespace-nowrap opacity-60 text-lg md:text-2xl font-bold tracking-tight text-[#4A6E78]">
              <span className="px-8">Smart Gadgets for life.</span>
              <span className="px-8 hidden sm:inline">Practical & Durable.</span>
              <span className="px-8 hidden md:inline">#TrendingLebanon</span>
              <span className="px-8 hidden lg:inline">Cash on Delivery.</span>
           </div>
        </div>
      </section>
    </AnimatedElement>
  );
}

function CategoryCardsSection({ t, isRTL }) {
  const categories = [
    { name: "Electronics", name_ar: "إلكترونيات", desc: "Browse smart gadgets.", desc_ar: "تصفح الأدوات الذكية.", image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/057e4a3be_generated_d134d616.png" },
    { name: "Home & Kitchen", name_ar: "منزل ومطبخ", desc: "Equip your home.", desc_ar: "جهز منزلك.", image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/e7cf6a770_generated_40ecd3ba.png" },
    { name: "Health & Beauty", name_ar: "صحة وجمال", desc: "Self-care essentials.", desc_ar: "أساسيات العناية بالذات.", image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/f3a857022_generated_57b02c37.png" },
    { name: "Accessories", name_ar: "اكسسوارات", desc: "Customize your gear.", desc_ar: "خصص معداتك.", image_url: "https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/bcaae43aa_generated_c601fa18.png" },
  ];

  return (
    <section className="py-24 bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <AnimatedElement>
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Shop by Category", "تسوق حسب الفئة")}
            </h2>
            <Link to="/Shop">
              <Button variant="outline" className="rounded-full px-6 border-border hover:bg-muted text-sm font-semibold transition-all">
                {t("Shop all", "تسوق الكل")}
              </Button>
            </Link>
          </div>
        </AnimatedElement>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, i) => (
            <AnimatedElement key={i} delay={i * 100}>
              <Link to="/Shop" className="group block relative rounded-[2rem] overflow-hidden aspect-[4/5] bg-secondary isolation-auto">
                <img
                  src={cat.image_url}
                  alt={isRTL ? cat.name_ar : cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-500" />
                
                <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col justify-end h-full">
                  <h3 className="text-2xl font-bold text-white mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? cat.name_ar : cat.name}
                  </h3>
                  <p className="text-white/80 text-sm mb-6 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-100" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? cat.desc_ar : cat.desc}
                  </p>
                  
                  <div className="bg-white/20 backdrop-blur-md self-start text-white text-sm font-semibold px-5 py-2.5 rounded-full flex items-center gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-200 hover:bg-white hover:text-foreground">
                    {t("Shop now", "تسوق الآن")}
                  </div>
                </div>
              </Link>
            </AnimatedElement>
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitPromoSection({ t, isRTL }) {
  return (
    <section className="py-24 bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-0 bg-[#F7F5F0] rounded-[2.5rem] overflow-hidden">
          
          <div className="p-12 md:p-20 flex flex-col justify-center order-2 lg:order-1">
            <AnimatedElement direction={isRTL ? "right" : "left"}>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Upgrade your daily routine", "ارتقِ بروتينك اليومي")}
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-md leading-relaxed" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("From smart kitchen gadgets to relaxing massagers, we bring the best trending products directly to your door in Lebanon.", "من أدوات المطبخ الذكية إلى أجهزة المساج المريحة، نجلب لك أفضل المنتجات الرائجة مباشرة إلى باب منزلك في لبنان.")}
              </p>
              <Link to="/Shop">
                <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-6 text-base font-bold transition-transform hover:-translate-y-1">
                  {t("Discover the Collection", "اكتشف التشكيلة")}
                </Button>
              </Link>
            </AnimatedElement>
          </div>
          
          <div className="relative h-[400px] lg:h-auto order-1 lg:order-2">
            <AnimatedElement className="h-full w-full" delay={200}>
              <img 
                src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/8e7c0ca65_generated_85cecbc1.png" 
                alt="Promo Lifestyle" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#F7F5F0] to-transparent w-32 hidden lg:block" />
            </AnimatedElement>
          </div>
          
        </div>
      </div>
    </section>
  );
}

function ReviewsBentoSection({ t, isRTL }) {
  return (
    <section className="py-24 bg-[#FAFAFA]" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        
        <AnimatedElement>
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("The reviews are pouring in", "التقييمات تتوالى")}
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex text-[#D9A05B]">
                 {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-current" />)}
              </div>
              <span className="text-sm text-muted-foreground underline cursor-pointer">
                {t("Based on 14,870 reviews", "بناءً على 14,870 تقييم")}
              </span>
            </div>
          </div>
        </AnimatedElement>

        {/* Bento Grid Layout mimicking the screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(250px,auto)]">
          
          {/* Large Video Box */}
          <AnimatedElement className="md:col-span-1 lg:col-span-1 row-span-2 relative rounded-3xl overflow-hidden group cursor-pointer">
            <img src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/fd824aec6_generated_fc031d1e.png" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
               <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 group-hover:bg-white/40 transition-colors">
                  <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
               </div>
               <p className="text-white text-lg font-medium leading-tight">
                 "Traditional gadgets collect unwanted dust. This is different."
               </p>
            </div>
             <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl p-3 flex items-center gap-3 shadow-lg">
                <div className="w-10 h-10 bg-muted rounded-xl"></div>
                <div>
                  <div className="text-xs font-bold text-foreground">Neck Massager Pro</div>
                  <div className="text-[10px] text-muted-foreground">Classic White</div>
                </div>
            </div>
          </AnimatedElement>

          {/* Text Review 1 */}
          <AnimatedElement delay={100} className="bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-center border border-border/50 hover:shadow-md transition-shadow">
             <p className="text-muted-foreground text-sm leading-relaxed mb-6 italic" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              "{t("Highly recommended for health-conscious individuals, families, and anyone who wants to ensure their daily tools are as clean and safe as possible while reducing environmental impact.", "نوصي به بشدة للأفراد الواعين بصحتهم وللعائلات.")}"
            </p>
            <div className="mt-auto">
               <div className="font-bold text-sm text-foreground">Manal Andos</div>
               <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600"/> Verified Buyer</div>
            </div>
          </AnimatedElement>

          {/* Text Review 2 */}
          <AnimatedElement delay={200} className="bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-center border border-border/50 hover:shadow-md transition-shadow">
             <p className="text-muted-foreground text-sm leading-relaxed mb-6 italic" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              "{t("It's been great. Took it with me on trips where water from fountains tastes very chlorinated. It saves you money in the long run.", "لقد كان رائعاً. أخذته معي في الرحلات. يوفر المال على المدى الطويل.")}"
            </p>
            <div className="mt-auto">
               <div className="font-bold text-sm text-foreground">Issac Williams</div>
               <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600"/> Verified Buyer</div>
            </div>
          </AnimatedElement>

          {/* Press Quote 1 */}
           <AnimatedElement delay={300} className="bg-[#F4F4F4] rounded-3xl p-8 shadow-sm flex flex-col justify-center border border-border/50 items-center text-center">
             <h3 className="text-xl font-bold text-foreground leading-snug mb-6">
               "What's the Next Status Water Bottle? Three of our staff see this as one to watch."
             </h3>
             <div className="font-serif font-bold text-xl tracking-tighter">Strategist</div>
          </AnimatedElement>

           {/* Press Quote 2 */}
           <AnimatedElement delay={400} className="bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-center border border-border/50 items-center text-center">
             <h3 className="text-xl font-bold text-foreground leading-snug mb-6">
               "The result is that every product is tested and fresh."
             </h3>
             <div className="font-bold text-sm uppercase tracking-widest text-muted-foreground">The Magazine</div>
          </AnimatedElement>

          {/* Medium Video Box */}
          <AnimatedElement delay={500} className="md:col-span-2 lg:col-span-1 row-span-2 relative rounded-3xl overflow-hidden group cursor-pointer bg-secondary">
             <img src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/111222b7b_generated_a6d6809a.png" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 mix-blend-multiply opacity-80" />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-16 h-16 rounded-full border-2 border-white/60 flex items-center justify-center group-hover:bg-white/20 transition-colors backdrop-blur-sm">
                  <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
               </div>
            </div>
             <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl p-3 flex items-center gap-3 shadow-lg">
                <div className="w-10 h-10 bg-muted rounded-xl"></div>
                <div>
                  <div className="text-xs font-bold text-foreground">Smart Lamp Pro</div>
                  <div className="text-[10px] text-muted-foreground">Matte Black</div>
                </div>
            </div>
          </AnimatedElement>

           {/* Large Video Box 2 */}
           <AnimatedElement delay={600} className="md:col-span-1 lg:col-span-2 row-span-2 relative rounded-3xl overflow-hidden group cursor-pointer">
            <img src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/62f73abc4_generated_27ab9a4f.png" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-between p-8">
               <div className="self-end w-12 h-12 rounded-full border border-white/40 flex items-center justify-center group-hover:bg-white/20 transition-colors backdrop-blur-sm">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
               </div>
               <p className="text-white text-xl font-medium leading-snug max-w-sm">
                 "The High-Tech Chopper removes prep time, making cooking super easy and fresh tasting."
               </p>
            </div>
             <div className="absolute bottom-8 right-8">
                <div className="text-white font-black text-2xl tracking-tighter italic">BEST<br/><span className="text-xs font-normal not-italic tracking-normal">PRODUCTS</span></div>
            </div>
          </AnimatedElement>

        </div>
      </div>
    </section>
  );
}

function NewsletterToolSection({ t, isRTL }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <section className="py-24 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <AnimatedElement className="max-w-md">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("What's in your everyday life?", "ماذا في حياتك اليومية؟")}
            </h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("Limits are designed to keep us safe, but bad habits slip through the cracks. Find out what's lurking in your routine and fix it.", "نحن هنا لنساعدك على تحسين جودة حياتك بأدوات ذكية وعملية.")}
            </p>
            
            {submitted ? (
              <div className="bg-primary/10 text-primary p-6 rounded-2xl font-semibold flex items-center gap-3">
                 <CheckCircle2 className="w-6 h-6" />
                {t("Thank you! Check your inbox.", "شكراً! تحقق من بريدك الإلكتروني.")}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t("Enter your email...", "أدخل بريدك الإلكتروني...")}
                  className="w-full h-16 rounded-full border-2 border-border pl-6 pr-32 text-base focus-visible:ring-0 focus-visible:border-primary"
                  style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
                  required
                />
                <Button 
                  type="submit" 
                  className={`absolute top-2 bottom-2 ${isRTL ? "left-2" : "right-2"} rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 font-bold`}
                  style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                >
                  {t("Analyze", "تحليل")}
                </Button>
              </form>
            )}
            
            <p className="text-xs text-muted-foreground mt-6 leading-relaxed italic opacity-70">
              *Our database pulls data from multiple user surveys to give users the most comprehensive view of product quality.
            </p>
          </AnimatedElement>

          <AnimatedElement delay={200} direction={isRTL ? "left" : "right"}>
            <div className="relative rounded-[2.5rem] overflow-hidden aspect-[4/3] shadow-2xl">
              <img 
                src="https://media.base44.com/images/public/6a365d9c3054f4093fbf60b5/057e4a3be_generated_d134d616.png" 
                alt="Quality Check" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                 <div className="text-white/90 font-black text-6xl md:text-8xl tracking-tighter mix-blend-overlay">PFOA</div>
              </div>
            </div>
          </AnimatedElement>

        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="bg-background min-h-screen">
      {/* Inline styles for custom animations extracted from code/needs */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 20px) scale(1.05); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -30px) scale(0.95); }
        }
        @keyframes slowZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}} />

      <AnnouncementBar t={t} isRTL={isRTL} />
      <HeroSection t={t} isRTL={isRTL} />
      <FeaturedProductsSection t={t} isRTL={isRTL} />
      <PromoBanner t={t} isRTL={isRTL} />
      <CategoryCardsSection t={t} isRTL={isRTL} />
      <SplitPromoSection t={t} isRTL={isRTL} />
      <ReviewsBentoSection t={t} isRTL={isRTL} />
      <NewsletterToolSection t={t} isRTL={isRTL} />
    </div>
  );
}