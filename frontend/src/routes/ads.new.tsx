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
import { fetchPlacementQuote, formatQuoteRub, type PlacementQuote } from "@/lib/api/listing-placement";
import { confirmStubPayment, createListingPlacementPayment } from "@/lib/api/payment";
import { ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { firstFieldError, MAX_LISTING_PRICE_RUB, priceRubToCents } from "@/lib/api/validationErrors";
import { getFeatureFlags, loadFeatureFlagsFromServer, useFeatureFlag } from "@/lib/config/featureFlags";
import { StepIndicator } from "@/components/ads/wizard/StepIndicator";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import {
  LISTING_IMAGE_ACCEPT,
  validateListingImageFile,
  verifyListingImageDecodable,
} from "@/lib/listing-image";
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

type NewAdSearch = { edit?: string; promo?: string };

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: "Новое объявление — МоДелизМ" }] }),
  validateSearch: (s: Record<string, unknown>): NewAdSearch => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
    promo: typeof s.promo === "string" ? s.promo : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireVerified } = await import("@/lib/auth/verification");
    await requireVerified(location);
  },
  component: NewAdPage,
});

type Status = "Продаю" | "Куплю" | "Обменяю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у"];
const MAX_PHOTOS = 10;

const PHOTOS_REQUIRED_TOAST = {
  title: "Добавьте хотя бы одно фото",
  description: "Для публикации объявления необходимо загрузить минимум 1 фотографию.",
} as const;

function notifyPhotosRequired(setStep: (fn: (s: number) => number) => void) {
  toast.error(PHOTOS_REQUIRED_TOAST.title, { description: PHOTOS_REQUIRED_TOAST.description });
  setStep(() => 1);
}

function hasListingPhotos(form: Form): boolean {
  return form.photoItems.length > 0;
}
const STEPS = ["Фото", "Данные", "Превью"];

type PhotoItem = {
  id: string;
  preview: string;
  file?: File;
  mediaId?: string;
};

function newPhotoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Form {
  photoItems: PhotoItem[];
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
  promocode: string;
}

const initial: Form = {
  photoItems: [],
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
  promocode: "",
};

