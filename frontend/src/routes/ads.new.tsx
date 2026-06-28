import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { type AdCondition, type Category } from "@/lib/mock";
import { fetchListingCategories } from "@/lib/api/categories";
import { searchCities } from "@/lib/api/cities";
import { uploadMedia } from "@/lib/api/media";
import { createListing } from "@/lib/api/listings";
import { StepIndicator } from "@/components/ads/wizard/StepIndicator";
import { SuccessModal } from "@/components/ads/wizard/SuccessModal";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import {
  ChevronLeft, ChevronRight, ImagePlus, X, Star,
  Tag, ShoppingCart, ArrowLeftRight, MapPin, Truck, CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: "Новое объявление — МоДелизМ Форум" }] }),
  component: NewAdPage,
});

type Status = "Продаю" | "Куплю" | "Обменяю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у — отлично", "Б/у — хорошо", "Под восстановление"];
const DELIVERIES = ["СДЭК", "Почта России", "Яндекс Доставка", "Ozon", "Wildberries"];
const MAX_PHOTOS = 10;
const STEPS = ["Фото", "Данные", "Превью"];

interface Form {
  photos: string[];
  files: File[];
  status: Status;
  title: string;
  description: string;
  price: string;
  categoryId: string;
  subcategoryId: string;
  condition: AdCondition;
  city: string;
  contact: string;
  deliveries: string[];
}

const initial: Form = {
  photos: [],
  files: [],
  status: "Продаю",
  title: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  condition: "Б/у — отлично",
  city: "",
  contact: "",
  deliveries: ["СДЭК"],
};

function NewAdPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initial);
  const [success, setSuccess] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchListingCategories()
      .then((list) => {
        setCats(list);
        setForm((f) =>
          f.categoryId
            ? f
            : { ...f, categoryId: list[0]?.id ?? "", subcategoryId: list[0]?.subcategories[0]?.id ?? "" },
        );
      })
      .catch(() => {});
  }, []);

  const cat = useMemo(() => cats.find((c) => c.id === form.categoryId) ?? cats[0], [cats, form.categoryId]);

  const valid = useMemo(() => {
    if (step === 1) return form.photos.length > 0;
    if (step === 2) return form.title.trim().length >= 4 && form.price && form.city.trim() && form.contact.trim();
    return true;
  }, [step, form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const mediaIds: string[] = [];
      for (const file of form.files) {
        const m = await uploadMedia(file, "listing");
        mediaIds.push(m.uuid);
      }
      let cityId: number | undefined;
      if (form.city.trim()) {
        const found = await searchCities(form.city.trim());
        cityId = found[0]?.id;
      }
      await createListing({
        title: form.title.trim(),
        description: form.description.trim(),
        priceCents: Number(form.price || 0) * 100,
        categoryId: Number(form.categoryId),
        subcategoryId: form.subcategoryId ? Number(form.subcategoryId) : undefined,
        cityId,
        deliveryMethods: form.deliveries,
        mediaIds,
        publish: true,
      });
      setSuccess(true);
    } catch {
      toast.error("Не удалось опубликовать объявление");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-[24px] pb-[120px]">
        <header className="space-y-[6px]">
          <Link to="/ads" className="inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            <ChevronLeft size={14} /> Назад к объявлениям
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-none sm:text-[36px]"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Новое объявление
          </h1>
          <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
            Размещение — 20 ₽. После оплаты объявление пройдёт модерацию.
          </p>
        </header>

        <StepIndicator current={step} labels={STEPS} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && <StepPhotos form={form} set={set} />}
            {step === 2 && <StepData form={form} set={set} cat={cat} cats={cats} />}
            {step === 3 && <StepPreview form={form} cat={cat} />}
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
            <ChevronLeft size={16} /> Назад
          </button>
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
              Далее <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-[8px] px-[22px] text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-button)",
                boxShadow: "var(--shadow-button)",
                height: 44,
              }}
            >
              <CreditCard size={16} /> {submitting ? "Публикуем…" : "Оплатить 20 ₽ и опубликовать"}
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
  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const picked = files.slice(0, MAX_PHOTOS - form.photos.length);
    const urls = picked.map((f) => URL.createObjectURL(f));
    set("photos", [...form.photos, ...urls]);
    set("files", [...form.files, ...picked]);
  };
  const remove = (i: number) => {
    set("photos", form.photos.filter((_, j) => j !== i));
    set("files", form.files.filter((_, j) => j !== i));
  };
  const makeMain = (i: number) => {
    const next = [...form.photos];
    const [m] = next.splice(i, 1);
    next.unshift(m);
    set("photos", next);
    const nf = [...form.files];
    const [mf] = nf.splice(i, 1);
    nf.unshift(mf);
    set("files", nf);
  };

  return (
    <section className="space-y-[20px]">
      <div>
        <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          Фотографии
        </h2>
        <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
          До {MAX_PHOTOS} фото. Первое — главное в карточке.
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
          Перетащите фото или нажмите, чтобы выбрать
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>JPG, PNG до 10 МБ</div>
        <input type="file" accept="image/*" multiple onChange={addPhoto} className="hidden" />
      </label>

      {form.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 md:grid-cols-4">
          {form.photos.map((src, i) => (
            <motion.div
              key={src}
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
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span
                  className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
                  style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
                >
                  <Star size={9} fill="currentColor" /> Главное
                </span>
              )}
              <div className="absolute right-[6px] top-[6px] flex gap-[4px] opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 && (
                  <button type="button" onClick={() => makeMain(i)} title="Сделать главным"
                    className="grid h-[28px] w-[28px] place-items-center"
                    style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}>
                    <Star size={12} />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} title="Удалить"
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
function StepData({ form, set, cat, cats }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; cat: Category | undefined; cats: Category[] }) {
  return (
    <section className="space-y-[24px]">
      <Block title="Тип объявления">
        <div className="grid gap-[10px] sm:grid-cols-3">
          <RadioCard selected={form.status === "Продаю"} onClick={() => set("status", "Продаю")}
            icon={Tag} title="Продаю" description="Хочу продать вещь" accentVar="var(--accent)" />
          <RadioCard selected={form.status === "Куплю"} onClick={() => set("status", "Куплю")}
            icon={ShoppingCart} title="Куплю" description="Ищу для покупки" accentVar="var(--info)" />
          <RadioCard selected={form.status === "Обменяю"} onClick={() => set("status", "Обменяю")}
            icon={ArrowLeftRight} title="Обменяю" description="Готов на обмен" accentVar="var(--warning)" />
        </div>
      </Block>

      <Block title="Описание">
        <Field label="Название" required>
          <Input value={form.title} onChange={(v) => set("title", v)} placeholder="Двигатель Picco .21 для багги 1:8" />
        </Field>
        <Field label="Подробное описание">
          <Textarea value={form.description} onChange={(v) => set("description", v)}
            placeholder="Состояние, история использования, комплектация…" rows={5} />
        </Field>
      </Block>

      <Block title="Параметры">
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label="Цена, ₽" required>
            <Input value={form.price} onChange={(v) => set("price", v.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
          </Field>
          <Field label="Состояние">
            <NativeSelect value={form.condition} onChange={(v) => set("condition", v as AdCondition)}
              options={CONDITIONS} />
          </Field>
          <Field label="Категория">
            <NativeSelect value={form.categoryId}
              onChange={(v) => {
                const c = cats.find((x) => x.id === v);
                set("categoryId", v);
                set("subcategoryId", c?.subcategories[0]?.id ?? "");
              }}
              options={cats.map((c) => ({ label: c.name, value: c.id }))} />
          </Field>
          <Field label="Подкатегория">
            <NativeSelect value={form.subcategoryId} onChange={(v) => set("subcategoryId", v)}
              options={(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id }))} />
          </Field>
        </div>
      </Block>

      <Block title="Контакты и доставка">
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label="Город" required>
            <Input value={form.city} onChange={(v) => set("city", v)} placeholder="Краснодар" leftIcon={<MapPin size={14} />} />
          </Field>
          <Field label="Контакт" required>
            <Input value={form.contact} onChange={(v) => set("contact", v)} placeholder="+7 999 000-00-00 или @telegram" />
          </Field>
        </div>
        <Field label="Способы доставки">
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
function StepPreview({ form, cat }: { form: Form; cat: Category | undefined }) {
  const sub = cat?.subcategories.find((s) => s.id === form.subcategoryId);
  const status = form.status;
  const statusStyle = status === "Продаю"
    ? { bg: "var(--accent-soft)", fg: "var(--accent)" }
    : status === "Куплю"
    ? { bg: "var(--info-soft)", fg: "var(--info)" }
    : { bg: "var(--warning-soft)", fg: "var(--warning)" };
  const image = form.photos[0] ?? "";

  return (
    <section className="space-y-[20px]">
      <div>
        <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          Превью
        </h2>
        <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
          Так ваше объявление увидят покупатели.
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
            <img src={image} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-[10px] top-[10px] px-[10px] py-[4px] text-[11px] font-semibold uppercase"
              style={{ background: statusStyle.bg, color: statusStyle.fg, borderRadius: "var(--r-pill)" }}>
              {status}
            </span>
          </div>
          <div className="space-y-[8px] p-[14px]">
            <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{form.title || "Название объявления"}</div>
            <div className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
              {Number(form.price || 0).toLocaleString("ru")} ₽
            </div>
            <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {cat?.name} · {sub?.name}
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
          <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>{form.title || "Название объявления"}</h3>
          <p className="text-[13px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {form.description || "Описание не заполнено."}
          </p>
          <div className="grid gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <div className="inline-flex items-center gap-[6px]"><MapPin size={14} /> {form.city || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Truck size={14} /> {form.deliveries.join(", ") || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Tag size={14} /> {form.condition}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[12px] p-[14px] text-[12px]"
        style={{ background: "var(--info-soft)", color: "var(--info)", borderRadius: "var(--r-card-sm)" }}>
        <CreditCard size={16} /> После оплаты 20 ₽ объявление отправится на модерацию (обычно до 60 минут).
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
