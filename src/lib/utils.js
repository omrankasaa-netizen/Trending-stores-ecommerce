import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Prices are stored as whole US dollars. Render with a leading $ and no decimals.
export function formatPrice(p) {
  const n = Number(p) || 0;
  return `$${n.toLocaleString("en-US")}`;
}
