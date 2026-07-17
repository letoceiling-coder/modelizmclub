import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { type AdCondition, type Category } from "@/lib/mock";
import { fetchListingCategories } from "@/lib/api/categories";
import { searchCities } from "@/lib/api/cities";
import { CitySelect } from "@/components/ads/CitySelect";
import { uploadMedia } from "@/lib/api/media";
import { createListing, fetchListing, updateListing } from "@/lib/api/listings";
import { ApiError } from "@/lib/api/client";
import { firstFieldError, MAX_LISTING_PRICE_RUB, priceRubToCents } from "@/lib/api/validationErrors";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { StepIndicator } from "@/components/ads/wizard/StepIndicator";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { ListingPreviewCard } from "@/components/ads/wizard/ListingPreviewCard";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft, ChevronRight, Tag, ShoppingCart,
  ArrowLeftRight, MapPin, Truck, CreditCard,
} from "lucide-react";

type NewAdSearch = { edit?: string };

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: "Новое объявление — МоДелизМ" }] }),
  validateSearch: (s: Record<string, unknown>): NewAdSearch => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: NewAdPage,
});

type Status = "Продаю" | "Куплю" | "Обменяю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у"];
const MAX_PHOTOS = 10;
const STEPS = ["Фото", "Данные", "Превью"];
/** Matches backend CreatePaymentController::LISTING_PLACEMENT_CENTS (99 ₽). */
const LISTING_PLACEMENT_PRICE_RUB = 99;

interface Form {
  photos: string[];
  files: File[];
  existingMediaIds: string[];
  status: Status;
  title: string;
  description: string;
  price: string;
  categoryId: string;
  subcategoryId: string;
  condition: AdCondition;
  city: string;
  cityId?: number;
  contact: string;
  deliveries: string[];
}

const initial: Form = {
  photos: [],
  files: [],
  existingMediaIds: [],
  status: "Продаю",
  title: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  condition: "Б/у",
  city: "",
  cityId: undefined,
  contact: "",
  deliveries: ["СДЭК"],
};

