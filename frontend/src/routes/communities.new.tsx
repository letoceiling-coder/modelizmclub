import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { useCurrentUser } from "@/lib/session";
import { isFullyVerified, isStaffUser } from "@/lib/auth/verification";
import { useMySubscription } from "@/lib/subscription";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CitySelect } from "@/components/ads/CitySelect";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { applyCommunity } from "@/lib/api/entity-requests";
import { uploadMedia } from "@/lib/api/media";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { blobToImageFile, prepareProfileImageFile, PROFILE_COVER_MAX_BYTES, PROFILE_IMAGE_ACCEPT } from "@/lib/profile-image";
import { COMMUNITY_DESCRIPTION_MAX, COMMUNITY_NAME_MAX, COMMUNITY_RULES_MAX } from "@/lib/community-limits";
import { toast } from "@/lib/toast";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/communities/new")({
  head: () => ({ meta: [{ title: i18n.t("pages.communityWizard.metaTitle") }] }),
  component: CommunityNewPage,
});

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

const STEPS = 4;

function CommunityNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { requirePremium, requireAccount, isGuest } = useGuestAccess();
  const { sub, loading: subLoading } = useMySubscription();
  const eligible = isStaffUser(me) || isFullyVerified(me) || sub?.is_active === true;

  useEffect(() => {
    if (isGuest) {
      requireAccount(() => undefined, "/communities/new");
    }
  }, [isGuest, requireAccount]);

  if (isGuest || subLoading) {
    return (
      <AppLayout rightColumn={false} footer>
        <div className="py-10 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("common.loading")}
        </div>
      </AppLayout>
    );
  }

  if (!eligible) {
    return (
      <AppLayout rightColumn={false} footer>
        <div className="py-10">
          <EmptyState
            icon={Users}
            title={t("pages.communityWizard.needAccessTitle")}
            description={t("pages.communityWizard.needAccessDesc")}
          >
            <Button
              className="rounded-[12px]"
              onClick={() => requirePremium(() => undefined, "/communities/new")}
            >
              {t("pages.communityWizard.needAccessAction")}
            </Button>
          </EmptyState>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false} footer>
      <CommunityWizard onCancel={() => void navigate({ to: "/communities" })} />
    </AppLayout>
  );
}

