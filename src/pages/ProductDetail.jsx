import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, ShoppingCart, Truck, Shield, RotateCcw, ChevronRight, Plus, Minus, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import { getProductImages, getImageFrameStyle, hasCrop } from "@/lib/productImages";

const WHATSAPP = "96181751841";

export default function ProductDetail() {
  const { id } = useParams();
  const { t, isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [showVideo, setShowVideo] = useState(false);
  const [related, setRelated] = useState([]);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    base44.entities.Product.filter({ id }).then(([p]) => {
      setProduct(p);
      setLoading(false);
      if (p?.category) {
        base44.entities.Product.filter({ category: p.category, status: "active" }, "-created_date", 5)
          .then(items => setRelated(items.filter(i => i.id !== p.id).slice(0, 4)));
      }
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p className="text-5xl">😕</p>
      <p className="text-xl font-semibold">{t("Product not found", "المنتج غير موجود")}</p>
      <Link to="/shop"><Button>{t("Back to Shop", "العودة للمتجر")}</Button></Link>
    </div>
  );

  const name = isRTL ? (product.name_ar || product.name) : product.name;
  const desc = isRTL ? (product.short_description_ar || product.short_description) : product.short_description;
  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;
  const outOfStock = Number(product.stock_quantity) <= 0;

  const images = getProductImages(product);
  const activeImage = images[Math.min(activeImg, Math.max(0, images.length - 1))] || null;

  const whatsappMsg = isRTL
    ? `مرحبا، أريد الطلب: ${name} (الكمية: ${qty}) - السعر: ${formatPrice(product.price * qty)}`
    : `Hi, I want to order: ${name} (Qty: ${qty}) - Price: ${formatPrice(product.price * qty)}`;

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) addToCart(product, 1);
    toast({ title: t("Added to cart!", "تمت الإضافة للسلة!"), description: name });
  };

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Breadcrumb */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          <Link to="/" className="hover:text-primary transition-colors">{t("Home", "الرئيسية")}</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/shop" className="hover:text-primary transition-colors">{t("Shop", "المتجر")}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{name}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Media */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square bg-muted rounded-3xl overflow-hidden">
              {showVideo && product.video_url ? (
                <video src={product.video_url} autoPlay controls className="w-full h-full object-cover" />
              ) : (
                <>
                  <img
                    src={activeImage?.url || product.image_url || "https://placehold.co/600x600"}
                    alt={name}
                    className={`w-full h-full ${hasCrop(activeImage) ? "object-fill" : "object-cover object-center"}`}
                    style={getImageFrameStyle(activeImage)}
                  />
                  {product.video_url && (
                    <button
                      onClick={() => setShowVideo(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                    >
                      <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
                      </div>
                    </button>
                  )}
                </>
              )}
              {discount && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-red-500 text-white text-base font-black px-3 py-1">-{discount}%</Badge>
                </div>
              )}
            </div>
            {product.video_url && !showVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-3 p-4 bg-muted/60 rounded-2xl hover:bg-muted transition-colors text-sm font-semibold"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
              >
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                </div>
                {t("Watch product demo", "شاهد فيديو المنتج")}
              </button>
            )}

            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveImg(i); setShowVideo(false); }}
                    className={`relative w-16 aspect-[3/4] rounded-xl overflow-hidden border-2 transition-colors ${i === activeImg && !showVideo ? "border-primary" : "border-transparent"}`}
                    aria-label={`${t("Image", "صورة")} ${i + 1}`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className={`w-full h-full ${hasCrop(img) ? "object-fill" : "object-cover object-center"}`}
                      style={getImageFrameStyle(img)}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {product.is_new && <Badge className="bg-primary text-primary-foreground">NEW</Badge>}
                {product.is_bestseller && <Badge className="bg-amber-500 text-white">⭐ BESTSELLER</Badge>}
                {product.is_trending && <Badge className="bg-purple-500 text-white">🔥 TRENDING</Badge>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {name}
              </h1>
              {desc && (
                <p className="text-muted-foreground text-lg mt-3 leading-relaxed" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {desc}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-black text-foreground">{formatPrice(product.price)}</span>
              {product.compare_at_price && (
                <span className="text-xl text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
              )}
              {discount && <span className="text-red-500 font-bold text-lg">{t(`Save ${discount}%`, `وفر ${discount}%`)}</span>}
            </div>

            {outOfStock && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Currently out of stock", "هذا المنتج غير متوفر حالياً")}
              </div>
            )}

            <Separator />

            {/* Qty */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Quantity", "الكمية")}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQty(q => Math.max(1, q - 1))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-xl font-black w-8 text-center">{qty}</span>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQty(q => q + 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <a
                href={outOfStock ? undefined : `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={outOfStock ? "pointer-events-none" : undefined}
              >
                <Button disabled={outOfStock} className="w-full h-14 text-lg font-black bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-2xl gap-3 shadow-lg shadow-green-200 disabled:opacity-50" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  <MessageCircle className="w-6 h-6" fill="white" />
                  {t("Order on WhatsApp", "اطلب عبر واتساب")}
                </Button>
              </a>
              <div className="flex gap-3">
                <Button onClick={handleAddToCart} disabled={outOfStock} variant="outline" className="flex-1 h-12 rounded-xl font-bold border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 disabled:opacity-50" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  <ShoppingCart className="w-5 h-5" />
                  {t("Add to Cart", "أضف للسلة")}
                </Button>
                <Link to="/checkout" className={`flex-1 ${outOfStock ? "pointer-events-none" : ""}`}>
                  <Button disabled={outOfStock} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 disabled:opacity-50" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {t("Buy Now", "اشترِ الآن")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Truck className="w-5 h-5" />, en: "Free Delivery over $50", ar: "توصيل مجاني +50$" },
                { icon: <Shield className="w-5 h-5" />, en: "Cash on Delivery", ar: "دفع عند الاستلام" },
                { icon: <RotateCcw className="w-5 h-5" />, en: "Easy Returns", ar: "إرجاع سهل" },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 p-3 bg-muted/50 rounded-2xl text-center">
                  <div className="text-primary">{b.icon}</div>
                  <span className="text-xs font-semibold text-muted-foreground leading-tight" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? b.ar : b.en}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="text-2xl font-black mb-6" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {t("You may also like", "قد يعجبك أيضاً")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} className="group">
                  <div className="aspect-square bg-muted rounded-2xl overflow-hidden mb-3">
                    <img src={p.image_url} alt={isRTL ? p.name_ar : p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <p className="font-bold text-sm line-clamp-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {isRTL ? p.name_ar : p.name}
                  </p>
                  <p className="text-primary font-black mt-1">{formatPrice(p.price)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}