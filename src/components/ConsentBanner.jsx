import { useState, useEffect } from "react";
import { useLanguage } from "@/components/useLanguage";
import { Button } from "@/components/ui/button";
import {
  isPixelConfigured,
  hasConsentDecision,
  grantConsent,
  denyConsent,
} from "@/lib/metaPixel";
import { initTiktokPixel, trackTiktokPageView } from "@/lib/tiktokPixel";

// Bilingual cookie/tracking consent banner. It only appears when a Meta Pixel
// is actually configured AND the shopper has not decided yet. Accepting loads +
// activates the pixel; declining stores the choice and never loads it. If no
// pixel is configured, this renders nothing (silent no-op).
export default function ConsentBanner() {
  const { t, isRTL } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPixelConfigured() && !hasConsentDecision()) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    grantConsent();
    // The shared consent decision also gates TikTok — activate its pixel too.
    initTiktokPixel();
    trackTiktokPageView();
    setVisible(false);
  };
  const decline = () => { denyConsent(); setVisible(false); };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4"
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      <div className="max-w-3xl mx-auto bg-white border border-border shadow-lg rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p
          className="text-sm text-muted-foreground flex-1 leading-relaxed"
          style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
        >
          {t(
            "We use cookies and analytics to improve your experience and measure our ads. You can accept or decline.",
            "نستخدم ملفات تعريف الارتباط والتحليلات لتحسين تجربتك وقياس إعلاناتنا. يمكنك القبول أو الرفض."
          )}
        </p>
        <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={decline}
            className="flex-1 sm:flex-none rounded-xl font-bold"
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            {t("Decline", "رفض")}
          </Button>
          <Button
            onClick={accept}
            className="flex-1 sm:flex-none rounded-xl font-bold"
            style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
          >
            {t("Accept", "قبول")}
          </Button>
        </div>
      </div>
    </div>
  );
}
