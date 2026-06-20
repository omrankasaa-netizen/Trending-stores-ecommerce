import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ShoppingCart, Play } from "lucide-react";

const WHATSAPP = "96181751841";

function formatPrice(p) {
  if (!p) return "";
  return p >= 1000 ? `$${(p / 1000).toFixed(0)}` : `$${p}`;
}

function buildWhatsAppUrl(product, isRTL) {
  const name = isRTL ? product.name_ar : product.name;
  const msg = isRTL
    ? `مرحبا، أريد الطلب: ${name} - السعر: ${formatPrice(product.price)}`
    : `Hi, I want to order: ${name} - Price: ${formatPrice(product.price)}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export default function ProductCard({ product, isRTL, onAddToCart }) {
  const name = isRTL ? (product.name_ar || product.name) : product.name;
  const desc = isRTL ? (product.short_description_ar || product.short_description) : product.short_description;

  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;

  return (
    <div className="group flex flex-col h-full bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <Link to={`/product/${product.id}`} className="block relative">
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          <img
            src={product.image_url || "https://placehold.co/400x400?text=Product"}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount && <Badge className="bg-red-500 text-white text-xs font-bold px-2 py-0.5">-{discount}%</Badge>}
            {product.is_new && <Badge className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5">NEW</Badge>}
            {product.is_bestseller && <Badge className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5">⭐ BEST</Badge>}
            {product.is_trending && <Badge className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5">🔥</Badge>}
          </div>
          {product.video_url && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              </div>
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
          <span className="text-lg font-black text-foreground">{formatPrice(product.price)}</span>
          {product.compare_at_price && (
            <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl h-10 text-sm font-bold gap-1.5"
            onClick={() => window.open(buildWhatsAppUrl(product, isRTL), "_blank")}
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            <MessageCircle className="w-4 h-4" />
            {isRTL ? "واتساب" : "WhatsApp"}
          </Button>
          {onAddToCart && (
            <Button
              variant="outline"
              className="rounded-xl h-10 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => onAddToCart(product)}
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}