import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ShoppingCart, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { getProductImages, getImageFrameStyle, hasCrop, imageSrc } from "@/lib/productImages";
import { getSizes, getTiers, isAvailable, getDisplayPrice } from "@/lib/pricing";

const WHATSAPP = "96181751841";

function buildWhatsAppUrl(product, isRTL) {
  const name = isRTL ? product.name_ar : product.name;
  const msg = isRTL
    ? `مرحبا، أريد الطلب: ${name} - السعر: ${formatPrice(getDisplayPrice(product))}`
    : `Hi, I want to order: ${name} - Price: ${formatPrice(getDisplayPrice(product))}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

// A single framed image inside the fixed 3:4 box. Honors focal/crop metadata.
function CardImage({ image, alt, eager }) {
  const cropped = hasCrop(image);
  return (
    <img
      src={imageSrc(image, "card") || "https://placehold.co/600x800?text=Product"}
      alt={alt}
      className={`w-full h-full ${cropped ? "object-fill" : "object-cover object-center"} transition-transform duration-500 group-hover:scale-105`}
      style={getImageFrameStyle(image)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

export default function ProductCard({ product, isRTL, onAddToCart }) {
  const name = isRTL ? (product.name_ar || product.name) : product.name;
  const desc = isRTL ? (product.short_description_ar || product.short_description) : product.short_description;

  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;

  // Products with sizes or quantity offers can't be quick-added from a card —
  // the shopper must choose a size/offer on the product page first.
  const hasVariants = getSizes(product).length > 0 || getTiers(product).length > 0;

  // Robust across the per-size stock model: a sized product is available when any
  // size has SELLABLE stock (on-hand − reserved), not when the (often blank)
  // product-level quantity does. Held reservations count as unavailable so a
  // fully-reserved item is not offered for browse/add.
  const outOfStock = !isAvailable(product);

  const images = getProductImages(product);
  const count = images.length;
  const hasCarousel = count > 1;

  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const touchStartX = useRef(null);

  // In RTL the "next" (forward) action should advance to a later photo, while
  // visually the arrow that points in the reading direction (left) means next.
  const go = (delta) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => {
      const next = (i + delta + count) % count;
      return next;
    });
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null || !hasCarousel) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    // Swipe left -> forward; in RTL the visual direction inverts.
    const forward = isRTL ? dx > 0 : dx < 0;
    setIndex((i) => (i + (forward ? 1 : -1) + count) % count);
    touchStartX.current = null;
  };

  return (
    <div className="group flex flex-col h-full bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <Link to={`/product/${product.id}`} className="block relative">
        <div
          className="relative aspect-[3/4] bg-gray-100 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {count > 0 ? (
            <CardImage image={images[safeIndex]} alt={name} eager={false} />
          ) : (
            <img
              src="https://placehold.co/600x800?text=Product"
              alt={name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {discount && <Badge className="bg-red-500 text-white text-xs font-bold px-2 py-0.5">-{discount}%</Badge>}
            {product.is_new && <Badge className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5">NEW</Badge>}
            {product.is_bestseller && <Badge className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5">⭐ BEST</Badge>}
            {product.is_trending && <Badge className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5">🔥</Badge>}
          </div>

          {product.video_url && !outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}

          {/* Multi-photo carousel controls (only when >1 image) */}
          {hasCarousel && (
            <>
              <button
                type="button"
                aria-label={isRTL ? "السابق" : "Previous"}
                onClick={go(isRTL ? 1 : -1)}
                className="absolute top-1/2 -translate-y-1/2 left-2 z-20 w-8 h-8 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity max-md:opacity-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={isRTL ? "التالي" : "Next"}
                onClick={go(isRTL ? -1 : 1)}
                className="absolute top-1/2 -translate-y-1/2 right-2 z-20 w-8 h-8 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity max-md:opacity-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div
                className="absolute bottom-2.5 left-0 right-0 z-20 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity max-md:opacity-100"
                dir="ltr"
              >
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${isRTL ? "صورة" : "Image"} ${i + 1}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"} shadow`}
                  />
                ))}
              </div>
            </>
          )}

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] z-10">
              <span className="px-4 py-1.5 rounded-full bg-foreground/80 text-white text-xs font-black uppercase tracking-wide">
                {isRTL ? "نفذت الكمية" : "Out of Stock"}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-4 gap-3">
        <Link to={`/product/${product.id}`}>
          <h3
            className="font-bold text-foreground text-base leading-tight line-clamp-2 hover:text-primary transition-colors"
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            {name}
          </h3>
          {desc && (
            <p className="text-muted-foreground text-xs mt-1 line-clamp-2" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
              {desc}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-2 mt-auto">
          <span className="text-lg font-black text-foreground">{formatPrice(getDisplayPrice(product))}</span>
          {product.compare_at_price && (
            <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            disabled={outOfStock}
            className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl h-10 text-sm font-bold gap-1.5 disabled:opacity-50"
            onClick={() => window.open(buildWhatsAppUrl(product, isRTL), "_blank")}
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            <MessageCircle className="w-4 h-4" />
            {isRTL ? "واتساب" : "WhatsApp"}
          </Button>
          {onAddToCart && (
            hasVariants ? (
              <Link to={`/product/${product.id}`} className={outOfStock ? "pointer-events-none" : undefined}>
                <Button
                  variant="outline"
                  disabled={outOfStock}
                  className="rounded-xl h-10 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  title={isRTL ? "اختر المقاس/العرض" : "Choose size/offer"}
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                disabled={outOfStock}
                className="rounded-xl h-10 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                onClick={() => onAddToCart(product)}
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
