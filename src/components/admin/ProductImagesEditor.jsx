import { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, X, Crop as CropIcon, Crosshair, Star } from "lucide-react";
import { getImageFrameStyle, hasCrop } from "@/lib/productImages";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

// 3:4 portrait aspect (width / height) — matches the storefront card box.
const ASPECT = 3 / 4;

// Normalize the various stored shapes into a consistent {url,focal,crop} object.
function normalize(entry) {
  if (typeof entry === "string") return { url: entry, focal: null, crop: null };
  return { url: entry?.url || "", focal: entry?.focal || null, crop: entry?.crop || null };
}

// Live 3:4 preview reused for the card-style framing.
function FramedPreview({ image, className = "" }) {
  const cropped = hasCrop(image);
  return (
    <div className={`relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      {image?.url ? (
        <img
          src={image.url}
          alt=""
          className={`w-full h-full ${cropped ? "object-fill" : "object-cover object-center"}`}
          style={getImageFrameStyle(image)}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
      )}
    </div>
  );
}

// Editor dialog body for a single image: focal-point picker + 3:4 crop.
function SingleImageEditor({ image, onChange }) {
  const [mode, setMode] = useState("focal"); // "focal" | "crop"
  const [crop, setCrop] = useState(null);
  const imgRef = useRef(null);
  const { t } = useAdminLanguage();

  const focal = image.focal || { x: 0.5, y: 0.5 };

  const setFocalFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onChange({ ...image, focal: { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) } });
  };

  const onImageLoad = (e) => {
    if (image.crop) {
      // Seed the crop UI from stored normalized values (percent units).
      setCrop({
        unit: "%",
        x: image.crop.x * 100,
        y: image.crop.y * 100,
        width: image.crop.width * 100,
        height: image.crop.height * 100,
      });
      return;
    }
    const { width, height } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, ASPECT, width, height),
      width,
      height
    );
    setCrop(c);
  };

  const applyCrop = () => {
    if (!crop || !crop.width) return;
    onChange({
      ...image,
      crop: {
        x: Number((crop.x / 100).toFixed(4)),
        y: Number((crop.y / 100).toFixed(4)),
        width: Number((crop.width / 100).toFixed(4)),
        height: Number((crop.height / 100).toFixed(4)),
      },
    });
  };

  const clearCrop = () => {
    onChange({ ...image, crop: null });
    setCrop(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-5">
      <div>
        <div className="flex gap-2 mb-3">
          <Button
            type="button" size="sm"
            variant={mode === "focal" ? "default" : "outline"}
            className="rounded-xl gap-1.5"
            onClick={() => setMode("focal")}
          >
            <Crosshair className="w-4 h-4" /> {t("Focal Point", "نقطة التركيز")}
          </Button>
          <Button
            type="button" size="sm"
            variant={mode === "crop" ? "default" : "outline"}
            className="rounded-xl gap-1.5"
            onClick={() => setMode("crop")}
          >
            <CropIcon className="w-4 h-4" /> {t("Crop Image (3:4)", "قص الصورة (3:4)")}
          </Button>
        </div>

        {mode === "focal" ? (
          <div
            className="relative inline-block max-w-full cursor-crosshair select-none rounded-xl overflow-hidden border"
            onClick={setFocalFromEvent}
          >
            <img src={image.url} alt="" className="max-h-[50vh] w-auto block" draggable={false} />
            <div
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-primary shadow-lg pointer-events-none"
              style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
            />
          </div>
        ) : (
          <div>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={ASPECT}
              keepSelection
            >
              <img
                ref={imgRef}
                src={image.url}
                alt=""
                onLoad={onImageLoad}
                className="max-h-[50vh] w-auto block"
                crossOrigin="anonymous"
              />
            </ReactCrop>
            <div className="flex gap-2 mt-3">
              <Button type="button" size="sm" className="rounded-xl" onClick={applyCrop}>{t("Apply Crop", "تطبيق القص")}</Button>
              {image.crop && (
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={clearCrop}>{t("Clear Crop", "إلغاء القص")}</Button>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {mode === "focal"
            ? t("Click on the image to set which part appears in the center of the card.", "اضغط على الصورة لتحديد الجزء الذي يظهر في وسط البطاقة.")
            : t("Drag to select a 3:4 crop area. Cropping is non-destructive — the original image stays intact.", "اسحب لتحديد منطقة القص بنسبة 3:4. القص غير متلف — الصورة الأصلية تبقى كما هي.")}
        </p>
      </div>

      <div>
        <Label className="text-xs font-bold block mb-2">{t("Card Preview (3:4)", "معاينة البطاقة (3:4)")}</Label>
        <FramedPreview image={image} />
      </div>
    </div>
  );
}

export default function ProductImagesEditor({ images, onChange }) {
  const list = (Array.isArray(images) ? images : []).map(normalize);
  const [uploading, setUploading] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const { t, isRTL } = useAdminLanguage();

  const update = (next) => onChange(next);

  const uploadImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (file_url) uploaded.push({ url: file_url, focal: null, crop: null });
      }
      update([...list, ...uploaded]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAt = (i) => update(list.filter((_, idx) => idx !== i));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const setImageMeta = (i, img) => {
    const next = [...list];
    next[i] = img;
    update(next);
  };

  return (
    <div>
      <Label className="font-black text-base block mb-2">{t("Product Images (shown in the card gallery)", "صور المنتج (تظهر في معرض البطاقة)")}</Label>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {list.map((img, i) => (
          <div key={i} className="relative group">
            <FramedPreview image={img} />
            {i === 0 && (
              <span className={`absolute top-1.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isRTL ? "right-1.5" : "left-1.5"}`}>
                <Star className="w-2.5 h-2.5" fill="white" /> {t("Main", "الرئيسية")}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="w-6 h-6 rounded-md bg-white/90 text-xs disabled:opacity-40">‹</button>
              <button type="button" onClick={() => setEditIndex(i)}
                className="px-2 h-6 rounded-md bg-white/90 text-[11px] font-bold">{t("Edit", "تعديل")}</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1}
                className="w-6 h-6 rounded-md bg-white/90 text-xs disabled:opacity-40">›</button>
            </div>
            <button type="button" onClick={() => removeAt(i)}
              className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <label className="cursor-pointer aspect-[3/4] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-colors">
          <ImageIcon className="w-7 h-7 text-muted-foreground mb-1.5" />
          <span className="text-xs font-bold px-1">{uploading ? t("Uploading...", "جاري الرفع...") : t("Add Images", "إضافة صور")}</span>
          <span className="text-[10px] text-muted-foreground">JPG, PNG</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} disabled={uploading} />
        </label>
      </div>

      {editIndex != null && list[editIndex] && (
        <div className="mt-4 border rounded-2xl p-4 bg-gray-50/60">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm">{t(`Framing image ${editIndex + 1}`, `تأطير الصورة ${editIndex + 1}`)}</span>
            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setEditIndex(null)}>{t("Done", "تم")}</Button>
          </div>
          <SingleImageEditor image={list[editIndex]} onChange={(img) => setImageMeta(editIndex, img)} />
        </div>
      )}
    </div>
  );
}
