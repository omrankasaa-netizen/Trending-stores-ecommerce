import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import ConsentBanner from "./ConsentBanner.jsx";
import { initMetaPixel, trackPageView } from "@/lib/metaPixel";

export default function Layout() {
  const location = useLocation();

  // Activate the Meta pixel (only if configured + consent already granted) and
  // fire a PageView on every client-side route change. All no-ops when the pixel
  // is unset or consent is withheld.
  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    trackPageView();
  }, [location.pathname]);

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}
