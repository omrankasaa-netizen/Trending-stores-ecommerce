import { useState, useEffect, useCallback } from "react";

const CART_KEY = "ts_cart";

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
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

  const addToCart = useCallback((product, qty = 1) => {
    const current = readCart();
    const existing = current.find(i => i.product_id === product.id);
    if (existing) {
      saveCart(current.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      saveCart([...current, {
        product_id: product.id,
        product_name: product.name,
        product_name_ar: product.name_ar,
        price: product.price,
        compare_at_price: product.compare_at_price,
        image_url: product.image_url,
        quantity: qty,
      }]);
    }
  }, [saveCart]);

  const removeFromCart = useCallback((productId) => {
    saveCart(readCart().filter(i => i.product_id !== productId));
  }, [saveCart]);

  const updateQty = useCallback((productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    saveCart(readCart().map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
  }, [saveCart, removeFromCart]);

  const clearCart = useCallback(() => saveCart([]), [saveCart]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return { cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, subtotal };
}