function CommunityWizard({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const directions = usePostCategories();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cityName, setCityName] = useState("");
  const [cityId, setCityId] = useState<number | undefined>();
  const [avatarEditorFile, setAvatarEditorFile] = useState<File | null>(null);
  const [coverEditorFile, setCoverEditorFile] = useState<File | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [customCategory, setCustomCategory] = useState("");

  const [rules, setRules] = useState("");
  const [accessType, setAccessType] = useState<"open" | "request">("open");

  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");

  const topicOptions = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    for (const cat of directions) {
      const parentId = Number(cat.id);
      if (Number.isFinite(parentId)) out.push({ id: parentId, label: cat.name });
      for (const sub of cat.subcategories ?? []) {
        const id = Number(sub.id);
        if (Number.isFinite(id)) out.push({ id, label: `${cat.name} → ${sub.name}` });
      }
    }
    return out;
  }, [directions]);

  const toggleTopic = (id: number) => {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 12)));
  };

  const submit = async () => {
    if (name.trim().length < 3) {
      toast.error(t("pages.communityWizard.nameMin"));
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      let avatarUuid: string | null = null;
      let coverUuid: string | null = null;
      if (pendingAvatar) {
        avatarUuid = (await uploadMedia(pendingAvatar, "avatar")).uuid;
      }
      if (pendingCover) {
        coverUuid = (await uploadMedia(pendingCover, "banner")).uuid;
      }
      await applyCommunity({
        proposedName: name.trim(),
        description: description.trim() || undefined,
        cityId: cityId ?? null,
        postCategoryIds: selectedTopics,
        customCategory: customCategory.trim() || undefined,
        rules: rules.trim() || undefined,
        accessType,
        contacts: {
          telegram: telegram.trim() || undefined,
          website: website.trim() || undefined,
          phone: phone.trim() || undefined,
        },
        avatarMediaUuid: avatarUuid,
        coverMediaUuid: coverUuid,
      });
      toast.success(t("pages.communityWizard.submitted"));
      void navigate({ to: "/communities" });
    } catch (e) {
      const already = e instanceof Error && /рассмотрении|pending|application/i.test(e.message);
      toast.error(already ? t("pages.communityWizard.alreadyPending") : t("pages.communityWizard.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto max-w-[640px] space-y-[16px] pb-[24px]">
      <div>
        <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>
          {t("pages.communityWizard.title")}
        </h1>
        <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.communityWizard.subtitle")}
        </p>
      </div>

      <div className="flex gap-[6px]">
        {Array.from({ length: STEPS }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className="h-[6px] flex-1 rounded-full"
            style={{ background: i <= step ? "var(--accent)" : "var(--border)" }}
            aria-label={t("pages.communityWizard.stepAria", { n: i + 1 })}
          />
        ))}
      </div>
      <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
        {t("pages.communityWizard.stepLabel", { current: step + 1, total: STEPS })}
      </div>

      <Card className="space-y-[14px] p-[20px] shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}>
        {step === 0 && (
          <>
            <h2 className="font-display text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityWizard.stepBasics")}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
                <span>{t("pages.communityWizard.name")}</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>{name.length}/{COMMUNITY_NAME_MAX}</span>
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={COMMUNITY_NAME_MAX}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
                <span>{t("pages.communityWizard.description")}</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>{description.length}/{COMMUNITY_DESCRIPTION_MAX}</span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={COMMUNITY_DESCRIPTION_MAX}
                rows={4}
                className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none"
                style={inputStyle}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.communityWizard.city")}</span>
              <CitySelect
                value={cityName}
                cityId={cityId}
                onChange={(nameValue, id) => {
                  setCityName(nameValue);
                  setCityId(id);
                }}
                placeholder={t("pages.communityWizard.cityPlaceholder")}
              />
            </div>
            <div className="rounded-[12px] border p-3" style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}>
              <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{t("pages.communityWizard.branding")}</p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>{t("pages.communityWizard.brandingHint")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => avatarInputRef.current?.click()} className="rounded-[8px] border px-3 py-2 text-[12px] font-medium" style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}>
                  {avatarPreview ? t("pages.communityWizard.changeAvatar") : t("pages.communityWizard.uploadAvatar")}
                </button>
                {avatarPreview && <img src={avatarPreview} width={48} height={48} loading="lazy" decoding="async" alt="" className="h-12 w-12 rounded-full object-cover" />}
                <button type="button" onClick={() => coverInputRef.current?.click()} className="rounded-[8px] border px-3 py-2 text-[12px] font-medium" style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}>
                  {coverPreview ? t("pages.communityWizard.changeCover") : t("pages.communityWizard.uploadCover")}
                </button>
                {coverPreview && <img src={coverPreview} width={80} height={40} loading="lazy" decoding="async" alt="" className="h-10 w-[80px] rounded-[6px] object-cover" />}
              </div>
              <input ref={avatarInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try { setAvatarEditorFile(await prepareProfileImageFile(file)); }
                catch (err) { toast.error(err instanceof Error ? err.message : t("pages.communityWizard.fileFailed")); }
              }} />
              <input ref={coverInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try { setCoverEditorFile(await prepareProfileImageFile(file, PROFILE_COVER_MAX_BYTES)); }
                catch (err) { toast.error(err instanceof Error ? err.message : t("pages.communityWizard.fileFailed")); }
              }} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-display text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityWizard.stepTopics")}
            </h2>
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("pages.communityWizard.topicsHint")}</p>
            <div className="flex max-h-[320px] flex-col gap-[6px] overflow-y-auto">
              {topicOptions.map((opt) => {
                const on = selectedTopics.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleTopic(opt.id)}
                    className="rounded-[10px] border px-3 py-2 text-left text-[13px]"
                    style={{
                      borderColor: on ? "var(--accent)" : "var(--border)",
                      background: on ? "var(--accent-soft)" : "var(--background-surface)",
                      color: "var(--foreground)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.communityWizard.customCategory")}</span>
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                maxLength={120}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
                placeholder={t("pages.communityWizard.customCategoryPlaceholder")}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityWizard.stepRules")}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
                <span>{t("pages.communityWizard.rules")}</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>{rules.length}/{COMMUNITY_RULES_MAX}</span>
              </span>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                maxLength={COMMUNITY_RULES_MAX}
                rows={6}
                className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none"
                style={inputStyle}
              />
            </label>
            <div className="grid gap-[8px] sm:grid-cols-2">
              {(["open", "request"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setAccessType(kind)}
                  className="rounded-[12px] border p-3 text-left"
                  style={{
                    borderColor: accessType === kind ? "var(--accent)" : "var(--border)",
                    background: accessType === kind ? "var(--accent-soft)" : "var(--background-surface)",
                  }}
                >
                  <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {kind === "open" ? t("pages.communityWizard.accessOpen") : t("pages.communityWizard.accessClosed")}
                  </div>
                  <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {kind === "open" ? t("pages.communityWizard.accessOpenHint") : t("pages.communityWizard.accessClosedHint")}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityWizard.stepContacts")}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.communityWizard.telegram")}</span>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} placeholder="https://t.me/…" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.communityWizard.website")}</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} placeholder="https://" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("pages.communityWizard.phone")}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} />
            </label>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <div className="flex flex-wrap gap-[8px]">
          {step > 0 && <Button type="button" variant="outline" onClick={goPrev}>{t("pages.communityWizard.back")}</Button>}
          {step < STEPS - 1 ? (
            <>
              <Button type="button" variant="outline" onClick={goNext}>{t("pages.communityWizard.skip")}</Button>
              <Button type="button" onClick={goNext}>{t("pages.communityWizard.next")}</Button>
            </>
          ) : (
            <Button type="button" onClick={() => void submit()} disabled={submitting}>
              {submitting ? t("pages.communityWizard.sending") : t("pages.communityWizard.submit")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        {t("pages.communityWizard.moderationNote")} <Link to="/communities" className="underline">{t("pages.communityWizard.toList")}</Link>
      </p>

      <PhotoEditorDialog
        file={avatarEditorFile}
        aspect={1}
        lockAspect
        shape="circle"
        lockShape
        outputWidth={480}
        outputHeight={480}
        title={t("pages.communityWizard.avatarTitle")}
        onCancel={() => setAvatarEditorFile(null)}
        onCropped={(blob) => {
          const file = blobToImageFile(blob, "community-avatar");
          setAvatarEditorFile(null);
          setPendingAvatar(file);
          setAvatarPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
          });
        }}
      />
      <PhotoEditorDialog
        file={coverEditorFile}
        aspect={3.5}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={1400}
        outputHeight={400}
        title={t("pages.communityWizard.coverTitle")}
        safeZonePreset="cover-wide"
        onCancel={() => setCoverEditorFile(null)}
        onCropped={(blob) => {
          const file = blobToImageFile(blob, "community-cover");
          setCoverEditorFile(null);
          setPendingCover(file);
          setCoverPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
          });
        }}
      />
    </div>
  );
}
