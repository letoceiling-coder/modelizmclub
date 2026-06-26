import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import type { AdCondition, Category } from "@/lib/types";
import { fetchListingCategories, fetchCities } from "@/lib/api/catalog";
import { createListing } from "@/lib/api/listings";
import { uploadMedia } from "@/lib/api/media";
import { hasAuthForApi } from "@/lib/api/auth-api";
import { StepIndicator } from "@/components/ads/wizard/StepIndicator";
import { SuccessModal } from "@/components/ads/wizard/SuccessModal";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import {
  ChevronLeft, ChevronRight, ImagePlus, X, Star,
  Tag, ShoppingCart, ArrowLeftRight, MapPin, Truck, CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: tStatic("ads.newMetaTitle") }] }),
  component: NewAdPage,
});

type Status = "Продаю" | "Куплю" | "Обменяю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у — отлично", "Б/у — хорошо", "Под восстановление"];
const DELIVERIES = ["СДЭК", "Почта России", "Яндекс Доставка", "Ozon", "Wildberries"];
const MAX_PHOTOS = 10;

const STATUS_I18N = { "Продаю": "ads.statusSell", "Куплю": "ads.statusBuy", "Обменяю": "ads.statusSwap" } as const;
const CONDITION_I18N: Record<AdCondition, string> = {
  "Новое": "ads.conditionNew",
  "Б/у — отлично": "ads.conditionExcellent",
  "Б/у — хорошо": "ads.conditionGood",
  "Под восстановление": "ads.conditionRestore",
};

interface Photo {
  url: string;
  uuid?: string;
  uploading?: boolean;
}

interface Form {
  photos: Photo[];
  status: Status;
  title: string;
  description: string;
  price: string;
  categoryId: string;
  subcategoryId: string;
  condition: AdCondition;
  cityId: string;
  contact: string;
  deliveries: string[];
}

const emptyInitial = (): Form => ({
  photos: [],
  status: "Продаю",
  title: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  condition: "Б/у — отлично",
  cityId: "",
  contact: "",
  deliveries: ["СДЭК"],
});

function NewAdPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(emptyInitial);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchListingCategories().then((items) => {
      setCategories(items);
      if (items[0]) {
        setForm((f) => ({
          ...f,
          categoryId: items[0].id,
          subcategoryId: items[0].subcategories?.[0]?.id ?? "",
        }));
      }
    }).catch(() => setCategories([]));
    void fetchCities().then((items) => {
      setCities(items);
      if (items[0]) setForm((f) => (f.cityId ? f : { ...f, cityId: String(items[0].id) }));
    }).catch(() => setCities([]));
  }, []);

  const cat = useMemo(() => categories.find((c) => c.id === form.categoryId), [categories, form.categoryId]);
  const uploading = form.photos.some((p) => p.uploading);

  const valid = useMemo(() => {
    if (step === 1) return form.photos.length > 0 && !uploading;
    if (step === 2) return form.title.trim().length >= 4 && Boolean(form.price) && Boolean(form.cityId) && form.contact.trim().length > 0;
    return true;
  }, [step, form, uploading]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const stepLabels = [t("ads.stepPhotos"), t("ads.stepData"), t("ads.stepPreview")];
  const statusLabel = (s: Status) => t(STATUS_I18N[s]);

  const submit = async () => {
    if (!hasAuthForApi()) {
      toast.error(t("ads.authRequired"));
      navigate({ to: "/login" });
      return;
    }
    const mediaIds = form.photos.map((p) => p.uuid).filter((u): u is string => Boolean(u));
    const categoryId = Number(form.subcategoryId || form.categoryId);
    if (!categoryId) {
      toast.error(t("ads.categoryRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await createListing({
        title: form.title.trim(),
        description: form.description.trim() || form.title.trim(),
        category_id: Number(form.categoryId),
        subcategory_id: form.subcategoryId ? Number(form.subcategoryId) : undefined,
        price_cents: Math.round(Number(form.price || 0) * 100),
        city_id: form.cityId ? Number(form.cityId) : undefined,
        delivery_methods: form.deliveries,
        media_ids: mediaIds,
        publish: true,
      });
      setSuccess(true);
    } catch {
      toast.error(t("ads.publishError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-[24px] pb-[120px]">
        <header className="space-y-[6px]">
          <Link to="/ads" className="inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            <ChevronLeft size={14} /> {t("ads.backToList")}
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-none sm:text-[36px]"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {t("ads.newTitle")}
          </h1>
          <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
            {t("ads.newSubtitle")}
          </p>
        </header>

        <StepIndicator current={step} labels={stepLabels} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && <StepPhotos form={form} set={set} />}
            {step === 2 && cat && <StepData form={form} set={set} cat={cat} categories={categories} cities={cities} />}
            {step === 3 && cat && <StepPreview form={form} cat={cat} statusLabel={statusLabel} cities={cities} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur"
        style={{
          background: "color-mix(in srgb, var(--background) 88%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-[12px] px-[16px] py-[12px] sm:px-[24px]">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-[6px] px-[18px] text-[13px] font-medium transition-opacity disabled:opacity-30"
            style={{
              background: "transparent",
              color: "var(--foreground-70)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-button)",
              height: 44,
            }}
          >
            <ChevronLeft size={16} />{t("common.back")}</button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!valid}
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="inline-flex items-center gap-[6px] px-[20px] text-[13px] font-semibold transition-opacity disabled:opacity-40"
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-button)",
                boxShadow: "var(--shadow-button)",
                height: 44,
              }}
            >
              {t("ads.next")} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
              className="inline-flex items-center gap-[8px] px-[22px] text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-button)",
                boxShadow: "var(--shadow-button)",
                height: 44,
              }}
            >
              <CreditCard size={16} /> {submitting ? t("ads.publishing") : t("ads.payAndPublish")}
            </button>
          )}
        </div>
      </div>

      <SuccessModal open={success} onClose={() => { setSuccess(false); navigate({ to: "/ads" }); }} />
    </AppLayout>
  );
}

