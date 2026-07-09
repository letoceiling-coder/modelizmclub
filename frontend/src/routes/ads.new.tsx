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
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { ListingPreviewCard } from "@/components/ads/wizard/ListingPreviewCard";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft, ChevronRight, Tag, ShoppingCart,
  ArrowLeftRight, MapPin, Truck, CreditCard, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: "Новое объявление — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: NewAdPage,
});

type Status = "Продаю" | "Куплю" | "Обменяю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у — отлично", "Б/у — хорошо", "Под восстановление"];
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
  const [cats, setCats] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = (name: string) => setTouched((s) => new Set(s).add(name));

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
    setSubmitError(false);
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
      const ad = await createListing({
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
      toast.success("Объявление опубликовано");
      void navigate({ to: "/my-ads" });
    } catch {
      setSubmitError(true);
      toast.error("Не удалось опубликовать объявление");
      setSubmitting(false);
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-[24px] pb-[calc(var(--bottom-nav-space)+88px)] lg:pb-[96px]">
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
            {step === 2 && <StepData form={form} set={set} cat={cat} cats={cats} touched={touched} touch={touch} />}
            {step === 3 && <StepPreview form={form} cat={cat} submitError={submitError} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer — lifted above the mobile BottomNav so the submit CTA is never covered */}
      <div
        className="fixed inset-x-0 bottom-[var(--bottom-nav-space)] z-40 border-t backdrop-blur lg:bottom-0"
        style={{
          background: "color-mix(in srgb, var(--background) 88%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-[12px] px-[16px] py-[12px] sm:px-[24px]">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="h-11 rounded-[var(--r-button)]"
          >
            <ChevronLeft size={16} /> Назад
          </Button>
          {step < 3 ? (
            <Button
              disabled={!valid}
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="h-11 rounded-[var(--r-button)]"
            >
              Далее <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={submitting}
              className="h-11 rounded-[var(--r-button)]"
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {submitting ? "Публикуется…" : "Оплатить 20 ₽ и опубликовать"}
            </Button>
          )}
        </div>
      </div>

    </AppLayout>
  );
}

/* ────────── STEP 1: Photos ────────── */
function StepPhotos({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const addPhoto = (picked: File[]) => {
    const room = MAX_PHOTOS - form.photos.length;
    const files = picked.slice(0, room);
    const urls = files.map((f) => URL.createObjectURL(f));
    set("photos", [...form.photos, ...urls]);
    set("files", [...form.files, ...files]);
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
    <section className="space-y-[16px]">
      <StepHeading title="Фотографии" description={`До ${MAX_PHOTOS} фото. Первое — главное в карточке.`} />
      <Card
        className="p-[16px] sm:p-[20px]"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}
      >
        <ImageUploadGrid
          photos={form.photos}
          max={MAX_PHOTOS}
          onAdd={addPhoto}
          onRemove={remove}
          onMakeMain={makeMain}
        />
      </Card>
    </section>
  );
}

/* ────────── STEP 2: Data ────────── */
function StepData({
  form, set, cat, cats, touched, touch,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  cat: Category | undefined;
  cats: Category[];
  touched: Set<string>;
  touch: (name: string) => void;
}) {
  const titleErr = touched.has("title") && form.title.trim().length < 4;
  const priceErr = touched.has("price") && !form.price;
  const cityErr = touched.has("city") && !form.city.trim();
  const contactErr = touched.has("contact") && !form.contact.trim();

  return (
    <section className="space-y-[16px]">
      {form.photos.length > 0 && (
        <Block title="Фотографии">
          <div className="flex gap-[8px] overflow-x-auto pb-[2px] [scrollbar-width:thin]">
            {form.photos.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={src}
                  alt=""
                  className="h-[64px] w-[64px] rounded-[10px] object-cover"
                  style={{ border: "1px solid var(--border)" }}
                />
                {i === 0 && (
                  <span
                    className="absolute left-[4px] top-[4px] rounded-[4px] px-[4px] py-[1px] text-[9px] font-semibold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Главное
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            Изменить фото можно на шаге «Фото».
          </p>
        </Block>
      )}

      <Block title="Тип объявления">
        <div className="grid gap-[10px] sm:grid-cols-3">
          <RadioCard selected={form.status === "Продаю"} onClick={() => set("status", "Продаю")}
            icon={Tag} title="Продаю" description="Хочу продать вещь" />
          <RadioCard selected={form.status === "Куплю"} onClick={() => set("status", "Куплю")}
            icon={ShoppingCart} title="Куплю" description="Ищу для покупки" />
          <RadioCard selected={form.status === "Обменяю"} onClick={() => set("status", "Обменяю")}
            icon={ArrowLeftRight} title="Обменяю" description="Готов на обмен" />
        </div>
      </Block>

      <Block title="Описание">
        <Field label="Название" required error={titleErr ? "Минимум 4 символа" : undefined}>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={() => touch("title")}
            error={titleErr}
            className="h-11"
            placeholder="Двигатель Picco .21 для багги 1:8"
          />
        </Field>
        <Field label="Подробное описание">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Состояние, история использования, комплектация…"
            rows={5}
          />
        </Field>
      </Block>

      <Block title="Параметры">
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label="Цена, ₽" required error={priceErr ? "Укажите цену" : undefined}>
            <Input
              value={form.price}
              onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))}
              onBlur={() => touch("price")}
              error={priceErr}
              className="h-11"
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Состояние">
            <NativeSelect value={form.condition} onChange={(v) => set("condition", v as AdCondition)} options={CONDITIONS} />
          </Field>
          <Field label="Категория">
            <NativeSelect
              value={form.categoryId}
              onChange={(v) => {
                const c = cats.find((x) => x.id === v);
                set("categoryId", v);
                set("subcategoryId", c?.subcategories[0]?.id ?? "");
              }}
              options={cats.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Field>
          <Field label="Подкатегория">
            <NativeSelect
              value={form.subcategoryId}
              onChange={(v) => set("subcategoryId", v)}
              options={(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id }))}
            />
          </Field>
        </div>
      </Block>

      <Block title="Контакты и доставка">
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label="Город" required error={cityErr ? "Укажите город" : undefined}>
            <div className="relative">
              <MapPin size={14} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" style={{ color: "var(--foreground-50)" }} />
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={() => touch("city")}
                error={cityErr}
                className="h-11 pl-9"
                placeholder="Краснодар"
              />
            </div>
          </Field>
          <Field label="Контакт" required error={contactErr ? "Укажите контакт" : undefined}>
            <Input
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              onBlur={() => touch("contact")}
              error={contactErr}
              className="h-11"
              placeholder="+7 999 000-00-00"
            />
          </Field>
        </div>
        <Field label="Способы доставки">
          <div className="flex flex-wrap gap-[8px]">
            {DELIVERY_METHODS.map((m) => (
              <Checkbox
                key={m.id}
                checked={form.deliveries.includes(m.label)}
                onChange={() => set("deliveries", form.deliveries.includes(m.label)
                  ? form.deliveries.filter((x) => x !== m.label) : [...form.deliveries, m.label])}
                label={m.label}
              />
            ))}
          </div>
        </Field>
      </Block>
    </section>
  );
}

/* ────────── STEP 3: Preview ────────── */
function StepPreview({ form, cat, submitError }: { form: Form; cat: Category | undefined; submitError: boolean }) {
  const sub = cat?.subcategories.find((s) => s.id === form.subcategoryId);

  return (
    <section className="space-y-[16px]">
      <StepHeading title="Превью" description="Так ваше объявление увидят покупатели." />

      {submitError && (
        <Alert variant="error">
          <AlertDescription>
            Не удалось опубликовать объявление. Проверьте соединение и нажмите «Оплатить и опубликовать» ещё раз.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-[20px] md:grid-cols-[280px_1fr]">
        <ListingPreviewCard
          title={form.title}
          price={form.price}
          images={form.photos}
          status={form.status}
          category={cat?.name}
          subcategory={sub?.name}
        />

        <Card
          className="space-y-[16px] p-[20px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}
        >
          <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>
            {form.title || "Название объявления"}
          </h3>
          <p className="whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {form.description || "Описание не заполнено."}
          </p>
          <div className="grid gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <div className="inline-flex items-center gap-[6px]"><MapPin size={14} /> {form.city || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Truck size={14} /> {form.deliveries.join(", ") || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Tag size={14} /> {form.condition}</div>
          </div>
        </Card>
      </div>

      <Alert variant="info">
        <AlertDescription>
          После оплаты 20 ₽ объявление отправится на модерацию (обычно до 60 минут).
        </AlertDescription>
      </Alert>
    </section>
  );
}

/* ────────── Layout primitives ────────── */
function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>{description}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card
      className="space-y-[14px] p-[16px] sm:p-[20px]"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}
    >
      <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{title}</h3>
      <div className="space-y-[12px]">{children}</div>
    </Card>
  );
}

function Field({ label, children, required, error }: { label: string; children: React.ReactNode; required?: boolean; error?: string }) {
  return (
    <label className="block space-y-[6px]">
      <span className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </span>
      {children}
      {error && <span className="block text-[11px] font-medium" style={{ color: "var(--danger)" }}>{error}</span>}
    </label>
  );
}

type SelOpt = string | { label: string; value: string };
function NativeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: SelOpt[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full cursor-pointer rounded-[var(--r-input)] border border-[var(--border)] bg-[var(--background-input)] px-3 text-[14px] text-[var(--foreground)] shadow-sm outline-none transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
    >
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
