import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { useCart } from "@/components/useCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, ShoppingCart, Truck, Shield, RotateCcw, ChevronRight, Plus, Minus, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import { getImagesForVariant, getImageFrameStyle, hasCrop } from "@/lib/productImages";
import { getSizes, sizeId, findSize, buildOfferOptions, isInStock } from "@/lib/pricing";
import { trackViewContent } from "@/lib/metaPixel";

const WHATSAPP = "96181751841";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [showVideo, setShowVideo] = useState(false);
  const [related, setRelated] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [selectedOfferKey, setSelectedOfferKey] = useState("single");

  useEffect(() => {
    base44.entities.Product.filter({ id }).then(([p]) => {
      setProduct(p);
      setLoading(false);
      if (p) trackViewContent(p, { value: p.price });
      const sizes = getSizes(p);
      if (sizes.length > 0) setSelectedSizeId(sizeId(sizes[0]));
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

  // Sizes & offers. Prices from the API are already markup-inclusive for the
  // storefront reader, so we resolve options with the default (0%) global pct to
  // avoid double-applying markup client-side.
  const sizes = getSizes(product);
  const selectedSize = sizes.length ? (findSize(product, selectedSizeId) || sizes[0]) : null;
  const offerOptions = buildOfferOptions(product, selectedSize);
  const selectedOffer = offerOptions.find((o) => o.key === selectedOfferKey) || offerOptions[0];
  const isBundle = selectedOffer.min_quantity > 1;

  // The qty stepper is a multiplier for BOTH modes. For a bundle offer it counts
  // how many copies of the bundle to buy: effective pieces = bundle size × qty
  // and the price scales by the same multiple. For a single unit it is just the
  // piece count.
  const effectiveQty = isBundle ? selectedOffer.min_quantity * qty : qty;
  const lineTotal = isBundle ? selectedOffer.total_price * qty : selectedOffer.unit_price * qty;
  const perUnit = selectedOffer.unit_price;

  // In stock for the current selection (per-size when a size is chosen, else the
  // product-level rule). Shared helper so card + detail agree. Untracked (blank)
  // stock is treated as available.
  const outOfStock = !isInStock(product, selectedSize);

  const basePrice = selectedSize && selectedSize.price != null ? Number(selectedSize.price) : Number(product.price);
  const discount = product.compare_at_price && product.compare_at_price > basePrice
    ? Math.round((1 - basePrice / product.compare_at_price) * 100) : null;

  // Gallery reflects the selected variant: a size's own photo(s) lead, falling
  // back to the product's default images when the size has none.
  const images = getImagesForVariant(product, selectedSize);
  const activeImage = images[Math.min(activeImg, Math.max(0, images.length - 1))] || null;

  const whatsappMsg = isRTL
    ? `مرحبا، أريد الطلب: ${name} (الكمية: ${effectiveQty}) - السعر: ${formatPrice(lineTotal)}`
    : `Hi, I want to order: ${name} (Qty: ${effectiveQty}) - Price: ${formatPrice(lineTotal)}`;

  const buildOpts = () => ({
    size_id: selectedSize ? sizeId(selectedSize) : "",
    size_label: selectedSize?.label || "",
    size_label_ar: selectedSize?.label_ar || "",
    offer_min_quantity: isBundle ? selectedOffer.min_quantity : "",
    offer_label: isBundle ? (selectedOffer.label || `${selectedOffer.min_quantity} pcs`) : "",
    offer_label_ar: isBundle ? (selectedOffer.label_ar || `${selectedOffer.min_quantity} قطع`) : "",
    unit_price: perUnit,
    free_delivery: !!product.free_delivery,
    free_shipping: !!selectedOffer.free_shipping,
  });

  // Add the current selection to the cart. `effectiveQty` is always the PIECE
  // count (bundle size × multiplier for offers, or the plain qty otherwise) and
  // `perUnit` the per-piece price, so price × quantity yields the correct line
  // total for single items and bundle multiples alike.
  const addSelectionToCart = () => addToCart(product, effectiveQty, buildOpts());

  const handleAddToCart = () => {
    addSelectionToCart();
    toast({ title: t("Added to cart!", "تمت الإضافة للسلة!"), description: name });
  };

  // Buy Now must land the exact current selection in the cart BEFORE navigating.
  // addToCart writes localStorage synchronously (see useCart.saveCart), so the
  // /checkout route reads the persisted item even on slow devices — no reliance
  // on a React state flush completing before navigation.
  const handleBuyNow = () => {
    if (outOfStock) return;
    addSelectionToCart();
    navigate("/checkout");
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
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-4xl font-black text-foreground">{formatPrice(lineTotal)}</span>
              {product.compare_at_price && product.compare_at_price > basePrice && (
                <span className="text-xl text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
              )}
              {discount && <span className="text-red-500 font-bold text-lg">{t(`Save ${discount}%`, `وفر ${discount}%`)}</span>}
            </div>
            {isBundle && (
              <p className="text-sm text-muted-foreground -mt-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t(`${formatPrice(perUnit)} per piece`, `${formatPrice(perUnit)} للقطعة`)}
              </p>
            )}
            {(product.free_delivery || selectedOffer.free_shipping) && (
              <span className="inline-flex items-center gap-1.5 self-start text-xs font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full -mt-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                <Truck className="w-3.5 h-3.5" />
                {t("Free delivery on this item", "توصيل مجاني لهذا المنتج")}
              </span>
            )}

            {outOfStock && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {t("Currently out of stock", "هذا المنتج غير متوفر حالياً")}
              </div>
            )}

            <Separator />

            {/* Size selector */}
            {sizes.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Size", "المقاس")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const sid = sizeId(s);
                    const label = isRTL ? (s.label_ar || s.label) : (s.label || s.label_ar);
                    const soldOut = s.stock_quantity != null && Number(s.stock_quantity) <= 0;
                    const active = sid === (selectedSize ? sizeId(selectedSize) : "");
                    return (
                      <button
                        key={sid}
                        disabled={soldOut}
                        onClick={() => { setSelectedSizeId(sid); setSelectedOfferKey("single"); setActiveImg(0); setShowVideo(false); }}
                        className={`px-4 h-11 rounded-xl border-2 font-bold text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"} ${soldOut ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                        style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Offer / bundle selector */}
            {offerOptions.length > 1 && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Choose an offer", "اختر العرض")}
                </p>
                <div className="flex flex-col gap-2">
                  {offerOptions.map((o) => {
                    const active = o.key === selectedOfferKey;
                    const custom = isRTL ? o.label_ar : o.label;
                    const qtyLabel = o.min_quantity > 1
                      ? t(`${o.min_quantity} pcs`, `${o.min_quantity} قطع`)
                      : t("1 pc", "قطعة واحدة");
                    return (
                      <button
                        key={o.key}
                        onClick={() => setSelectedOfferKey(o.key)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary"}`}
                        style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                      >
                        <span className="flex items-center gap-2">
                          {custom || qtyLabel}
                          {o.free_shipping && <span className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{t("Free delivery", "توصيل مجاني")}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-primary">{formatPrice(o.total_price)}</span>
                          {o.min_quantity > 1 && <span className="text-xs text-muted-foreground">({formatPrice(o.unit_price)}{t("/pc", "/قطعة")})</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity stepper. For a bundle offer this multiplies whole
                bundles (e.g. 2 × a 5-piece offer = 10 pieces); otherwise it is
                the single-item piece count. */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                {isBundle ? t("Number of offers", "عدد العروض") : t("Quantity", "الكمية")}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={t("Decrease quantity", "إنقاص الكمية")}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-xl font-black w-8 text-center">{qty}</span>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQty(q => q + 1)} aria-label={t("Increase quantity", "زيادة الكمية")}>
                  <Plus className="w-4 h-4" />
                </Button>
                {isBundle && (
                  <span className="text-sm text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                    {t(`= ${effectiveQty} pcs`, `= ${effectiveQty} قطعة`)}
                  </span>
                )}
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
                <Button onClick={handleBuyNow} disabled={outOfStock} className="flex-1 h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 disabled:opacity-50" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {t("Buy Now", "اشترِ الآن")}
                </Button>
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