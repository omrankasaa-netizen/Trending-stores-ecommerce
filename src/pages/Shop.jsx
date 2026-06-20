import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ALL_OPTION = { en: "All", ar: "الكل", val: "all" };
const STATIC_CATEGORIES = [
  ALL_OPTION,
  { en: "Garden & Irrigation", ar: "حديقة وري", val: "garden" },
  { en: "Electronics", ar: "إلكترونيات", val: "electronics" },
  { en: "Home & Kitchen", ar: "منزل ومطبخ", val: "home" },
  { en: "Health & Beauty", ar: "صحة وجمال", val: "health" },
  { en: "Kids & Baby", ar: "أطفال وأمومة", val: "kids" },
  { en: "Pets", ar: "حيوانات أليفة", val: "pets" },
  { en: "Tools", ar: "أدوات", val: "tools" },
];

export default function Shop() {
  const { t, isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(STATIC_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("cat") || "all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    base44.entities.Product.filter({ status: "active" }, "-created_date", 100)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));

    // Prefer real categories from the backend; fall back to the static list.
    base44.entities.Category.filter({ is_visible: true }, "display_order", 100)
      .then(rows => {
        if (rows && rows.length) {
          setCategories([ALL_OPTION, ...rows.map(c => ({ en: c.name, ar: c.name_ar || c.name, val: c.slug }))]);
        }
      })
      .catch(() => {});
  }, []);

  // Keep the selected category in sync with the ?cat= URL param.
  useEffect(() => {
    setCategory(searchParams.get("cat") || "all");
  }, [searchParams]);

  const selectCategory = (val) => {
    setCategory(val);
    if (val === "all") setSearchParams({});
    else setSearchParams({ cat: val });
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    toast({
      title: t("Added to cart!", "تمت الإضافة للسلة!"),
      description: isRTL ? product.name_ar : product.name,
    });
  };

  const filtered = products
    .filter(p => {
      const name = (p.name + " " + (p.name_ar || "")).toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchCat = category === "all" || p.category === category;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "newest") return new Date(b.created_date) - new Date(a.created_date);
      return 0;
    });

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Hero */}
      <div className="bg-primary text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl font-black mb-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("All Products", "جميع المنتجات")}
        </h1>
        <p className="text-primary-foreground/70 text-lg" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Practical gadgets for everyday life — Cash on Delivery across Lebanon", "أدوات عملية لحياتك اليومية — الدفع عند الاستلام في كل لبنان")}
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-4" : "left-4"} w-4 h-4 text-muted-foreground`} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("Search products...", "ابحث عن منتج...")}
              className={`${isRTL ? "pr-12" : "pl-12"} h-12 rounded-xl`}
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-4" : "right-4"}`}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full sm:w-44 h-12 rounded-xl" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("Newest", "الأحدث")}</SelectItem>
              <SelectItem value="price_asc">{t("Price: Low to High", "السعر: الأقل أولاً")}</SelectItem>
              <SelectItem value="price_desc">{t("Price: High to Low", "السعر: الأعلى أولاً")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(c => (
            <button
              key={c.val}
              onClick={() => selectCategory(c.val)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${category === c.val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
              style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
            >
              {isRTL ? c.ar : c.en}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-lg font-semibold">{t("No products found", "لا توجد منتجات")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} isRTL={isRTL} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}