/* ────────── STEP 1: Photos ────────── */
function StepPhotos({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<Photo[]>(form.photos);

  useEffect(() => {
    set("photos", photos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    for (const file of files) {
      const url = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { url, uploading: true }]);
      try {
        const media = await uploadMedia(file, "listing");
        setPhotos((prev) => prev.map((p) => (p.url === url ? { url: media.url ?? url, uuid: media.uuid } : p)));
      } catch {
        toast.error(t("ads.photoUploadError"));
        setPhotos((prev) => prev.filter((p) => p.url !== url));
      }
    }
  };
  const remove = (i: number) => setPhotos((prev) => prev.filter((_, j) => j !== i));
  const makeMain = (i: number) => setPhotos((prev) => {
    const next = [...prev];
    const [m] = next.splice(i, 1);
    next.unshift(m);
    return next;
  });

  return (
    <section className="space-y-[20px]">
      <div>
        <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          {t("ads.photosTitle")}
        </h2>
        <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
          {t("ads.photosHint", { n: MAX_PHOTOS })}
        </p>
      </div>

      <label
        className="grid cursor-pointer place-items-center gap-[10px] px-[20px] py-[40px] text-center transition-colors"
        style={{
          background: "var(--background-elevated)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-card)",
        }}
      >
        <div className="grid h-[56px] w-[56px] place-items-center"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}>
          <ImagePlus size={24} />
        </div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("ads.photosDrop")}
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{t("ads.photosFormat")}</div>
        <input type="file" accept="image/*" multiple onChange={(e) => void addPhoto(e)} className="hidden" />
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, i) => (
            <motion.div
              key={photo.url}
              layout={false}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="group relative overflow-hidden"
              style={{
                aspectRatio: "1 / 1",
                background: "var(--background-surface)",
                border: `2px solid ${i === 0 ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--r-card-sm)",
              }}
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" style={{ opacity: photo.uploading ? 0.5 : 1 }} />
              {photo.uploading && (
                <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold" style={{ background: "rgba(0,0,0,0.35)", color: "#fff" }}>
                  {t("ads.photoUploading")}
                </span>
              )}
              {i === 0 && !photo.uploading && (
                <span
                  className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
                  style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
                >
                  <Star size={9} fill="currentColor" /> {t("ads.photoMain")}
                </span>
              )}
              <div className="absolute right-[6px] top-[6px] flex gap-[4px] opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 && (
                  <button type="button" onClick={() => makeMain(i)} title={t("ads.photoMakeMain")}
                    className="grid h-[28px] w-[28px] place-items-center"
                    style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}>
                    <Star size={12} />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} title={t("ads.photoRemove")}
                  className="grid h-[28px] w-[28px] place-items-center"
                  style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}>
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ────────── STEP 2: Data ────────── */
function StepData({ form, set, cat, categories, cities }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; cat: Category; categories: Category[]; cities: { id: number; name: string }[] }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-[24px]">
      <Block title={t("ads.blockType")}>
        <div className="grid gap-[10px] sm:grid-cols-3">
          <RadioCard selected={form.status === "Продаю"} onClick={() => set("status", "Продаю")}
            icon={Tag} title={t("ads.statusSell")} description={t("ads.statusSellDesc")} accentVar="var(--accent)" />
          <RadioCard selected={form.status === "Куплю"} onClick={() => set("status", "Куплю")}
            icon={ShoppingCart} title={t("ads.statusBuy")} description={t("ads.statusBuyDesc")} accentVar="var(--info)" />
          <RadioCard selected={form.status === "Обменяю"} onClick={() => set("status", "Обменяю")}
            icon={ArrowLeftRight} title={t("ads.statusSwap")} description={t("ads.statusSwapDesc")} accentVar="var(--warning)" />
        </div>
      </Block>

      <Block title={t("ads.blockDescription")}>
        <Field label={t("ads.fieldTitle")} required>
          <Input value={form.title} onChange={(v) => set("title", v)} placeholder={t("ads.titlePlaceholder")} />
        </Field>
        <Field label={t("ads.fieldDescription")}>
          <Textarea value={form.description} onChange={(v) => set("description", v)}
            placeholder={t("ads.descPlaceholder")} rows={5} />
        </Field>
      </Block>

      <Block title={t("ads.blockParams")}>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label={t("ads.fieldPrice")} required>
            <Input value={form.price} onChange={(v) => set("price", v.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
          </Field>
          <Field label={t("ads.fieldCondition")}>
            <NativeSelect value={form.condition} onChange={(v) => set("condition", v as AdCondition)}
              options={CONDITIONS.map((c) => ({ value: c, label: t(CONDITION_I18N[c]) }))} />
          </Field>
          <Field label={t("ads.fieldCategory")}>
            <NativeSelect value={form.categoryId}
              onChange={(v) => {
                const c = categories.find((x) => x.id === v)!;
                set("categoryId", v);
                set("subcategoryId", c.subcategories?.[0]?.id ?? "");
              }}
              options={categories.map((c) => ({ label: c.name, value: c.id }))} />
          </Field>
          <Field label={t("ads.fieldSubcategory")}>
            <NativeSelect value={form.subcategoryId} onChange={(v) => set("subcategoryId", v)}
              options={cat.subcategories?.map((s) => ({ label: s.name, value: s.id })) ?? []} />
          </Field>
        </div>
      </Block>

      <Block title={t("ads.blockContacts")}>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label={t("ads.fieldCity")} required>
            <NativeSelect value={form.cityId} onChange={(v) => set("cityId", v)}
              options={cities.map((c) => ({ label: c.name, value: String(c.id) }))} />
          </Field>
          <Field label={t("ads.fieldContact")} required>
            <Input value={form.contact} onChange={(v) => set("contact", v)} placeholder={t("ads.contactPlaceholder")} />
          </Field>
        </div>
        <Field label={t("ads.fieldDelivery")}>
          <div className="flex flex-wrap gap-[6px]">
            {DELIVERIES.map((d) => (
              <Checkbox key={d}
                checked={form.deliveries.includes(d)}
                onChange={() => set("deliveries", form.deliveries.includes(d)
                  ? form.deliveries.filter((x) => x !== d) : [...form.deliveries, d])}
                label={d} />
            ))}
          </div>
        </Field>
      </Block>
    </section>
  );
}

/* ────────── STEP 3: Preview ────────── */
function StepPreview({ form, cat, statusLabel, cities }: { form: Form; cat: Category; statusLabel: (s: Status) => string; cities: { id: number; name: string }[] }) {
  const { t } = useTranslation();
  const sub = cat.subcategories?.find((s) => s.id === form.subcategoryId);
  const cityName = cities.find((c) => String(c.id) === form.cityId)?.name ?? "—";
  const status = form.status;
  const statusStyle = status === "Продаю"
    ? { bg: "var(--accent-soft)", fg: "var(--accent)" }
    : status === "Куплю"
    ? { bg: "var(--info-soft)", fg: "var(--info)" }
    : { bg: "var(--warning-soft)", fg: "var(--warning)" };
  const image = form.photos[0]?.url;

  return (
    <section className="space-y-[20px]">
      <div>
        <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          {t("ads.previewTitle")}
        </h2>
        <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
          {t("ads.previewHint")}
        </p>
      </div>

      <div className="grid gap-[20px] md:grid-cols-[280px_1fr]">
        {/* Mini card */}
        <div className="overflow-hidden"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="relative" style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}>
            {image && <img src={image} alt="" className="h-full w-full object-cover" />}
            <span className="absolute left-[10px] top-[10px] px-[10px] py-[4px] text-[11px] font-semibold uppercase"
              style={{ background: statusStyle.bg, color: statusStyle.fg, borderRadius: "var(--r-pill)" }}>
              {statusLabel(status)}
            </span>
          </div>
          <div className="space-y-[8px] p-[14px]">
            <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{form.title || t("ads.titleFallback")}</div>
            <div className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
              {Number(form.price || 0).toLocaleString("ru")} ₽
            </div>
            <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {cat.name} · {sub?.name}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-[16px] p-[20px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>{form.title || t("ads.titleFallback")}</h3>
          <p className="text-[13px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {form.description || t("ads.descFallback")}
          </p>
          <div className="grid gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <div className="inline-flex items-center gap-[6px]"><MapPin size={14} /> {cityName}</div>
            <div className="inline-flex items-center gap-[6px]"><Truck size={14} /> {form.deliveries.join(", ") || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Tag size={14} /> {t(CONDITION_I18N[form.condition])}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[12px] p-[14px] text-[12px]"
        style={{ background: "var(--info-soft)", color: "var(--info)", borderRadius: "var(--r-card-sm)" }}>
        <CreditCard size={16} /> {t("ads.payNote")}
      </div>
    </section>
  );
}

/* ────────── Bespoke form primitives ────────── */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-[14px]">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{title}</h3>
      <div className="space-y-[12px]">{children}</div>
    </div>
  );
}
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-[6px]">
      <span className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
function Input({ value, onChange, placeholder, leftIcon, inputMode }: { value: string; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode; inputMode?: "numeric" }) {
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" style={{ color: "var(--foreground-50)" }}>
          {leftIcon}
        </span>
      )}
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} inputMode={inputMode}
        className="w-full text-[14px] outline-none transition-colors"
        style={{
          background: "var(--background-elevated)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-input)",
          height: 44,
          padding: `0 14px 0 ${leftIcon ? 36 : 14}px`,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </div>
  );
}
function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full resize-none text-[14px] outline-none transition-colors"
      style={{
        background: "var(--background-elevated)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-input)",
        padding: "12px 14px",
        lineHeight: 1.5,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    />
  );
}
type SelOpt = string | { label: string; value: string };
function NativeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: SelOpt[] }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer text-[14px] outline-none"
      style={{
        background: "var(--background-elevated)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-input)",
        height: 44,
        padding: "0 12px",
      }}
    >
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