function NewAdPage() {
  const navigate = useNavigate();
  const { edit: editId, promo: promoFromUrl } = Route.useSearch();
  const listingPaymentEnabled = useFeatureFlag("listingPaymentEnabled");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({ ...initial, promocode: promoFromUrl?.toUpperCase() ?? "" });
  const [cats, setCats] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [placementQuote, setPlacementQuote] = useState<PlacementQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
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
          photoItems: (ad.gallery ?? (ad.image ? [ad.image] : [])).map((url, i) => ({
            id: `existing-${i}-${url}`,
            preview: url,
            mediaId: ad.mediaIds?.[i],
          })),
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

  useEffect(() => {
    if (!listingPaymentEnabled || editId || step < 2) return;
    const categoryId = Number(form.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return;
    let alive = true;
    setQuoteLoading(true);
    fetchPlacementQuote({
      categoryId,
      subcategoryId: form.subcategoryId ? Number(form.subcategoryId) : undefined,
      promocode: form.promocode,
    })
      .then((q) => { if (alive) setPlacementQuote(q); })
      .catch(() => { if (alive) setPlacementQuote(null); })
      .finally(() => { if (alive) setQuoteLoading(false); });
    return () => { alive = false; };
  }, [listingPaymentEnabled, editId, step, form.categoryId, form.subcategoryId, form.promocode]);

  const valid = useMemo(() => {
    const photosOk = hasListingPhotos(form);
    if (step === 1) return photosOk;
    if (step === 2) {
      return (
        photosOk
        && form.title.trim().length >= 4
        && form.description.trim().length >= 20
        && form.price
        && form.city.trim().length >= 2
        && (form.cityId != null || form.city.trim().length >= 3)
        && form.contact.trim()
      );
    }
    return photosOk;
  }, [step, form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (submitting) return;

    if (!hasListingPhotos(form)) {
      notifyPhotosRequired(setStep);
      return;
    }

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
      const mediaIds: string[] = [];
      for (const item of form.photoItems) {
        if (item.file) {
          const m = await uploadMedia(item.file, "listing");
          mediaIds.push(m.uuid);
        } else if (item.mediaId) {
          mediaIds.push(item.mediaId);
        }
      }
      if (mediaIds.length === 0) {
        toast.error(PHOTOS_REQUIRED_TOAST.title, { description: PHOTOS_REQUIRED_TOAST.description });
        setStep(1);
        setSubmitting(false);
        return;
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
        await loadFeatureFlagsFromServer();
        const paymentEnabled = getFeatureFlags().listingPaymentEnabled;
        const promocode = form.promocode.trim() || undefined;

        let quote: PlacementQuote | null = null;
        if (paymentEnabled) {
          try {
            quote = await fetchPlacementQuote({
              categoryId,
              subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
              promocode,
            });
            setPlacementQuote(quote);
          } catch {
            toast.error("Не удалось рассчитать стоимость размещения. Попробуйте ещё раз.");
            setSubmitting(false);
            return;
          }
          if (quote.promocode?.error) {
            toast.error(quote.promocode.error);
            setSubmitting(false);
            return;
          }
        }

        const needsPayment = paymentEnabled && quote !== null && quote.final_cents > 0;

        if (needsPayment && isDemoMode()) {
          toast("Оплата будет доступна после подключения эквайринга");
          setSubmitting(false);
          return;
        }

        if (needsPayment) {
          const draft = await createListing({
            title: form.title.trim(),
            description: form.description.trim(),
            priceCents,
            categoryId,
            subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
            cityId: resolvedCityId,
            deliveryMethods: form.deliveries,
            mediaIds,
            publish: false,
            promocode,
          });
          const checkout = await createListingPlacementPayment({
            categoryId,
            subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
            promocode,
            listingUuid: draft.id,
          });
          if (checkout.checkout_url) {
            window.location.href = checkout.checkout_url;
            return;
          }
          await confirmStubPayment(checkout.payment_uuid);
          toast.success("Оплата прошла — объявление отправлено на публикацию");
        } else {
          const created = await createListing({
            title: form.title.trim(),
            description: form.description.trim(),
            priceCents,
            categoryId,
            subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
            cityId: resolvedCityId,
            deliveryMethods: form.deliveries,
            mediaIds,
            publish: true,
            promocode,
          });
          toast.success(
            created.moderation === "moderation"
              ? "Объявление отправлено на модерацию"
              : "Объявление опубликовано",
          );
        }
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

  const placementPriceLabel = placementQuote
    ? (placementQuote.is_free ? "Бесплатно" : `${formatQuoteRub(placementQuote.final_cents)} ₽`)
    : "…";

  const publishButtonLabel = editId
    ? "Сохранить изменения"
    : listingPaymentEnabled
      ? quoteLoading
        ? "Рассчитываем…"
        : placementQuote?.is_free
          ? "Опубликовать бесплатно"
          : `Оплатить ${placementPriceLabel} и опубликовать`
      : "Опубликовать";

  const paymentGatePending = listingPaymentEnabled && !editId && (quoteLoading || !placementQuote);

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
              ? (quoteLoading ? "Рассчитываем стоимость размещения…" : `Размещение — ${placementPriceLabel}. После оплаты объявление пройдёт модерацию.`)
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
          {step === 3 && (
            <StepPreview
              form={form}
              set={set}
              cat={cat}
              submitError={submitError}
              listingPaymentEnabled={listingPaymentEnabled}
              publishButtonLabel={publishButtonLabel}
              placementQuote={placementQuote}
              quoteLoading={quoteLoading}
            />
          )}
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
              disabled={step === 2 && !valid}
              onClick={() => {
                if (!hasListingPhotos(form)) {
                  notifyPhotosRequired(setStep);
                  return;
                }
                if (step === 2 && !valid) return;
                setStep((s) => Math.min(3, s + 1));
              }}
              className="h-11 rounded-[var(--r-button)]"
            >
              Далее <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!hasListingPhotos(form)) {
                  notifyPhotosRequired(setStep);
                  return;
                }
                void submit();
              }}
              loading={submitting}
              disabled={paymentGatePending}
              className="h-11 min-w-[220px] rounded-[var(--r-button)]"
            >
              {!submitting && !editId && listingPaymentEnabled && !paymentGatePending && <CreditCard size={16} />}
              {submitting ? (editId ? "Сохраняем…" : "Публикуется…") : publishButtonLabel}
            </Button>
          )}
        </div>
      </div>

    </AppLayout>
  );
}

