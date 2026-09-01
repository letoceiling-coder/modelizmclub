import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { type AdCondition, type Category } from "@/lib/mock";
import { fetchListingCategories, fetchPostCategories, mapCategorySelectionByName } from "@/lib/api/categories";
import { searchCities } from "@/lib/api/cities";
import { CitySelect } from "@/components/ads/CitySelect";
import { PickupAddressField, rememberPickupAddress } from "@/components/ads/PickupAddressField";
import { uploadMediaDeduped } from "@/lib/api/media";
import { createListing, fetchListing, updateListing } from "@/lib/api/listings";
import { fetchPlacementQuote, formatQuoteRub, type PlacementQuote } from "@/lib/api/listing-placement";
import { createListingPlacementPayment, type PayWith } from "@/lib/api/payment";
import { PaymentSourceDialog } from "@/components/billing/PaymentSourceDialog";
import { ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { firstFieldError, MAX_LISTING_PRICE_RUB, priceRubToCents } from "@/lib/api/validationErrors";
import { isInsufficientFunds } from "@/lib/api/wallet";
import { notifyBillingChanged } from "@/lib/billing-events";
import { getFeatureFlags, loadFeatureFlagsFromServer, useFeatureFlag, useFeatureFlagsHydrated } from "@/lib/config/featureFlags";
import { StepIndicator } from "@/components/ads/wizard/StepIndicator";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import {
  LISTING_IMAGE_ACCEPT,
  validateListingImageFile,
  verifyListingImageDecodable,
} from "@/lib/listing-image";
import { ListingPreviewCard } from "@/components/ads/wizard/ListingPreviewCard";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import { useDeliveryMethods } from "@/lib/hooks/useDeliveryMethods";
import { isCdekDelivery, isPickupDelivery } from "@/lib/config/deliveryMethods";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput, formatRuPhone } from "@/components/ui/phone-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft, ChevronRight, Tag,
  MapPin, Truck, Loader2, Phone, CircleHelp,
} from "lucide-react";
import { fetchMe } from "@/lib/api/auth";
import { sendPhoneVerificationCode, verifyPhoneCode } from "@/lib/api/account";
import { selectors, setCurrentUser, useStore } from "@/lib/store";
import { isPhoneVerified } from "@/lib/auth/verification";

type NewAdSearch = { edit?: string; promo?: string };

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/ads/new")({
  head: () => ({ meta: [{ title: i18n.t("pages.adsNew.metaTitle") }] }),
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

type Status = "Продаю";
const CONDITIONS: AdCondition[] = ["Новое", "Б/у"];
const MAX_PHOTOS = 10;

const PHOTOS_REQUIRED_KEYS = {
  title: "pages.adsNew.photoRequiredTitle",
  description: "pages.adsNew.photoRequiredDesc",
} as const;

function notifyPhotosRequired(setStep: (fn: (s: number) => number) => void, tr: (key: string) => string) {
  toast.error(tr(PHOTOS_REQUIRED_KEYS.title), { description: tr(PHOTOS_REQUIRED_KEYS.description) });
  setStep(() => 1);
}

function hasListingPhotos(form: Form): boolean {
  return form.photoItems.length > 0;
}
const STEPS_KEYS = ["pages.adsNew.stepPhoto", "pages.adsNew.stepData", "pages.adsNew.stepPreview"] as const;

type PhotoItem = {
  id: string;
  preview: string;
  file?: File;
  mediaId?: string;
};

function listingCategoryPath(cats: Category[], leafId: string): { l1: string; l2: string; l3: string } {
  for (const c of cats) {
    if (c.id === leafId) return { l1: c.id, l2: "", l3: "" };
    for (const s of c.subcategories) {
      if (s.id === leafId) return { l1: c.id, l2: s.id, l3: "" };
      for (const n of s.children ?? []) {
        if (n.id === leafId) return { l1: c.id, l2: s.id, l3: n.id };
      }
    }
  }
  return { l1: "", l2: "", l3: "" };
}

function listingLeafId(form: Pick<Form, "subcategoryId" | "nestedCategoryId">): string {
  return form.nestedCategoryId || form.subcategoryId;
}

function isDeliveryOn(deliveries: string[], m: { id: string; label: string }): boolean {
  return deliveries.includes(m.id) || deliveries.includes(m.label);
}

function toggleDeliveryMethod(deliveries: string[], m: { id: string; label: string }): string[] {
  const on = isDeliveryOn(deliveries, m);
  const next = deliveries.filter((x) => x !== m.id && x !== m.label);
  return on ? next : [...next, m.label];
}

