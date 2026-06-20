import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DEFAULTS = {
  whatsapp_number: "96181751841",
  delivery_fee: "3",
  free_delivery_threshold: "",
  store_name: "Trending Store",
  store_name_ar: "ترندينج ستور",
};

// Fetch the SiteSettings {key,value} rows once and expose them as a flat map
// with sensible fallbacks. Components read store-wide config (WhatsApp number,
// delivery fee, etc.) from here instead of hardcoding values.
export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const rows = await base44.entities.SiteSettings.list();
      const map = {};
      for (const r of rows || []) {
        if (r && r.key != null) map[r.key] = r.value;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = { ...DEFAULTS, ...(data || {}) };

  const num = (key, fallback = 0) => {
    const v = Number(settings[key]);
    return Number.isFinite(v) ? v : fallback;
  };

  return {
    settings,
    isLoading,
    whatsappNumber: settings.whatsapp_number,
    deliveryFee: num("delivery_fee", 0),
    freeDeliveryThreshold: settings.free_delivery_threshold ? num("free_delivery_threshold", 0) : 0,
    get: (key, fallback = "") => (settings[key] != null && settings[key] !== "" ? settings[key] : fallback),
  };
}