function NewAdPage() {
  const navigate = useNavigate();
  const { edit: editId } = Route.useSearch();
  const listingPaymentEnabled = useFeatureFlag("listingPaymentEnabled");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initial);
  const [cats, setCats] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
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

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    setLoadingEdit(true);
    fetchListing(editId)
      .then((ad) => {
        if (!alive) return;
        setForm({
          photos: ad.gallery ?? (ad.image ? [ad.image] : []),
          files: [],
          existingMediaIds: ad.mediaIds ?? [],
          status: ad.status,
          title: ad.title,
          description: ad.description ?? "",
          price: String(ad.price || ""),
          categoryId: ad.categoryId ?? "",
          subcategoryId: ad.subcategoryId ?? "",
          condition: ad.condition ?? "Б/у",
          city: ad.city,
          cityId: ad.cityId,
          contact: ad.contact,
          deliveries: ad.delivery.length ? ad.delivery : ["СДЭК"],
        });
      })
      .catch(() => toast.error("Не удалось загрузить объявление для редактирования"))
      .finally(() => { if (alive) setLoadingEdit(false); });
    return () => { alive = false; };
  }, [editId]);

  const cat = useMemo(() => cats.find((c) => c.id === form.categoryId) ?? cats[0], [cats, form.categoryId]);
  const subcategories = cat?.subcategories ?? [];

  const valid = useMemo(() => {
    if (step === 1) return form.photos.length > 0;
    if (step === 2) {
      return (
        form.title.trim().length >= 4
        && form.description.trim().length >= 20
        && form.price
        && form.city.trim().length >= 2
        && (form.cityId != null || form.city.trim().length >= 3)
        && form.contact.trim()
      );
    }
    return true;
  }, [step, form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (submitting) return;

    const categoryId = Number(form.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      toast.error("Выберите категорию");
      return;
    }

    const priceCents = priceRubToCents(form.price);
    if (priceCents === null) {
      toast.error(`Укажите корректную цену — максимум ${MAX_LISTING_PRICE_RUB.toLocaleString("ru-RU")} ₽`);
      return;
    }

    const subcategoryId = form.subcategoryId ? Number(form.subcategoryId) : undefined;
    const cityId = form.cityId != null ? Number(form.cityId) : undefined;

    setSubmitting(true);
    setSubmitError(false);
    try {
      const mediaIds: string[] = [...form.existingMediaIds];
      for (const file of form.files) {
        const m = await uploadMedia(file, "listing");
        mediaIds.push(m.uuid);
      }
      // Prefer the id captured when the user picked a suggestion from
      // CitySelect's autocomplete; fall back to a best-effort name lookup
      // only if they typed a city and dismissed the dropdown without
      // picking (e.g. blurred away), so a valid-looking city still resolves.
      let resolvedCityId: number | undefined = cityId;
      if (!resolvedCityId && form.city.trim()) {
        const found = await searchCities(form.city.trim());
        resolvedCityId = found[0]?.id;
      }
      if (editId) {
        await updateListing(editId, {
          title: form.title.trim(),
          description: form.description.trim(),
          priceCents,
          categoryId,
          subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
          cityId: resolvedCityId,
          deliveryMethods: form.deliveries,
          mediaIds,
        });
        toast.success("Объявление обновлено");
      } else {
        await createListing({
          title: form.title.trim(),
          description: form.description.trim(),
          priceCents,
          categoryId,
          subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
          cityId: resolvedCityId,
          deliveryMethods: form.deliveries,
          mediaIds,
          publish: true,
        });
        toast.success("Объявление опубликовано");
      }
      void navigate({ to: "/my-ads" });
    } catch (err) {
      setSubmitError(true);
      const fallback = editId ? "Не удалось сохранить изменения" : "Не удалось опубликовать объявление";
      let message = fallback;
      if (err instanceof ApiError) {
        message = firstFieldError(err.errors, err.message || fallback);
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      toast.error(message);
      setSubmitting(false);
    }
  };

  const publishButtonLabel = editId
    ? "Сохранить изменения"
    : listingPaymentEnabled
      ? `Оплатить ${LISTING_PLACEMENT_PRICE_RUB} ₽ и опубликовать`
      : "Опубликовать";

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
            {listingPaymentEnabled
              ? `Размещение — ${LISTING_PLACEMENT_PRICE_RUB} ₽. После оплаты объявление пройдёт модерацию.`
              : "Заполните форму и опубликуйте объявление — размещение сейчас бесплатное."}
          </p>
        </header>

        <StepIndicator current={step} labels={STEPS} />

        <ReducedMotionSwitch
          switchKey={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 1 && <StepPhotos form={form} set={set} />}
          {step === 2 && <StepData form={form} set={set} cat={cat} cats={cats} subcategories={subcategories} touched={touched} touch={touch} />}
          {step === 3 && <StepPreview form={form} cat={cat} submitError={submitError} listingPaymentEnabled={listingPaymentEnabled} publishButtonLabel={publishButtonLabel} />}
        </ReducedMotionSwitch>
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
              loading={submitting}
              className="h-11 min-w-[220px] rounded-[var(--r-button)]"
            >
              {!submitting && !editId && listingPaymentEnabled && <CreditCard size={16} />}
              {submitting ? (editId ? "Сохраняем…" : "Публикуется…") : publishButtonLabel}
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
  const reorder = (newPhotos: string[]) => {
    const newFiles = newPhotos.map((url) => form.files[form.photos.indexOf(url)]);
    set("photos", newPhotos);
    set("files", newFiles);
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
          onReorder={reorder}
        />
      </Card>
    </section>
  );
}

/* ────────── STEP 2: Data ────────── */
function StepData({
  form, set, cat, cats, subcategories, touched, touch,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  cat: Category | undefined;
  cats: Category[];
  subcategories: { id: string; name: string }[];
  touched: Set<string>;
  touch: (name: string) => void;
}) {
  const titleErr = touched.has("title") && form.title.trim().length < 4;
  const descErr = touched.has("description") && form.description.trim().length < 20;
  const priceErr = touched.has("price") && !form.price;
  const cityErr = touched.has("city") && (form.city.trim().length < 2 || (!form.cityId && form.city.trim().length < 3));
  const contactErr = touched.has("contact") && !form.contact.trim();

  // Keep the focused field clear of the mobile soft keyboard + the fixed
  // wizard footer: on focus, centre the field in the viewport. Delayed so the
  // keyboard has begun animating before we measure/scroll.
  const keepFieldVisible = (e: React.FocusEvent<HTMLElement>) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.matches("input, textarea, select")) {
      setTimeout(() => t.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    }
  };

  return (
    <section className="space-y-[16px]" onFocusCapture={keepFieldVisible}>
      {form.photos.length > 0 && (
        <Block title="Фотографии">
          <div className="flex gap-[8px] overflow-x-auto pb-[2px] no-scrollbar">
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
        <Field label="Подробное описание" required error={descErr ? "Минимум 20 символов" : undefined}>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            onBlur={() => touch("description")}
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
              onChange={(e) => set("price", e.target.value.replace(/\D/g, "").slice(0, 9))}
              onBlur={() => touch("price")}
              error={priceErr}
              className="h-11"
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Состояние">
            <NativeSelect value={form.condition} onChange={(v) => set("condition", v as AdCondition)} options={CONDITIONS} />
            <p className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
              Подробности состояния укажите в описании объявления.
            </p>
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
          {subcategories.length > 0 ? (
            <Field label="Подкатегория">
              <NativeSelect
                value={form.subcategoryId}
                onChange={(v) => set("subcategoryId", v)}
                options={subcategories.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Field>
          ) : null}
        </div>
      </Block>

      <Block title="Контакты и доставка">
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label="Город" required error={cityErr ? "Выберите город из списка" : undefined}>
            <CitySelect
              value={form.city}
              cityId={form.cityId}
              onChange={(name, id) => {
                set("city", name);
                set("cityId", id);
                touch("city");
              }}
              placeholder="Краснодар"
            />
          </Field>
          <Field label="Контакт" required error={contactErr ? "Укажите телефон" : undefined}>
            <PhoneInput
              defaultValue={form.contact}
              onValueChange={(v) => set("contact", v)}
              onBlur={() => touch("contact")}
              error={contactErr}
              className="h-11"
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
function StepPreview({
  form,
  cat,
  submitError,
  listingPaymentEnabled,
  publishButtonLabel,
}: {
  form: Form;
  cat: Category | undefined;
  submitError: boolean;
  listingPaymentEnabled: boolean;
  publishButtonLabel: string;
}) {
  const sub = cat?.subcategories.find((s) => s.id === form.subcategoryId);

  return (
    <section className="space-y-[16px]">
      <StepHeading title="Превью" description="Так ваше объявление увидят покупатели." />

      {submitError && (
        <Alert variant="error">
          <AlertDescription>
            Не удалось опубликовать объявление. Проверьте данные формы и нажмите «{publishButtonLabel}» ещё раз.
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
          {listingPaymentEnabled
            ? `После оплаты ${LISTING_PLACEMENT_PRICE_RUB} ₽ объявление отправится на модерацию (обычно до 60 минут).`
            : "После публикации объявление отправится на модерацию (обычно до 60 минут)."}
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

