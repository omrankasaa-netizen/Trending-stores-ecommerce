import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/useLanguage";
import { ChevronDown } from "lucide-react";

// Public FAQ page. Reads Faq rows (seeded in server/seedContent.js, editable by
// admins). Groups by category and renders bilingual accordion items.
export default function Faq() {
  const { t, isRTL } = useLanguage();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const font = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };

  useEffect(() => {
    base44.entities.Faq.filter({ is_visible: true }, "sort_order")
      .then((rows) => setFaqs(Array.isArray(rows) ? rows : []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-12 px-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-black" style={font}>
          {t("Frequently Asked Questions", "الأسئلة الشائعة")}
        </h1>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {loading ? (
          <div className="text-center text-muted-foreground py-12" style={font}>...</div>
        ) : faqs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12" style={font}>
            {t("No questions yet.", "لا توجد أسئلة بعد.")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {faqs.map((f) => {
              const q = isRTL ? (f.question_ar || f.question) : (f.question || f.question_ar);
              const a = isRTL ? (f.answer_ar || f.answer) : (f.answer || f.answer_ar);
              const isOpen = open === f.id;
              return (
                <div key={f.id} className="bg-muted/40 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : f.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start"
                    style={font}
                  >
                    <span className="font-bold text-foreground">{q}</span>
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed" style={font}>
                      {a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
