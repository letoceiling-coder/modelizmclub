import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { LandingCardIconField } from "@/components/admin/LandingCardIconField";
import { LandingCardIcon } from "@/components/landing/LandingCardIcon";
import { IconBox } from "@/components/ui/Icon";
import { fetchPostCategories } from "@/lib/api/categories";
import {
  createAdminLandingCard,
  deleteAdminLandingCard,
  fetchAdminLandingBlocks,
  reorderAdminLandingCards,
  updateAdminLandingCard,
  updateAdminLandingSection,
  type AdminLandingCard,
  type AdminLandingSection,
} from "@/lib/api/admin";

const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
  width: "100%",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: "64px",
  padding: "10px 14px",
  resize: "vertical" as const,
};

const primaryBtn: CSSProperties = {
  height: "36px",
  padding: "0 14px",
  borderRadius: "var(--r-button)",
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  height: "32px",
  padding: "0 10px",
  borderRadius: "var(--r-button)",
  background: "transparent",
  color: "var(--foreground-70)",
  fontSize: "12px",
  border: "1px solid var(--border)",
  cursor: "pointer",
};

function CardRow({
  card,
  onChange,
  onSave,
  onDelete,
  saving,
  showDescription,
  categories,
}: {
  card: AdminLandingCard;
  onChange: (patch: Partial<AdminLandingCard>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  showDescription: boolean;
  categories: { id: number; name: string }[];
}) {
  const { t } = useTranslation();
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={card.id}
      dragListener={false}
      dragControls={dragControls}
      className="rounded-[12px] border p-[14px]"
      style={{ borderColor: "var(--border)", background: card.is_active ? "var(--background-elevated)" : "var(--background-surface)" }}
    >
      <div className="flex items-start gap-[10px]">
        <button
          type="button"
          className="mt-[6px] cursor-grab touch-none text-[var(--foreground-30)] active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label={t("pages.adminLandingBlocks.dragAria")}
        >
          <GripVertical size={18} />
        </button>
        <IconBox size="md" variant="accent-soft" className="!h-[40px] !w-[40px]">
          <LandingCardIcon cardId={card.id} icon={card.icon} iconUrl={card.icon_url} fill />
        </IconBox>
        <div className="min-w-0 flex-1 grid gap-[8px]">
          <input value={card.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={t("pages.adminLandingBlocks.titlePlaceholder")} style={inputStyle} />
          <LandingCardIconField
            icon={card.icon}
            iconUrl={card.icon_url}
            onChange={(patch) => onChange({
              ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
              ...(patch.icon_url !== undefined ? { icon_url: patch.icon_url } : {}),
            })}
          />
          {showDescription && (
            <textarea value={card.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} placeholder={t("pages.adminLandingBlocks.descriptionPlaceholder")} style={textareaStyle} />
          )}
          <input value={card.link_url ?? ""} onChange={(e) => onChange({ link_url: e.target.value })} placeholder={t("pages.adminLandingBlocks.linkPlaceholder")} style={inputStyle} />
          {categories.length > 0 && (
            <select
              value={card.post_category_id ?? ""}
              onChange={(e) => onChange({ post_category_id: e.target.value ? +e.target.value : null })}
              style={inputStyle}
            >
              <option value="">{t("pages.adminLandingBlocks.noCategoryBinding")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" checked={card.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            {t("pages.adminLandingBlocks.showOnHomepage")}
          </label>
        </div>
        <div className="flex flex-col gap-[6px]">
          <button type="button" onClick={onSave} disabled={saving} style={primaryBtn}>{saving ? "…" : t("pages.adminCommon.save")}</button>
          <button type="button" onClick={onDelete} style={{ ...ghostBtn, color: "var(--destructive, #c0392b)" }} aria-label={t("pages.adminLandingBlocks.deleteAria")}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function SectionBlock({
  section,
  cards,
  onSectionChange,
  onSaveSection,
  onCardsChange,
  categories,
}: {
  section: AdminLandingSection;
  cards: AdminLandingCard[];
  onSectionChange: (patch: Partial<AdminLandingSection>) => void;
  onSaveSection: () => Promise<void>;
  onCardsChange: (next: AdminLandingCard[]) => void;
  categories: { id: number; name: string }[];
}) {
  const { t } = useTranslation();
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const showDescription = section.slug === "ecosystem";
  const orderedIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const sectionLabel = section.slug === "ecosystem"
    ? t("pages.adminLandingBlocks.sectionEcosystem")
    : section.slug === "directions"
      ? t("pages.adminLandingBlocks.sectionDirections")
      : section.slug;

  const patchCard = (id: number, patch: Partial<AdminLandingCard>) => {
    onCardsChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const saveCard = async (card: AdminLandingCard) => {
    setSavingId(card.id);
    try {
      const saved = await updateAdminLandingCard(card.id, {
        section_slug: card.section_slug,
        title: card.title,
        description: card.description,
        icon: card.icon,
        icon_url: card.icon_url,
        link_url: card.link_url,
        post_category_id: card.post_category_id,
        is_active: card.is_active,
      });
      onCardsChange(cards.map((c) => (c.id === card.id ? saved : c)));
      toast.success(t("pages.adminLandingBlocks.cardSaved"));
    } catch {
      toast.error(t("pages.adminLandingBlocks.cardSaveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const removeCard = async (id: number) => {
    if (!window.confirm(t("pages.adminLandingBlocks.deleteConfirm"))) return;
    try {
      await deleteAdminLandingCard(id);
      onCardsChange(cards.filter((c) => c.id !== id));
      toast.success(t("pages.adminLandingBlocks.cardDeleted"));
    } catch {
      toast.error(t("pages.adminCommon.deleteFailed"));
    }
  };

  const addCard = async () => {
    try {
      const created = await createAdminLandingCard({
        section_slug: section.slug,
        title: t("pages.adminLandingBlocks.newCardTitle"),
        description: showDescription ? "" : undefined,
        icon: "Box",
        link_url: "/",
        is_active: true,
      });
      onCardsChange([...cards, created]);
      toast.success(t("pages.adminLandingBlocks.cardAdded"));
    } catch {
      toast.error(t("pages.adminLandingBlocks.cardAddFailed"));
    }
  };

  const onReorder = async (nextIds: number[]) => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const next = nextIds.map((id, i) => ({ ...byId.get(id)!, sort_order: i }));
    onCardsChange(next);
    try {
      await reorderAdminLandingCards(section.slug, nextIds);
    } catch {
      toast.error(t("pages.adminLandingBlocks.reorderFailed"));
    }
  };

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>
        {sectionLabel}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminLandingBlocks.eyebrowLabel")}</span>
          <input value={section.eyebrow ?? ""} onChange={(e) => onSectionChange({ eyebrow: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminLandingBlocks.blockTitleLabel")}</span>
          <input value={section.title} onChange={(e) => onSectionChange({ title: e.target.value })} style={inputStyle} />
        </label>
        {showDescription && (
          <label className="md:col-span-2" style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminLandingBlocks.subtitleLabel")}</span>
            <textarea value={section.subtitle ?? ""} onChange={(e) => onSectionChange({ subtitle: e.target.value })} style={textareaStyle} />
          </label>
        )}
        <label className="flex items-center gap-[8px]" style={{ height: 40 }}>
          <input type="checkbox" checked={section.is_enabled} onChange={(e) => onSectionChange({ is_enabled: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
          <span style={{ fontSize: "13px" }}>{t("pages.adminLandingBlocks.blockEnabled")}</span>
        </label>
      </div>

      <button
        type="button"
        disabled={savingSection}
        onClick={async () => {
          setSavingSection(true);
          try {
            await onSaveSection();
            toast.success(t("pages.adminLandingBlocks.sectionHeadersSaved"));
          } catch {
            toast.error(t("pages.adminLandingBlocks.sectionSaveFailed"));
          } finally {
            setSavingSection(false);
          }
        }}
        style={{ ...primaryBtn, width: "fit-content" }}
      >
        {savingSection ? t("pages.adminLandingBlocks.saving") : t("pages.adminLandingBlocks.saveSectionHeaders")}
      </button>

      <div className="flex items-center justify-between gap-[8px]">
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminLandingBlocks.dragHint")}</p>
        <button type="button" onClick={addCard} style={ghostBtn}><Plus size={14} className="inline mr-1" /> {t("pages.adminCommon.add")}</button>
      </div>

      <Reorder.Group axis="y" values={orderedIds} onReorder={onReorder} className="flex flex-col gap-[10px]">
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            onChange={(patch) => patchCard(card.id, patch)}
            onSave={() => saveCard(card)}
            onDelete={() => removeCard(card.id)}
            saving={savingId === card.id}
            showDescription={showDescription}
            categories={section.slug === "directions" ? categories : []}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

export function LandingBlocksAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<AdminLandingSection[]>([]);
  const [cards, setCards] = useState<AdminLandingCard[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () =>
    fetchAdminLandingBlocks().then(({ sections: s, cards: c }) => {
      setSections(s);
      setCards(c);
    });

  useEffect(() => {
    Promise.all([reload(), fetchPostCategories()])
      .then(([, cats]) => setCategories(cats.map((c) => ({ id: +c.id, name: c.name }))))
      .catch(() => toast.error(t("pages.adminLandingBlocks.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const cardsFor = (slug: string) =>
    cards.filter((c) => c.section_slug === slug).sort((a, b) => a.sort_order - b.sort_order);

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: "24px" }}>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {sections.map((section) => (
        <div key={section.slug} style={{ ...cardStyle, padding: "24px" }}>
          <SectionBlock
            section={section}
            cards={cardsFor(section.slug)}
            onSectionChange={(patch) => setSections((prev) => prev.map((s) => (s.slug === section.slug ? { ...s, ...patch } : s)))}
            onSaveSection={() =>
              updateAdminLandingSection(section.slug, {
                eyebrow: section.eyebrow,
                title: section.title,
                subtitle: section.subtitle,
                is_enabled: section.is_enabled,
              })
            }
            onCardsChange={(nextSectionCards) => {
              setCards((prev) => [
                ...prev.filter((c) => c.section_slug !== section.slug),
                ...nextSectionCards,
              ]);
            }}
            categories={categories}
          />
        </div>
      ))}
    </div>
  );
}
