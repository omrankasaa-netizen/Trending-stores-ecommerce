import { useLanguage } from "@/components/useLanguage";
import { useSiteSettings } from "@/components/useSiteSettings";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone, Mail, MapPin, Facebook } from "lucide-react";

export default function Contact() {
  const { t, isRTL } = useLanguage();
  const { whatsappNumber } = useSiteSettings();
  const font = { fontFamily: isRTL ? "'Cairo', sans-serif" : undefined };
  const displayPhone = `+${String(whatsappNumber).replace(/^\+/, "")}`;

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="bg-primary text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl font-black mb-3" style={font}>{t("Contact Us", "تواصل معنا")}</h1>
        <p className="text-primary-foreground/80 text-lg" style={font}>
          {t("We're here to help — reach out anytime.", "نحن هنا لمساعدتك — تواصل معنا في أي وقت.")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 bg-muted/50 hover:bg-muted rounded-3xl p-6 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1" style={font}>{t("WhatsApp", "واتساب")}</h3>
              <p className="text-sm text-muted-foreground" dir="ltr">{displayPhone}</p>
            </div>
          </a>

          <a href={`tel:${displayPhone}`}
            className="flex items-center gap-4 bg-muted/50 hover:bg-muted rounded-3xl p-6 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1" style={font}>{t("Phone", "هاتف")}</h3>
              <p className="text-sm text-muted-foreground" dir="ltr">{displayPhone}</p>
            </div>
          </a>

          <a href="mailto:support@trending-stores.com"
            className="flex items-center gap-4 bg-muted/50 hover:bg-muted rounded-3xl p-6 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1" style={font}>{t("Email", "البريد الإلكتروني")}</h3>
              <p className="text-sm text-muted-foreground">support@trending-stores.com</p>
            </div>
          </a>

          <div className="flex items-center gap-4 bg-muted/50 rounded-3xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1" style={font}>{t("Location", "الموقع")}</h3>
              <p className="text-sm text-muted-foreground" style={font}>
                {t("Rafic Hariri Street, Tripoli, Lebanon", "شارع رفيق الحريري، طرابلس، لبنان")}
              </p>
            </div>
          </div>
        </div>

        <div className="text-center flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
            <Button className="h-12 px-8 rounded-xl font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white" style={font}>
              <MessageCircle className="w-5 h-5 mr-2" />
              {t("Message us on WhatsApp", "راسلنا على واتساب")}
            </Button>
          </a>
          <a href="https://www.facebook.com/people/Trending-Store/61557075004536/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="h-12 px-8 rounded-xl font-bold" style={font}>
              <Facebook className="w-5 h-5 mr-2" />
              {t("Facebook", "فيسبوك")}
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
