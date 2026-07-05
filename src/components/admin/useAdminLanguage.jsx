import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "trending-admin-lang";
const AdminLanguageContext = createContext(null);

function readStoredLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

/**
 * Admin-only language provider. Scoped to the admin panel so the customer-facing
 * storefront (which manages its own language via useLanguage) is never affected.
 * Persists the choice under `trending-admin-lang`, defaulting to Arabic.
 */
export function AdminLanguageProvider({ children }) {
  const [lang, setLang] = useState(readStoredLang);
  const isRTL = lang === "ar";

  const setLanguage = useCallback((next) => {
    const value = next === "en" ? "en" : "ar";
    localStorage.setItem(STORAGE_KEY, value);
    setLang(value);
  }, []);

  const toggleLang = useCallback(() => {
    setLanguage(lang === "ar" ? "en" : "ar");
  }, [lang, setLanguage]);

  // Drive the document direction/language while the admin panel is mounted, and
  // restore the storefront default (Arabic/RTL) when leaving the admin.
  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = isRTL ? "ar" : "en";
    return () => {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "ar";
    };
  }, [isRTL]);

  const t = useCallback((en, ar) => (lang === "ar" ? ar : en), [lang]);

  return (
    <AdminLanguageContext.Provider value={{ lang, setLanguage, toggleLang, t, isRTL, dir: isRTL ? "rtl" : "ltr" }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) {
    throw new Error("useAdminLanguage must be used within an AdminLanguageProvider");
  }
  return ctx;
}
