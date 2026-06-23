import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";

// Renders a single CmsSection (legal/about page) by section_key. Bilingual:
// shows body_ar/title_ar when the UI is in Arabic, otherwise the English body.
// Content is seeded server-side (see server/seedContent.js) so these pages are
// never blank, and admins can edit them via the Content area.
export default function CmsPage({ sectionKey, fallbackTitle, fallbackTitleAr }) {
  const { isRTL } = useLanguage();
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const font = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  useEffect(() => {
    let alive = true;
    base44.entities.CmsSection.filter({ section_key: sectionKey }, null, 1)
      .then((rows) => { if (alive) setSection(Array.isArray(rows) ? rows[0] : null); })
      .catch(() => { if (alive) setSection(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sectionKey]);

  const title = isRTL
    ? (section?.title_ar || fallbackTitleAr || fallbackTitle)
    : (section?.title || fallbackTitle);
  const body = isRTL ? (section?.body_ar || section?.body) : (section?.body || section?.body_ar);

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-12 px-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-black" style={font}>{title}</h1>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {loading ? (
          <div className="text-center text-muted-foreground py-12" style={font}>...</div>
        ) : body ? (
          <article
            className="prose prose-sm sm:prose-base max-w-none prose-headings:font-black prose-headings:text-foreground prose-a:text-primary"
            style={font}
          >
            <ReactMarkdown>{body}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-center text-muted-foreground py-12" style={font}>
            {isRTL ? "المحتوى غير متوفر حالياً." : "Content is not available yet."}
          </p>
        )}
      </div>
    </div>
  );
}