function listingIdsFromForm(
  form: Pick<Form, "categoryId" | "subcategoryId" | "nestedCategoryId">,
  postCats: Category[],
  listingCats: Category[],
): { categoryId: number; subcategoryId?: number } | null {
  const mapped = mapCategorySelectionByName(
    postCats,
    listingCats,
    form.categoryId,
    form.subcategoryId,
    form.nestedCategoryId,
  );
  if (!mapped) {
    if (listingCats.length > 0) return null;
    const categoryId = Number(form.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return null;
    const leaf = listingLeafId(form);
    const subcategoryId = leaf ? Number(leaf) : undefined;
    return {
      categoryId,
      subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
    };
  }
  const categoryId = Number(mapped.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return null;
  const leaf = mapped.nestedCategoryId || mapped.subcategoryId;
  const subcategoryId = leaf ? Number(leaf) : undefined;
  return {
    categoryId,
    subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
  };
}

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
  nestedCategoryId: string;
  condition: AdCondition;
  city: string;
  cityId?: number;
  contact: string;
  deliveries: string[];
  packageSize: "" | "s" | "m" | "l";
  weightKg: string;
  dimL: string;
  dimW: string;
  dimH: string;
  pickupAddress: string;
  promocode: string;
}

function parcelFromForm(form: Pick<Form, "deliveries" | "packageSize" | "weightKg" | "dimL" | "dimW" | "dimH" | "pickupAddress">): {
  packageSize?: "s" | "m" | "l";
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
  pickupAddress?: string;
} {
  const cdek = form.deliveries.some(isCdekDelivery);
  const pickup = form.deliveries.some(isPickupDelivery);
  const preset = form.packageSize === "s" || form.packageSize === "m" || form.packageSize === "l" ? form.packageSize : undefined;
  const length = Number(form.dimL);
  const width = Number(form.dimW);
  const height = Number(form.dimH);
  const weight = Number(String(form.weightKg).replace(",", "."));
  const custom = length > 0 && width > 0 && height > 0 && weight > 0;
  return {
    packageSize: cdek ? preset : undefined,
    weightKg: cdek && !preset && custom ? weight : undefined,
    dimensionsCm: cdek && !preset && custom ? { length, width, height } : undefined,
    pickupAddress: pickup ? form.pickupAddress.trim() : undefined,
  };
}

function deliveryDetailsValid(form: Form): string | null {
  if (form.deliveries.some(isCdekDelivery)) {
    const preset = form.packageSize === "s" || form.packageSize === "m" || form.packageSize === "l";
    const custom = Number(form.dimL) > 0 && Number(form.dimW) > 0 && Number(form.dimH) > 0
      && Number(form.weightKg.replace(",", ".")) > 0;
    if (!preset && !custom) return "Для СДЭК укажите типоразмер S/M/L или габариты и вес посылки.";
  }
  if (form.deliveries.some(isPickupDelivery) && form.pickupAddress.trim().length < 3) {
    return "Укажите адрес или ориентир для самовывоза.";
  }
  return null;
}

/** Sticky footer CTA on step 3 — always returns visible text (PDF tests №16, №31). */
function resolvePublishCtaLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  opts: {
    editId?: string;
    listingPaymentEnabled: boolean;
    flagsHydrated: boolean;
    quoteLoading: boolean;
    placementQuote: PlacementQuote | null;
  },
): string {
  const { editId, listingPaymentEnabled, flagsHydrated, quoteLoading, placementQuote } = opts;
  if (editId) return t("pages.adsNew.saveChanges");
  if (!flagsHydrated) return t("pages.adsNew.calculating");
  if (!listingPaymentEnabled) return t("pages.adsNew.publish");
  if (quoteLoading) return t("pages.adsNew.calculating");
  if (!placementQuote) return t("pages.adsNew.publish");
  if (placementQuote.is_free) return t("pages.adsNew.publishFree");
  const priceLabel = `${formatQuoteRub(placementQuote.final_cents)} ₽`;
  return t("pages.adsNew.payAndPublish", { price: priceLabel });
}

function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) digits = `7${digits.slice(1)}`;
  else if (digits.length === 10) digits = `7${digits}`;
  return digits.slice(0, 11);
}

function phonesMatch(a: string, b: string): boolean {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  return left.length === 11 && left === right;
}

const initial: Form = {
  photoItems: [],
  status: "Продаю",
  title: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  nestedCategoryId: "",
  condition: "Б/у",
  city: "",
  cityId: undefined,
  contact: "",
  deliveries: ["СДЭК"],
  packageSize: "m",
  weightKg: "",
  dimL: "",
  dimW: "",
  dimH: "",
  pickupAddress: "",
  promocode: "",
};

function NewAdPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const steps = useMemo(() => STEPS_KEYS.map((k) => t(k)), [t]);
  const { edit: editId, promo: promoFromUrl } = Route.useSearch();
  const listingPaymentEnabled = useFeatureFlag("listingPaymentEnabled");
  const flagsHydrated = useFeatureFlagsHydrated();
  const currentUser = useStore(selectors.currentUser);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({ ...initial, promocode: promoFromUrl?.toUpperCase() ?? "" });
  const [cats, setCats] = useState<Category[]>([]);
  const [listingCats, setListingCats] = useState<Category[]>([]);
  const [listingPathToMap, setListingPathToMap] = useState<{ categoryId: string; subcategoryId: string; nestedCategoryId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [placementQuote, setPlacementQuote] = useState<PlacementQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [pendingPay, setPendingPay] = useState<{
    mediaIds: string[];
    categoryId: number;
    subcategoryId?: number;
    cityId?: number;
    priceCents: number;
    promocode?: string;
    amountRub: number;
    title: string;
    description: string;
    deliveries: string[];
    packageSize: "" | "s" | "m" | "l";
    weightKg: string;
    dimL: string;
    dimW: string;
    dimH: string;
    pickupAddress: string;
  } | null>(null);
  const touch = (name: string) => setTouched((s) => new Set(s).add(name));

  useEffect(() => {
    Promise.all([fetchPostCategories(), fetchListingCategories()])
      .then(([posts, listings]) => {
        setCats(posts);
        setListingCats(listings);
        setForm((f) =>
          f.categoryId
            ? f
            : { ...f, categoryId: posts[0]?.id ?? "", subcategoryId: posts[0]?.subcategories[0]?.id ?? "", nestedCategoryId: "" },
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
        setListingPathToMap({
          categoryId: ad.categoryId ?? "",
          subcategoryId: ad.subcategoryId ?? "",
          nestedCategoryId: "",
        });
        setForm((f) => ({
          photoItems: (ad.gallery ?? (ad.image ? [ad.image] : [])).map((url, i) => ({
            id: `existing-${i}-${url}`,
            preview: url,
            mediaId: ad.mediaIds?.[i],
          })),
          status: "Продаю",
          title: ad.title,
          description: ad.description ?? "",
          price: String(ad.price || ""),
          categoryId: ad.categoryId ?? "",
          subcategoryId: ad.subcategoryId ?? "",
          nestedCategoryId: "",
          condition: ad.condition ?? "Б/у",
          city: ad.city,
          cityId: ad.cityId,
          contact: f.contact,
          deliveries: (ad.delivery.length ? ad.delivery : ["СДЭК"]).filter(
            (d) => !/boxberry|боксберри/i.test(d),
          ),
          packageSize: ad.packageSize ?? (ad.delivery.some(isCdekDelivery) ? "m" : ""),
          weightKg: ad.weightKg != null ? String(ad.weightKg) : "",
          dimL: ad.dimensionsCm?.length != null ? String(ad.dimensionsCm.length) : "",
          dimW: ad.dimensionsCm?.width != null ? String(ad.dimensionsCm.width) : "",
          dimH: ad.dimensionsCm?.height != null ? String(ad.dimensionsCm.height) : "",
          pickupAddress: ad.pickupAddress ?? "",
          promocode: f.promocode,
        }));
      })
      .catch(() => toast.error(t("pages.adsNew.loadFailed")))
      .finally(() => { if (alive) setLoadingEdit(false); });
    return () => { alive = false; };
  }, [editId, t]);

  useEffect(() => {
    const applyPhone = (phone: string | null | undefined, verified: boolean) => {
      if (!phone || (!verified && !isDemoMode())) return;
      const formatted = formatRuPhone(phone);
      setVerifiedPhone(formatted);
      setForm((f) => {
        if (!f.contact.trim() || phonesMatch(f.contact, formatted)) {
          return { ...f, contact: formatted };
        }
        return f;
      });
    };

    if (isDemoMode()) {
      applyPhone(currentUser?.phone, true);
      return;
    }
    if (currentUser?.phone && isPhoneVerified(currentUser)) {
      applyPhone(currentUser.phone, true);
    }
    let alive = true;
    fetchMe()
      .then((u) => {
        if (!alive || !u) return;
        setCurrentUser(u);
        applyPhone(u.phone, isPhoneVerified(u));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Prefill once from the signed-in profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cat = useMemo(() => cats.find((c) => c.id === form.categoryId) ?? cats[0], [cats, form.categoryId]);
  const subcategories = cat?.subcategories ?? [];
  const nestedCategories = useMemo(
    () => subcategories.find((s) => s.id === form.subcategoryId)?.children ?? [],
    [subcategories, form.subcategoryId],
  );

  useEffect(() => {
    if (!cats.length) return;
    if (listingPathToMap && listingCats.length) {
      const mapped = mapCategorySelectionByName(
        listingCats,
        cats,
        listingPathToMap.categoryId,
        listingPathToMap.subcategoryId,
        listingPathToMap.nestedCategoryId,
      );
      setListingPathToMap(null);
      if (mapped) {
        setForm((f) => ({ ...f, ...mapped }));
        return;
      }
    }
    if (listingPathToMap) return;
    setForm((f) => {
      const leaf = f.nestedCategoryId || f.subcategoryId;
      if (!leaf) return f;
      const path = listingCategoryPath(cats, leaf);
      if (!path.l1) return f;
      if (f.categoryId === path.l1 && f.subcategoryId === path.l2 && f.nestedCategoryId === path.l3) return f;
      return { ...f, categoryId: path.l1, subcategoryId: path.l2, nestedCategoryId: path.l3 };
    });
  }, [cats, listingCats, editId, listingPathToMap]);

  useEffect(() => {
    if (!listingPaymentEnabled || editId || step < 2) return;
    const ids = listingIdsFromForm(form, cats, listingCats);
    if (!ids) return;
    let alive = true;
    setQuoteLoading(true);
    fetchPlacementQuote({
      categoryId: ids.categoryId,
      subcategoryId: ids.subcategoryId,
      promocode: form.promocode,
    })
      .then((q) => { if (alive) setPlacementQuote(q); })
      .catch(() => { if (alive) setPlacementQuote(null); })
      .finally(() => { if (alive) setQuoteLoading(false); });
    return () => { alive = false; };
  }, [listingPaymentEnabled, editId, step, form.categoryId, form.subcategoryId, form.nestedCategoryId, form.promocode, cats, listingCats]);

  const valid = useMemo(() => {
    const photosOk = hasListingPhotos(form);
    const dataOk =
      photosOk
      && form.title.trim().length >= 4
      && form.description.trim().length >= 20
      && form.price
      && form.city.trim().length >= 2
      && (form.cityId != null || form.city.trim().length >= 3)
      && phonesMatch(form.contact, verifiedPhone)
      && deliveryDetailsValid(form) === null;
    if (editId) return dataOk;
    if (step === 1) return photosOk;
    if (step === 2) return dataOk;
    return photosOk && deliveryDetailsValid(form) === null;
  }, [step, form, verifiedPhone, editId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (submitting) return;

    if (!hasListingPhotos(form)) {
      notifyPhotosRequired(setStep, t);
      return;
    }

    if (!phonesMatch(form.contact, verifiedPhone)) {
      toast.error(t("pages.adsNew.contactError"));
      setStep(2);
      return;
    }

    const ids = listingIdsFromForm(form, cats, listingCats);
    if (!ids) {
      toast.error(t("pages.adsNew.selectCategory"));
      return;
    }
    const categoryId = ids.categoryId;
    const subcategoryId = ids.subcategoryId;
    if (nestedCategories.length > 0 && !form.nestedCategoryId) {
      toast.error(t("pages.adsNew.pickNestedCategory"));
      setStep(2);
      return;
    }

    const deliveryError = deliveryDetailsValid(form);
    if (deliveryError) {
      toast.error(deliveryError);
      return;
    }
    const parcel = parcelFromForm(form);
    if (parcel.pickupAddress) rememberPickupAddress(parcel.pickupAddress);

    const priceCents = priceRubToCents(form.price);
    if (priceCents === null) {
      toast.error(t("pages.adsNew.priceMaxError", { max: MAX_LISTING_PRICE_RUB.toLocaleString("ru-RU") }));
      return;
    }

    const cityId = form.cityId != null ? Number(form.cityId) : undefined;

    setSubmitting(true);
    setSubmitError(false);
    try {
      const mediaIds: string[] = [];
      for (const item of form.photoItems) {
        if (item.mediaId) {
          mediaIds.push(item.mediaId);
        } else if (item.file) {
          const m = await uploadMediaDeduped(item.file, "listing");
          mediaIds.push(m.uuid);
        }
      }
      if (mediaIds.length === 0) {
        toast.error(t(PHOTOS_REQUIRED_KEYS.title), { description: t(PHOTOS_REQUIRED_KEYS.description) });
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
        const updated = await updateListing(editId, {
          title: form.title.trim(),
          description: form.description.trim(),
          priceCents,
          categoryId,
          subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
          cityId: resolvedCityId,
          deliveryMethods: form.deliveries,
          mediaIds,
          packageSize: parcel.packageSize,
          weightKg: parcel.weightKg,
          dimensionsCm: parcel.dimensionsCm,
          pickupAddress: parcel.pickupAddress,
        });
        toast.success(
          updated.moderation === "moderation"
            ? t("pages.adsNew.sentModeration")
            : t("pages.adsNew.updated"),
        );
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
            toast.error(t("pages.adsNew.quoteFailed"));
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
          toast(t("pages.adsNew.paySoon"));
          setSubmitting(false);
          return;
        }

        if (needsPayment) {
          setPendingPay({
            mediaIds,
            categoryId,
            subcategoryId: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : undefined,
            cityId: resolvedCityId,
            priceCents,
            promocode,
            amountRub: (quote?.final_cents ?? 0) / 100,
            title: form.title.trim(),
            description: form.description.trim(),
            deliveries: form.deliveries,
            packageSize: parcel.packageSize ?? "",
            weightKg: form.weightKg,
            dimL: form.dimL,
            dimW: form.dimW,
            dimH: form.dimH,
            pickupAddress: form.pickupAddress,
          });
          setSubmitting(false);
          return;
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
            packageSize: parcel.packageSize,
            weightKg: parcel.weightKg,
            dimensionsCm: parcel.dimensionsCm,
            pickupAddress: parcel.pickupAddress,
          });
          toast.success(
            created.moderation === "moderation"
              ? t("pages.adsNew.sentModeration")
              : t("pages.adsNew.published"),
          );
        }
      }
      void navigate({ to: "/my-ads" });
    } catch (err) {
      setSubmitError(true);
      const fallback = editId ? t("pages.adsNew.saveFailed") : t("pages.adsNew.publishFailed");
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

  const completePaidListing = async (source: PayWith) => {
    const job = pendingPay;
    if (!job) return;
    setPendingPay(null);
    setSubmitting(true);
    try {
      const draft = await createListing({
        title: job.title,
        description: job.description,
        priceCents: job.priceCents,
        categoryId: job.categoryId,
        subcategoryId: job.subcategoryId,
        cityId: job.cityId,
        deliveryMethods: job.deliveries,
        mediaIds: job.mediaIds,
        publish: false,
        promocode: job.promocode,
        packageSize: job.packageSize || undefined,
        weightKg: parcelFromForm(job as Form).weightKg,
        dimensionsCm: parcelFromForm(job as Form).dimensionsCm,
        pickupAddress: job.pickupAddress || undefined,
      });
      const checkout = await createListingPlacementPayment({
        categoryId: job.categoryId,
        subcategoryId: job.subcategoryId,
        promocode: job.promocode,
        listingUuid: draft.id,
        payWith: source,
      });
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
        return;
      }
      notifyBillingChanged();
      toast.success(source === "wallet" ? t("pages.subscription.payWalletPaid") : t("pages.adsNew.paySuccess"));
      void navigate({ to: "/my-ads" });
    } catch (err) {
      setSubmitError(true);
      if (isInsufficientFunds(err)) {
        toast.error(t("pages.subscription.payInsufficientBalance"));
        void navigate({ to: "/settings/wallet" });
      } else {
        const fallback = t("pages.adsNew.publishFailed");
        toast.error(err instanceof ApiError ? firstFieldError(err.errors, err.message || fallback) : fallback);
      }
      setSubmitting(false);
    }
  };

  const placementPriceLabel = placementQuote
    ? (placementQuote.is_free ? t("pages.adsNew.free") : `${formatQuoteRub(placementQuote.final_cents)} ₽`)
    : "…";

  const publishButtonLabel = useMemo(
    () =>
      resolvePublishCtaLabel(t, {
        editId,
        listingPaymentEnabled,
        flagsHydrated,
        quoteLoading,
        placementQuote,
      }),
    [t, editId, listingPaymentEnabled, flagsHydrated, quoteLoading, placementQuote],
  );

  /** Block only while quote is actively loading; submit() re-fetches if needed. */
  const paymentGatePending = !editId && (!flagsHydrated || (listingPaymentEnabled && quoteLoading));

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-[24px] pb-[calc(var(--bottom-nav-space)+88px)] lg:pb-[96px]">
        <header className="space-y-[6px]">
          <Link to="/ads" className="inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            <ChevronLeft size={14} /> {t("pages.adsNew.backToListings")}
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-none sm:text-[36px]"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {editId ? t("pages.adsNew.editListingTitle") : t("pages.adsNew.newListingTitle")}
          </h1>
          <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
            {listingPaymentEnabled
              ? (quoteLoading ? t("pages.adsNew.calculatingCost") : t("pages.adsNew.paidPlacement", { price: placementPriceLabel }))
              : t("pages.adsNew.freePlacement")}
          </p>
        </header>

        {!editId && <StepIndicator current={step} labels={steps} />}

        {editId ? (
          <>
            <StepPhotos form={form} set={set} />
            <StepData
              form={form}
              set={set}
              cat={cat}
              cats={cats}
              subcategories={subcategories}
              touched={touched}
              touch={touch}
              verifiedPhone={verifiedPhone}
              hidePhotoPreview
              onVerifiedPhone={(phone) => {
                setVerifiedPhone(phone);
                set("contact", phone);
              }}
            />
          </>
        ) : (
        <ReducedMotionSwitch
          switchKey={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 1 && <StepPhotos form={form} set={set} />}
          {step === 2 && (
            <StepData
              form={form}
              set={set}
              cat={cat}
              cats={cats}
              subcategories={subcategories}
              touched={touched}
              touch={touch}
              verifiedPhone={verifiedPhone}
              onVerifiedPhone={(phone) => {
                setVerifiedPhone(phone);
                set("contact", phone);
              }}
            />
          )}
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
        )}
      </div>

      {/* Sticky footer — lifted above the mobile BottomNav so the submit CTA is never covered */}
      <div
        className="fixed inset-x-0 bottom-[var(--bottom-nav-space)] z-40 border-t backdrop-blur lg:bottom-0"
        style={{
          background: "color-mix(in srgb, var(--background) 88%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-[760px] flex-col-reverse gap-[8px] px-[16px] py-[12px] sm:flex-row sm:items-center sm:justify-between sm:gap-[12px] sm:px-[24px]">
          {!editId && (
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="h-11 w-full shrink-0 rounded-[var(--r-button)] sm:w-auto"
            >
              <ChevronLeft size={16} /> {t("pages.adsNew.back")}
            </Button>
          )}
          {editId || step >= 3 ? (
            <Button
              onClick={() => {
                if (!hasListingPhotos(form)) {
                  notifyPhotosRequired(setStep, t);
                  return;
                }
                if (editId && !valid) return;
                void submit();
              }}
              loading={submitting}
              disabled={editId ? !valid : paymentGatePending}
              aria-label={publishButtonLabel}
              className="h-11 w-full shrink-0 rounded-[var(--r-button)] px-4 sm:min-w-[220px] sm:w-auto"
            >
              {submitting ? (editId ? t("pages.adsNew.saving") : t("pages.adsNew.publishing")) : publishButtonLabel}
            </Button>
          ) : (
            <Button
              disabled={step === 2 && !valid}
              onClick={() => {
                if (!hasListingPhotos(form)) {
                  notifyPhotosRequired(setStep, t);
                  return;
                }
                if (step === 2 && !valid) return;
                setStep((s) => Math.min(3, s + 1));
              }}
              className="h-11 w-full shrink-0 rounded-[var(--r-button)] sm:w-auto"
            >
              {t("pages.adsNew.next")} <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>

      <PaymentSourceDialog
        open={pendingPay !== null}
        onOpenChange={(v) => { if (!v) setPendingPay(null); }}
        amountRub={pendingPay?.amountRub ?? 0}
        onSelect={(source) => void completePaidListing(source)}
        onTopUp={() => {
          setPendingPay(null);
          void navigate({ to: "/settings/wallet" });
        }}
      />

    </AppLayout>
  );
}

/* ────────── Photo helpers ────────── */
function usePhotoGridHandlers(
  photoItems: PhotoItem[],
  setPhotoItems: (next: PhotoItem[]) => void,
) {
  const photoItemsRef = useRef(photoItems);
  photoItemsRef.current = photoItems;

  const photos = photoItems.map((p) => p.preview);
  const photoIds = photoItems.map((p) => p.id);

  const reorderByUrls = (newPhotos: string[]) => {
    const items = photoItemsRef.current;
    const byPreview = new Map(items.map((p) => [p.preview, p]));
    const next = newPhotos.map((url) => byPreview.get(url)).filter((p): p is PhotoItem => p != null);
    if (next.length === items.length) setPhotoItems(next);
  };

  return {
    photos,
    photoIds,
    onAdd: (picked: File[]) => {
      void (async () => {
        const current = photoItemsRef.current;
        const room = MAX_PHOTOS - current.length;
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
          setPhotoItems([...current, ...accepted]);
          for (const item of accepted) {
            if (!item.file) continue;
            void uploadMediaDeduped(item.file, "listing")
              .then((m) => {
                const latest = photoItemsRef.current.map((p) =>
                  p.id === item.id ? { ...p, mediaId: m.uuid } : p,
                );
                setPhotoItems(latest);
              })
              .catch(() => {
                /* submit still uploads the File */
              });
          }
        }
      })();
    },
    onRemove: (i: number) => setPhotoItems(photoItemsRef.current.filter((_, j) => j !== i)),
    onMakeMain: (i: number) => {
      const next = [...photoItemsRef.current];
      const [m] = next.splice(i, 1);
      next.unshift(m);
      setPhotoItems(next);
    },
    onReorder: reorderByUrls,
    onReplace: (i: number, blob: Blob) => {
      const old = photoItemsRef.current[i];
      if (!old) return;
      const preview = URL.createObjectURL(blob);
      const file = new File([blob], `${old.id}.jpg`, { type: blob.type || "image/jpeg" });
      const next = [...photoItemsRef.current];
      next[i] = { ...old, preview, file, mediaId: undefined };
      setPhotoItems(next);
      if (old.preview.startsWith("blob:")) URL.revokeObjectURL(old.preview);
      void uploadMediaDeduped(file, "listing")
        .then((m) => {
          const latest = photoItemsRef.current.map((p) =>
            p.id === old.id ? { ...p, mediaId: m.uuid } : p,
          );
          setPhotoItems(latest);
        })
        .catch(() => {});
    },
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editingItem = editingIndex != null ? photoItems[editingIndex] : null;
  return (
    <>
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
        onEdit={(i) => setEditingIndex(i)}
      />
      <PhotoEditorDialog
        open={editingIndex != null}
        src={editingItem ? (editingItem.file ?? editingItem.preview) : null}
        title="Редактирование фото объявления"
        onCancel={() => setEditingIndex(null)}
        onSave={(blob) => {
          if (editingIndex != null) handlers.onReplace(editingIndex, blob);
          setEditingIndex(null);
        }}
        onDelete={() => {
          if (editingIndex != null) handlers.onRemove(editingIndex);
          setEditingIndex(null);
        }}
      />
    </>
  );
}

/* ────────── STEP 1: Photos ────────── */
function StepPhotos({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-[16px]">
      <StepHeading title={t("pages.adsNew.photosHeading")} description={t("pages.adsNew.photosDesc", { max: MAX_PHOTOS })} />
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
  form, set, cat, cats, subcategories, touched, touch, verifiedPhone, onVerifiedPhone, hidePhotoPreview = false,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  cat: Category | undefined;
  cats: Category[];
  subcategories: { id: string; name: string }[];
  touched: Set<string>;
  touch: (name: string) => void;
  verifiedPhone: string;
  onVerifiedPhone: (phone: string) => void;
  hidePhotoPreview?: boolean;
}) {
  const { t } = useTranslation();
  const deliveryMethods = useDeliveryMethods();
  const titleErr = touched.has("title") && form.title.trim().length < 4;
  const conditionOptions = useMemo(
    () => CONDITIONS.map((c) => ({
      label: c === "Новое" ? t("pages.myAds.conditionNew") : t("pages.myAds.conditionUsed"),
      value: c,
    })),
    [t],
  );
  const descErr = touched.has("description") && form.description.trim().length < 20;
  const priceErr = touched.has("price") && !form.price;
  const cityErr = touched.has("city") && (form.city.trim().length < 2 || (!form.cityId && form.city.trim().length < 3));
  const contactVerified = phonesMatch(form.contact, verifiedPhone);
  const contactErr = touched.has("contact") && !contactVerified;
  const nestedCategories = cat?.subcategories.find((s) => s.id === form.subcategoryId)?.children ?? [];

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
      {form.photoItems.length > 0 && !hidePhotoPreview && (
        <Block title={t("pages.adsNew.photosHeading")}>
          <ListingPhotoGrid
            photoItems={form.photoItems}
            setPhotoItems={(next) => set("photoItems", next)}
            variant="compact"
            hideUploader
          />
        </Block>
      )}

      <Block title={t("pages.adsNew.descriptionBlock")}>
        <Field label={t("pages.adsNew.titleLabel")} required error={titleErr ? t("pages.adsNew.titleMinError") : undefined}>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={() => touch("title")}
            error={titleErr}
            className="h-11"
            placeholder={t("pages.adsNew.titlePlaceholder")}
          />
        </Field>
        <Field label={t("pages.adsNew.descLabel")} required error={descErr ? t("pages.adsNew.descMinError") : undefined}>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            onBlur={() => touch("description")}
            placeholder={t("pages.adsNew.descPlaceholder")}
            rows={5}
          />
        </Field>
      </Block>

      <Block title={t("pages.adsNew.paramsBlock")}>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label={t("pages.adsNew.priceLabel")} required error={priceErr ? t("pages.adsNew.priceError") : undefined}>
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
          <Field label={t("pages.adsNew.conditionLabel")}>
            <NativeSelect value={form.condition} onChange={(v) => set("condition", v as AdCondition)} options={conditionOptions} />
            <p className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.adsNew.conditionHint")}
            </p>
          </Field>
          <Field label={t("pages.adsNew.categoryLabel")}>
            <NativeSelect
              value={form.categoryId}
              onChange={(v) => {
                const c = cats.find((x) => x.id === v);
                set("categoryId", v);
                set("subcategoryId", c?.subcategories[0]?.id ?? "");
                set("nestedCategoryId", "");
              }}
              options={cats.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Field>
          {subcategories.length > 0 ? (
            <Field label={t("pages.adsNew.subcategoryLabel")}>
              <NativeSelect
                value={form.subcategoryId}
                onChange={(v) => {
                  set("subcategoryId", v);
                  set("nestedCategoryId", "");
                }}
                options={subcategories.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Field>
          ) : null}
          {nestedCategories.length > 0 ? (
            <Field label={t("pages.adsNew.nestedCategoryLabel")}>
              <NativeSelect
                value={form.nestedCategoryId}
                onChange={(v) => set("nestedCategoryId", v)}
                options={[
                  { label: t("pages.adsNew.pickNestedCategory"), value: "" },
                  ...nestedCategories.map((s) => ({ label: s.name, value: s.id })),
                ]}
              />
            </Field>
          ) : null}
        </div>
      </Block>

      <Block title={t("pages.adsNew.contactsBlock")}>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <Field label={t("pages.profile.fieldCity")} required error={cityErr ? t("pages.adsNew.cityError") : undefined}>
            <CitySelect
              value={form.city}
              cityId={form.cityId}
              onChange={(name, id) => {
                set("city", name);
                set("cityId", id);
                touch("city");
              }}
              placeholder={t("pages.adsNew.cityPlaceholder")}
            />
          </Field>
          <div className="block space-y-[6px]">
            <span className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("pages.adsNew.contactLabel")}<span style={{ color: "var(--accent)" }}> *</span>
            </span>
            <ListingContactPhoneField
              value={form.contact}
              verifiedPhone={verifiedPhone}
              error={contactErr}
              onChange={(v) => set("contact", v)}
              onBlur={() => touch("contact")}
              onVerified={onVerifiedPhone}
            />
            {contactErr && (
              <span className="block text-[11px] font-medium" style={{ color: "var(--danger)" }}>
                {t("pages.adsNew.contactError")}
              </span>
            )}
          </div>
        </div>
        <Field label="Способы доставки">
          <div className="space-y-[14px]">
            {(() => {
              const cdek = deliveryMethods.filter((m) => isCdekDelivery(m.label) || m.id === "cdek");
              const pickup = deliveryMethods.filter((m) => isPickupDelivery(m.label) || m.id === "pickup");
              const others = deliveryMethods.filter((m) => !cdek.includes(m) && !pickup.includes(m));
              const toggle = (m: { id: string; label: string }) => {
                const next = toggleDeliveryMethod(form.deliveries, m);
                set("deliveries", next);
                if (next.some(isCdekDelivery) && !form.packageSize) set("packageSize", "m");
              };
              return (
                <>
                  {cdek.map((m) => (
                    <div key={m.id} className="space-y-[8px]">
                      <div className="flex flex-wrap items-center gap-[8px]">
                        <Checkbox
                          checked={isDeliveryOn(form.deliveries, m)}
                          onChange={() => toggle(m)}
                          label="Доставка СДЭК (Безопасная сделка)"
                        />
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full"
                                style={{ color: "var(--foreground-50)" }}
                                aria-label="Как работает безопасная сделка"
                              >
                                <CircleHelp size={16} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px] text-[12px] leading-snug">
                              Оплата холдируется до подтверждения получения. Доставка — через ПВЗ СДЭК.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <a
                          href="/rules/safe-deal"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          Правила
                        </a>
                      </div>
                      {isDeliveryOn(form.deliveries, m) && (
                        <div className="ml-[4px] space-y-[10px] rounded-[var(--r-card)] p-[12px]" style={{ background: "var(--background-surface)" }}>
                          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                            Укажите типоразмер или точные габариты — от них считается тариф СДЭК.
                          </p>
                          <div className="flex flex-wrap gap-[8px]">
                            {(["s", "m", "l"] as const).map((size) => (
                              <button
                                key={size}
                                type="button"
                                className="min-h-[40px] rounded-[var(--r-tag)] border px-[14px] text-[13px] font-semibold"
                                style={{
                                  borderColor: form.packageSize === size ? "var(--accent)" : "var(--border)",
                                  background: form.packageSize === size ? "var(--accent-soft)" : "var(--background-elevated)",
                                  color: form.packageSize === size ? "var(--accent)" : "var(--foreground-70)",
                                }}
                                onClick={() => set("packageSize", form.packageSize === size ? "" : size)}
                              >
                                {size.toUpperCase()}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-[8px] sm:grid-cols-4">
                            <Input value={form.dimL} onChange={(e) => set("dimL", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Д, см" inputMode="numeric" />
                            <Input value={form.dimW} onChange={(e) => set("dimW", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Ш, см" inputMode="numeric" />
                            <Input value={form.dimH} onChange={(e) => set("dimH", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="В, см" inputMode="numeric" />
                            <Input value={form.weightKg} onChange={(e) => set("weightKg", e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} placeholder="Вес, кг" inputMode="decimal" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {others.length > 0 && (
                    <div className="space-y-[8px]">
                      <p className="text-[12px] font-medium" style={{ color: "var(--foreground-70)" }}>
                        Другие службы (прямая договорённость, без трекинга)
                      </p>
                      <div className="flex flex-wrap gap-[8px]">
                        {others.map((m) => (
                          <Checkbox
                            key={m.id}
                            checked={isDeliveryOn(form.deliveries, m)}
                            onChange={() => toggle(m)}
                            label={m.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {pickup.map((m) => (
                    <div key={m.id} className="space-y-[8px]">
                      <Checkbox
                        checked={isDeliveryOn(form.deliveries, m)}
                        onChange={() => toggle(m)}
                        label="Самовывоз"
                      />
                      {isDeliveryOn(form.deliveries, m) && (
                        <Field
                          label="Адрес или ориентир"
                          required
                          error={form.pickupAddress.trim().length < 3 ? "Укажите адрес или ориентир для самовывоза" : undefined}
                        >
                          <PickupAddressField
                            value={form.pickupAddress}
                            onChange={(v) => set("pickupAddress", v)}
                            error={form.pickupAddress.trim().length < 3}
                            placeholder="Адрес или ориентир"
                          />
                        </Field>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
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
  const { t } = useTranslation();
  const sub = cat?.subcategories.find((s) => s.id === form.subcategoryId);
  const nested = sub?.children?.find((s) => s.id === form.nestedCategoryId);

  return (
    <section className="space-y-[16px]">
      <StepHeading title={t("pages.adsNew.previewHeading")} description={t("pages.adsNew.previewDesc")} />

      {submitError && (
        <Alert variant="error">
          <AlertDescription>
            {t("pages.adsNew.publishErrorBanner", { label: publishButtonLabel })}
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
          subcategory={nested?.name ?? sub?.name}
        />

        <Card
          className="space-y-[16px] p-[20px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}
        >
          <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>
            {form.title || t("pages.adsNew.titleFallback")}
          </h3>
          <p className="whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {form.description || t("pages.adsNew.descFallback")}
          </p>
          <div className="grid gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <div className="inline-flex items-center gap-[6px]"><MapPin size={14} /> {form.city || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Phone size={14} /> {form.contact || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Truck size={14} /> {form.deliveries.join(", ") || "—"}</div>
            <div className="inline-flex items-center gap-[6px]"><Tag size={14} /> {form.condition}</div>
          </div>
        </Card>
      </div>

      <Alert variant="info">
        <AlertDescription>
          {listingPaymentEnabled ? (
            quoteLoading ? t("pages.adsNew.calculatingCost") : placementQuote?.is_free
              ? t("pages.adsNew.moderationNoteFree")
              : t("pages.adsNew.moderationNotePaid", { price: formatQuoteRub(placementQuote?.final_cents ?? 0) })
          ) : t("pages.adsNew.moderationNoteDefault")}
        </AlertDescription>
      </Alert>

      {listingPaymentEnabled && (
        <Card className="space-y-[10px] p-[16px]" style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          <label className="grid gap-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {t("pages.adsNew.promocodeLabel")}
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
              <div>{t("pages.adsNew.basePrice", { price: formatQuoteRub(placementQuote.base_cents) })}</div>
              {placementQuote.promo_discount_cents > 0 && (
                <div>{t("pages.adsNew.promoDiscount", { price: formatQuoteRub(placementQuote.promo_discount_cents) })}</div>
              )}
              {placementQuote.has_active_subscription && placementQuote.free_listings_remaining != null && (
                <div>{t("pages.adsNew.freeListingsRemaining", { count: placementQuote.free_listings_remaining })}</div>
              )}
              {(placementQuote.listing_placement_credits ?? 0) > 0 && (
                <div>{t("pages.adsNew.listingCreditsRemaining", { count: placementQuote.listing_placement_credits })}</div>
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

function ListingContactPhoneField({
  value,
  verifiedPhone,
  error,
  onChange,
  onBlur,
  onVerified,
}: {
  value: string;
  verifiedPhone: string;
  error?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onVerified: (phone: string) => void;
}) {
  const { t } = useTranslation();
  const verified = phonesMatch(value, verifiedPhone);
  const hasVerifiedProfilePhone = phoneDigits(verifiedPhone).length === 11;
  const [editing, setEditing] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const locked = hasVerifiedProfilePhone && verified && !editing;

  useEffect(() => {
    if (!verified) return;
    setSmsSent(false);
    setSmsCode("");
  }, [verified]);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = window.setInterval(() => setSmsCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [smsCooldown]);

  const cancelChange = () => {
    onChange(verifiedPhone);
    setEditing(false);
    setSmsSent(false);
    setSmsCode("");
  };

  const sendSms = async () => {
    if (phoneDigits(value).length !== 11) {
      toast.error(t("pages.settings.invalidPhone"));
      return;
    }
    setSmsSending(true);
    try {
      await sendPhoneVerificationCode(value);
      setSmsSent(true);
      setSmsCooldown(60);
      toast.success(t("pages.settings.smsSent"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.smsSendFailed"));
    } finally {
      setSmsSending(false);
    }
  };

  const confirmSms = async () => {
    if (!/^\d{6}$/.test(smsCode.trim())) {
      toast.error(t("pages.settings.invalidSmsCode"));
      return;
    }
    setSmsVerifying(true);
    try {
      const user = await verifyPhoneCode(value, smsCode.trim());
      setCurrentUser(user);
      const formatted = formatRuPhone(user.phone ?? value);
      onVerified(formatted);
      setSmsCode("");
      setSmsSent(false);
      setEditing(false);
      toast.success(t("pages.settings.phoneVerified"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.wrongCode"));
    } finally {
      setSmsVerifying(false);
    }
  };

  return (
    <div className="space-y-[8px]">
      <PhoneInput
        value={value}
        onValueChange={(next) => {
          if (!locked) onChange(next);
        }}
        onBlur={onBlur}
        error={error}
        readOnly={locked}
        className={locked ? "h-11 cursor-default bg-[var(--background-surface)]" : "h-11"}
      />
      {locked ? (
        <div className="flex flex-wrap items-center gap-[8px]">
          <Badge variant="published" withIcon={false}>{t("pages.adsNew.contactVerifiedBadge")}</Badge>
          <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.adsNew.contactFromProfile")}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-[8px] text-[12px]"
            onClick={() => setEditing(true)}
          >
            {t("pages.adsNew.contactChange")}
          </Button>
        </div>
      ) : (
        <div className="space-y-[8px]">
          <p className="text-[12px]" style={{ color: "var(--foreground-70)" }}>
            {t("pages.adsNew.contactChangeHint")}
          </p>
          <div className="flex flex-wrap gap-[8px]">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={smsSending || smsCooldown > 0 || phoneDigits(value).length !== 11 || verified}
              onClick={() => void sendSms()}
            >
              {smsSending && <Loader2 size={14} className="mr-[6px] animate-spin" />}
              {smsCooldown > 0
                ? t("pages.settings.resendIn", { sec: smsCooldown })
                : t("pages.adsNew.contactSendCode")}
            </Button>
            {hasVerifiedProfilePhone && (
              <Button type="button" variant="ghost" className="h-10" onClick={cancelChange}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
          {smsSent && (
            <div className="flex flex-col gap-[8px] sm:flex-row sm:items-center">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("pages.settings.smsCode")}
                className="h-11 sm:max-w-[160px]"
              />
              <Button
                type="button"
                className="h-11"
                disabled={smsVerifying || smsCode.length !== 6}
                onClick={() => void confirmSms()}
              >
                {smsVerifying && <Loader2 size={14} className="mr-[6px] animate-spin" />}
                {t("pages.adsNew.contactConfirmCode")}
              </Button>
            </div>
          )}
        </div>
      )}
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

