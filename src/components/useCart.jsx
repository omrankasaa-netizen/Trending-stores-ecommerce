import { useState, useEffect, useCallback } from "react";

const CART_KEY = "ts_cart";

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
}

// A cart line is uniquely identified by product + chosen size + chosen offer so
// the same product in two sizes (or two offers) are separate lines. Simple
// products with no size/offer collapse to just the product id (backward compat).
function lineKey(productId, sizeId = "", offerMin = "") {
  return [productId, sizeId || "", offerMin ?? ""].join("|");
}

export function useCart() {
  const [cart, setCart] = useState(readCart);

  // Keep every useCart() instance in sync: re-read on our custom event (same
  // tab) and on the native storage event (other tabs). This is what makes the
  // header cart count update the moment any component mutates the cart.
  useEffect(() => {
    const sync = () => setCart(readCart());
    window.addEventListener("cart-update", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-update", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveCart = useCallback((newCart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(newCart));
    setCart(newCart);
    window.dispatchEvent(new Event("cart-update"));
  }, []);

  // addToCart(product, qty, opts?)
  // opts (all optional) describe a chosen size + quantity offer resolved on the
  // product page: { size_id, size_label, size_label_ar, offer_min_quantity,
  // offer_label, offer_label_ar, unit_price, free_delivery, free_shipping }.
  const addToCart = useCallback((product, qty = 1, opts = {}) => {
    const current = readCart();
    const key = lineKey(product.id, opts.size_id, opts.offer_min_quantity);
    const unitPrice = opts.unit_price != null ? Number(opts.unit_price) : Number(product.price);
    const isOffer = opts.offer_min_quantity != null && opts.offer_min_quantity !== "";
    const existing = current.find((i) => (i.cart_key || i.product_id) === key);
    if (existing) {
      // Offer/bundle lines represent a fixed bundle → stack whole bundles.
      saveCart(current.map((i) => (i.cart_key || i.product_id) === key
        ? { ...i, quantity: i.quantity + qty }
        : i));
    } else {
      saveCart([...current, {
        cart_key: key,
        product_id: product.id,
        product_name: product.name,
        product_name_ar: product.name_ar,
        price: unitPrice,
        compare_at_price: product.compare_at_price,
        image_url: product.image_url,
        quantity: qty,
        size_id: opts.size_id || "",
        size_label: opts.size_label || "",
        size_label_ar: opts.size_label_ar || "",
        offer_min_quantity: isOffer ? Number(opts.offer_min_quantity) : null,
        offer_label: opts.offer_label || "",
        offer_label_ar: opts.offer_label_ar || "",
        free_delivery: !!opts.free_delivery,
        free_shipping: !!opts.free_shipping,
      }]);
    }
  }, [saveCart]);

  const removeFromCart = useCallback((key) => {
    saveCart(readCart().filter((i) => (i.cart_key || i.product_id) !== key));
  }, [saveCart]);

  const updateQty = useCallback((key, qty) => {
    if (qty < 1) return removeFromCart(key);
    saveCart(readCart().map((i) => (i.cart_key || i.product_id) === key ? { ...i, quantity: qty } : i));
  }, [saveCart, removeFromCart]);

  const clearCart = useCallback(() => saveCart([]), [saveCart]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return { cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, subtotal };
}
