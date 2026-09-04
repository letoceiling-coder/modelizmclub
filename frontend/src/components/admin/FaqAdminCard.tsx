import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import {
  adminCreateFaqArticle,
  adminCreateFaqCategory,
  adminDeleteFaqArticle,
  adminDeleteFaqCategory,
  adminFetchFaq,
  adminReorderFaqArticles,
  adminUpdateFaqArticle,
  adminUpdateFaqCategory,
  type AdminFaqArticle,
  type AdminFaqCategory,
} from "@/lib/api/faq";

const LANDING_SLUG = "landing";

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
  minHeight: "72px",
  padding: "10px 14px",
  resize: "vertical",
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

function ArticleEditor({
  article,
  onChange,
  onSave,
  onDelete,
  onMove,
  saving,
}: {
  article: AdminFaqArticle;
  onChange: (patch: Partial<AdminFaqArticle>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card-sm)",
        padding: "12px",
        display: "grid",
        gap: "8px",
      }}
    >
      <input
        value={article.question}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder={t("pages.adminFaq.questionPlaceholder")}
        style={inputStyle}
      />
      <textarea
        value={article.answer}
        onChange={(e) => onChange({ answer: e.target.value })}
        placeholder={t("pages.adminFaq.answerPlaceholder")}
        style={textareaStyle}
      />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: "var(--foreground-70)",
        }}
      >
        <input
          type="checkbox"
          checked={article.is_active}
          onChange={(e) => onChange({ is_active: e.target.checked })}
        />
        {t("pages.adminFaq.visibleOnSite")}
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" style={ghostBtn} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" style={ghostBtn} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={onSave}>
          {saving ? "…" : t("pages.adminCommon.save")}
        </button>
        <button
          type="button"
          style={{ ...ghostBtn, color: "var(--destructive)" }}
          onClick={onDelete}
          aria-label={t("pages.adminFaq.deleteQuestion")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function CategoryBlock({
  category,
  cardStyle,
  highlight,
  onReload,
}: {
  category: AdminFaqCategory;
  cardStyle: CSSProperties;
  highlight?: boolean;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(category);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    setLocal(category);
  }, [category]);

  const saveCategory = async () => {
    setSavingCat(true);
    try {
      await adminUpdateFaqCategory(local.id, {
        name: local.name,
        slug: local.slug,
        sort_order: local.sort_order,
        is_active: local.is_active,
      });
      toast.success(t("pages.adminFaq.categorySaved"));
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.saveFailed")));
    } finally {
      setSavingCat(false);
    }
  };

  const saveArticle = async (article: AdminFaqArticle) => {
    setSavingId(article.id);
    try {
      await adminUpdateFaqArticle(article.id, {
        category_id: article.category_id,
        question: article.question,
        answer: article.answer,
        sort_order: article.sort_order,
        is_active: article.is_active,
      });
      toast.success(t("pages.adminFaq.questionSaved"));
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.saveFailed")));
    } finally {
      setSavingId(null);
    }
  };

  const addArticle = async () => {
    try {
      const maxSort = local.articles.reduce((m, a) => Math.max(m, a.sort_order), 0);
      await adminCreateFaqArticle({
        category_id: local.id,
        question: t("pages.adminFaq.newQuestion"),
        answer: "",
        sort_order: maxSort + 10,
        is_active: true,
      });
      toast.success(t("pages.adminFaq.questionAdded"));
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.addFailed")));
    }
  };

  const deleteArticle = async (id: number) => {
    if (!window.confirm(t("pages.adminFaq.deleteQuestionConfirm"))) return;
    try {
      await adminDeleteFaqArticle(id);
      toast.success(t("pages.adminFaq.questionDeleted"));
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.deleteFailed")));
    }
  };

  const moveArticle = async (id: number, dir: -1 | 1) => {
    const sorted = [...local.articles].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((a) => a.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    try {
      await adminReorderFaqArticles([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ]);
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.reorderFailed")));
    }
  };

  const deleteCategory = async () => {
    if (!window.confirm(t("pages.adminFaq.deleteCategoryConfirm"))) return;
    try {
      await adminDeleteFaqCategory(local.id);
      toast.success(t("pages.adminFaq.categoryDeleted"));
      await onReload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.deleteFailed")));
    }
  };

  return (
    <div
      style={{
        ...cardStyle,
        padding: "20px",
        marginBottom: "16px",
        border: highlight ? "1px solid var(--accent)" : cardStyle.border,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ flex: 1, minWidth: 220, display: "grid", gap: "8px" }}>
          <input
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            style={inputStyle}
          />
          <input
            value={local.slug}
            onChange={(e) =>
              setLocal({ ...local, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "12px" }}
            placeholder="slug"
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--foreground-70)",
            }}
          >
            <input
              type="checkbox"
              checked={local.is_active}
              onChange={(e) => setLocal({ ...local, is_active: e.target.checked })}
            />
            {t("pages.adminFaq.categoryVisible")}
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            style={primaryBtn}
            disabled={savingCat}
            onClick={() => void saveCategory()}
          >
            {savingCat ? "…" : t("pages.adminCommon.save")}
          </button>
          {!highlight && (
            <button
              type="button"
              style={{ ...ghostBtn, color: "var(--destructive)" }}
              onClick={() => void deleteCategory()}
            >
              {t("pages.adminFaq.deleteCategory")}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
        {[...local.articles]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((article) => (
            <ArticleEditor
              key={article.id}
              article={article}
              saving={savingId === article.id}
              onChange={(patch) =>
                setLocal({
                  ...local,
                  articles: local.articles.map((a) =>
                    a.id === article.id ? { ...a, ...patch } : a,
                  ),
                })
              }
              onSave={() => {
                const current = local.articles.find((a) => a.id === article.id);
                if (current) void saveArticle(current);
              }}
              onDelete={() => void deleteArticle(article.id)}
              onMove={(dir) => void moveArticle(article.id, dir)}
            />
          ))}
      </div>

      <button
        type="button"
        style={{
          ...ghostBtn,
          marginTop: "12px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
        onClick={() => void addArticle()}
      >
        <Plus size={14} /> {t("pages.adminFaq.addQuestion")}
      </button>
    </div>
  );
}

export function FaqAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<AdminFaqCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await adminFetchFaq();
    setCategories(data);
  }, []);

  useEffect(() => {
    let active = true;
    adminFetchFaq()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => toast.error(t("pages.adminFaq.loadFailed")))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const ensureLandingCategory = async () => {
    try {
      await adminCreateFaqCategory({
        name: t("pages.adminFaq.landingCategoryName"),
        slug: LANDING_SLUG,
        sort_order: 5,
        is_active: true,
      });
      toast.success(t("pages.adminFaq.landingCategoryCreated"));
      await reload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.addFailed")));
    }
  };

  const addHelpCategory = async () => {
    try {
      const maxSort = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
      await adminCreateFaqCategory({
        name: t("pages.adminFaq.newCategoryName"),
        slug: `faq-${Date.now()}`,
        sort_order: maxSort + 10,
        is_active: true,
      });
      toast.success(t("pages.adminFaq.categoryAdded"));
      await reload();
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminFaq.addFailed")));
    }
  };

  if (loading)
    return (
      <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
        {t("pages.adminCommon.loading")}
      </p>
    );

  const landing = categories.find((c) => c.slug === LANDING_SLUG);
  const helpCategories = categories.filter((c) => c.slug !== LANDING_SLUG);

  return (
    <div style={{ marginTop: "24px" }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--foreground)",
        }}
      >
        {t("pages.adminFaq.landingTitle")}
      </h4>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "6px" }}>
        {t("pages.adminFaq.landingHint")}
      </p>

      {landing ? (
        <CategoryBlock category={landing} cardStyle={cardStyle} highlight onReload={reload} />
      ) : (
        <div style={{ ...cardStyle, padding: "20px", marginTop: "12px" }}>
          <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "12px" }}>
            {t("pages.adminFaq.landingMissing")}
          </p>
          <button type="button" style={primaryBtn} onClick={() => void ensureLandingCategory()}>
            {t("pages.adminFaq.createLandingCategory")}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between" style={{ marginTop: "8px" }}>
        <div>
          <h4
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "16px",
              color: "var(--foreground)",
            }}
          >
            {t("pages.adminFaq.helpTitle")}
          </h4>
          <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "6px" }}>
            {t("pages.adminFaq.helpHint")}
          </p>
        </div>
        <button type="button" style={ghostBtn} onClick={() => void addHelpCategory()}>
          <Plus size={14} className="inline mr-1" /> {t("pages.adminFaq.addCategory")}
        </button>
      </div>

      {helpCategories.map((cat) => (
        <CategoryBlock key={cat.id} category={cat} cardStyle={cardStyle} onReload={reload} />
      ))}
    </div>
  );
}
