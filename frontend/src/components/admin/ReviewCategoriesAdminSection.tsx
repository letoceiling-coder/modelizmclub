import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  reorderAdminVideoCategories,
  updateAdminCategory,
  type AdminCategory,
} from "@/lib/api/admin";

const card: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
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

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return s || `cat-${Date.now()}`;
}

function CategoryRow({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  saving,
}: {
  item: AdminCategory;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const dragControls = useDragControls();
  const count = item.videosCount ?? 0;

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-[10px] rounded-[12px] border px-[14px] py-[12px]"
      style={{
        borderColor: "var(--border)",
        background: item.isActive ? "var(--background-elevated)" : "var(--background-surface)",
        opacity: saving ? 0.7 : 1,
      }}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-[var(--foreground-30)] active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
        aria-label={t("pages.adminReviewCategories.dragAria")}
      >
        <GripVertical size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>
            {item.name}
          </span>
          {!item.isActive && (
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
              {t("pages.adminReviewCategories.hidden")}
            </span>
          )}
        </div>
        <p style={{ marginTop: "2px", fontSize: "12px", color: "var(--foreground-50)" }}>
          {t("pages.adminReviewCategories.reviewsCount", { count })}
        </p>
      </div>

      <label
        className="flex shrink-0 items-center gap-[6px] cursor-pointer"
        title={t("pages.adminReviewCategories.visibilityToggle")}
      >
        <input
          type="checkbox"
          checked={item.isActive}
          disabled={saving}
          onChange={(e) => onToggleActive(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
        />
        <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
          {t("pages.adminReviewCategories.visible")}
        </span>
      </label>

      <button
        type="button"
        onClick={onEdit}
        disabled={saving}
        className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--background-surface)]"
        style={{ color: "var(--foreground-70)" }}
        aria-label={t("pages.adminReviewCategories.edit")}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={saving}
        className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--background-surface)]"
        style={{ color: "var(--error)" }}
        aria-label={t("pages.adminReviewCategories.delete")}
      >
        <Trash2 size={14} />
      </button>
    </Reorder.Item>
  );
}

export function ReviewCategoriesAdminSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminCategories("video")
      .then((rows) => setItems([...rows].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => toast.error(t("pages.adminReviewCategories.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const name = window.prompt(t("pages.adminReviewCategories.promptName"))?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminReviewCategories.promptSlug"), slugify(name))?.trim();
    if (!slug) return;
    setSaving(true);
    try {
      const created = await createAdminCategory("video", {
        name,
        slug,
        sortOrder: (items.length + 1) * 10,
        isActive: true,
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      toast.success(t("pages.adminReviewCategories.added"));
    } catch {
      toast.error(t("pages.adminReviewCategories.addFailed"));
    } finally {
      setSaving(false);
    }
  };

  const edit = async (c: AdminCategory) => {
    const name = window.prompt(t("pages.adminReviewCategories.promptEditName"), c.name)?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminReviewCategories.promptEditSlug"), c.slug)?.trim();
    if (!slug) return;
    setSaving(true);
    try {
      const updated = await updateAdminCategory("video", c.id, {
        name,
        slug,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      });
      setItems((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminReviewCategories.saved"));
    } catch {
      toast.error(t("pages.adminReviewCategories.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(t("pages.adminReviewCategories.deleteConfirm", { name: c.name }))) return;
    setSaving(true);
    try {
      await deleteAdminCategory("video", c.id);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
      toast.success(t("pages.adminReviewCategories.deleted"));
    } catch {
      toast.error(t("pages.adminReviewCategories.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: AdminCategory, active: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: active } : x)));
    setSaving(true);
    try {
      const updated = await updateAdminCategory("video", c.id, {
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
        isActive: active,
      });
      setItems((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      toast.success(
        active
          ? t("pages.adminReviewCategories.enabled")
          : t("pages.adminReviewCategories.disabled"),
      );
    } catch {
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: !active } : x)));
      toast.error(t("pages.adminReviewCategories.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onReorder = async (nextIds: number[]) => {
    const byId = new Map(items.map((c) => [c.id, c]));
    const next = nextIds.map((id) => byId.get(id)).filter(Boolean) as AdminCategory[];
    setItems(next);
    setSaving(true);
    try {
      await reorderAdminVideoCategories(nextIds);
    } catch {
      toast.error(t("pages.adminReviewCategories.reorderFailed"));
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        style={{ marginBottom: "16px" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            {t("pages.adminReviewCategories.title")}
          </h1>
          <p
            style={{
              marginTop: "6px",
              fontSize: "13px",
              color: "var(--foreground-50)",
              maxWidth: "560px",
            }}
          >
            {t("pages.adminReviewCategories.subtitle")}
          </p>
        </div>
        <button
          type="button"
          style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: "6px" }}
          onClick={() => void add()}
          disabled={saving}
        >
          <Plus size={14} /> {t("pages.adminReviewCategories.add")}
        </button>
      </div>

      <div style={{ ...card, padding: "16px" }}>
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCommon.loading")}
          </p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminReviewCategories.empty")}
          </p>
        ) : (
          <>
            <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "12px" }}>
              {t("pages.adminReviewCategories.dragHint")}
            </p>
            <Reorder.Group
              axis="y"
              values={items.map((c) => c.id)}
              onReorder={(ids) => void onReorder(ids as number[])}
              className="grid gap-[8px]"
            >
              {items.map((c) => (
                <CategoryRow
                  key={c.id}
                  item={c}
                  saving={saving}
                  onEdit={() => void edit(c)}
                  onDelete={() => void remove(c)}
                  onToggleActive={(active) => void toggleActive(c, active)}
                />
              ))}
            </Reorder.Group>
          </>
        )}
      </div>
    </div>
  );
}
