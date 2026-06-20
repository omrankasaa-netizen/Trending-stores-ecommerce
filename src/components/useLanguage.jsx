import { useState, useEffect } from "react";

export function useLanguage() {
  const [lang, setLang] = useState(() => localStorage.getItem("ts_lang") || "ar");

  const toggleLang = () => {
    const next = lang === "ar" ? "en" : "ar";
    localStorage.setItem("ts_lang", next);
    setLang(next);
    window.location.reload();
  };

  const t = (en, ar) => lang === "ar" ? ar : en;
  const isRTL = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = isRTL ? "ar" : "en";
  }, [isRTL]);

  return { lang, toggleLang, t, isRTL };
}