/* ────────── Photo helpers ────────── */
function usePhotoGridHandlers(
  photoItems: PhotoItem[],
  setPhotoItems: (next: PhotoItem[]) => void,
) {
  const photos = photoItems.map((p) => p.preview);
  const photoIds = photoItems.map((p) => p.id);

  const reorderByUrls = (newPhotos: string[]) => {
    const byPreview = new Map(photoItems.map((p) => [p.preview, p]));
    const next = newPhotos.map((url) => byPreview.get(url)).filter((p): p is PhotoItem => p != null);
    if (next.length === photoItems.length) setPhotoItems(next);
  };

  return {
    photos,
    photoIds,
    onAdd: (picked: File[]) => {
      void (async () => {
        const room = MAX_PHOTOS - photoItems.length;
        if (room <= 0) return;

        const accepted: PhotoItem[] = [];
        for (const file of picked.slice(0, room)) {
          const formatError = validateListingImageFile(file);
          if (formatError) {
            toast.error(formatError);
            continue;
          }
          const decodeError = await verifyListingImageDecodable(file);
          if (decodeError) {
            toast.error(decodeError);
            continue;
          }
          accepted.push({ id: newPhotoId(), preview: URL.createObjectURL(file), file });
        }

        if (accepted.length > 0) {
          setPhotoItems([...photoItems, ...accepted]);
        }
      })();
    },
    onRemove: (i: number) => setPhotoItems(photoItems.filter((_, j) => j !== i)),
    onMakeMain: (i: number) => {
      const next = [...photoItems];
      const [m] = next.splice(i, 1);
      next.unshift(m);
      setPhotoItems(next);
    },
    onReorder: reorderByUrls,
  };
}

function ListingPhotoGrid({
  photoItems,
  setPhotoItems,
  variant = "default",
  hideUploader = false,
}: {
  photoItems: PhotoItem[];
  setPhotoItems: (next: PhotoItem[]) => void;
  variant?: "default" | "compact";
  hideUploader?: boolean;
}) {
  const handlers = usePhotoGridHandlers(photoItems, setPhotoItems);
  return (
    <ImageUploadGrid
      photos={handlers.photos}
      photoIds={handlers.photoIds}
      max={MAX_PHOTOS}
      accept={LISTING_IMAGE_ACCEPT}
      variant={variant}
      hideUploader={hideUploader}
      controls="minimal"
      sizeScale={1.25}
      onAdd={handlers.onAdd}
      onRemove={handlers.onRemove}
      onMakeMain={handlers.onMakeMain}
      onReorder={handlers.onReorder}
    />
  );
}

/* ────────── STEP 1: Photos ────────── */
function StepPhotos({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <section className="space-y-[16px]">
      <StepHeading title="Фотографии" description={`Минимум 1 фото, до ${MAX_PHOTOS}. Первое — главное в карточке. Перетащите для изменения порядка.`} />
      <Card
        className="p-[16px] sm:p-[20px]"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}
      >
        <ListingPhotoGrid
          photoItems={form.photoItems}
          setPhotoItems={(next) => set("photoItems", next)}
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
      {form.photoItems.length > 0 && (
        <Block title="Фотографии">
          <ListingPhotoGrid
            photoItems={form.photoItems}
            setPhotoItems={(next) => set("photoItems", next)}
            variant="compact"
            hideUploader
          />
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
  set,
  cat,
  submitError,
  listingPaymentEnabled,
  publishButtonLabel,
  placementQuote,
  quoteLoading,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  cat: Category | undefined;
  submitError: boolean;
  listingPaymentEnabled: boolean;
  publishButtonLabel: string;
  placementQuote: PlacementQuote | null;
  quoteLoading: boolean;
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
          images={form.photoItems.map((p) => p.preview)}
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
          {listingPaymentEnabled ? (
            quoteLoading ? "Рассчитываем стоимость…" : placementQuote?.is_free
              ? "Размещение бесплатное — объявление отправится на модерацию после публикации."
              : `К оплате ${formatQuoteRub(placementQuote?.final_cents ?? 0)} ₽. После оплаты объявление отправится на модерацию (обычно до 60 минут).`
          ) : "После публикации объявление отправится на модерацию (обычно до 60 минут)."}
        </AlertDescription>
      </Alert>

      {listingPaymentEnabled && (
        <Card className="space-y-[10px] p-[16px]" style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          <label className="grid gap-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            Промокод
            <Input
              value={form.promocode}
              onChange={(e) => set("promocode", e.target.value.toUpperCase())}
              placeholder="SUMMER2026"
              className="h-11"
            />
          </label>
          {placementQuote?.promocode?.error && (
            <p className="text-[12px]" style={{ color: "var(--destructive, #c0392b)" }}>{placementQuote.promocode.error}</p>
          )}
          {placementQuote && !quoteLoading && (
            <div className="text-[12px] space-y-[4px]" style={{ color: "var(--foreground-50)" }}>
              <div>Базовая цена: {formatQuoteRub(placementQuote.base_cents)} ₽</div>
              {placementQuote.promo_discount_cents > 0 && (
                <div>Скидка по промокоду: −{formatQuoteRub(placementQuote.promo_discount_cents)} ₽</div>
              )}
              {placementQuote.has_active_subscription && placementQuote.free_listings_remaining != null && (
                <div>Бесплатных размещений в этом месяце: {placementQuote.free_listings_remaining}</div>
              )}
            </div>
          )}
        </Card>
      )}
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

