import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Search() {
  const { t, isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    base44.entities.Product.filter({ status: "active" }, "-created_date", 200)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const onChange = (val) => {
    setQuery(val);
    if (val) setSearchParams({ q: val });
    else setSearchParams({});
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    toast({
      title: t("Added to cart!", "تمت الإضافة للسلة!"),
      description: isRTL ? product.name_ar : product.name,
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter(p => {
        const hay = `${p.name || ""} ${p.name_ar || ""} ${p.description || ""} ${p.description_ar || ""} ${p.category || ""}`.toLowerCase();
        return hay.includes(q);
      })
    : [];

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-14 px-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-black mb-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Search", "بحث")}
        </h1>
        <p className="text-primary-foreground/70" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Find what you're looking for", "ابحث عمّا تريد")}
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        <div className="relative max-w-xl mx-auto mb-10">
          <SearchIcon className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-4" : "left-4"} w-4 h-4 text-muted-foreground`} />
          <Input
            value={query}
            onChange={e => onChange(e.target.value)}
            autoFocus
            placeholder={t("Search products...", "ابحث عن منتج...")}
            className={`${isRTL ? "pr-12" : "pl-12"} h-12 rounded-xl`}
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined, direction: isRTL ? "rtl" : "ltr" }}
          />
          {query && (
            <button onClick={() => onChange("")} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-4" : "right-4"}`}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : !q ? (
          <div className="text-center py-16 text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            <p className="text-lg font-semibold">{t("Type to start searching", "اكتب لبدء البحث")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-lg font-semibold">{t("No products found", "لا توجد منتجات")}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {filtered.length} {t("results", "نتيجة")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} isRTL={isRTL} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
