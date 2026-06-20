import { useState, useEffect } from "react";

export function useCart() {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ts_cart") || "[]"); } catch { return []; }
  });

  const saveCart = (newCart) => {
    localStorage.setItem("ts_cart", JSON.stringify(newCart));
    setCart(newCart);
    window.dispatchEvent(new Event("cart-update"));
  };

  const addToCart = (product, qty = 1) => {
    const existing = cart.find(i => i.product_id === product.id);
    if (existing) {
      saveCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      saveCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        product_name_ar: product.name_ar,
        price: product.price,
        image_url: product.image_url,
        quantity: qty
      }]);
    }
  };

  const removeFromCart = (productId) => saveCart(cart.filter(i => i.product_id !== productId));

  const updateQty = (productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    saveCart(cart.map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => saveCart([]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return { cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, subtotal };
}