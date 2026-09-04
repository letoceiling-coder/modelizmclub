import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  type AdminCategory,
  type CategoryKind,
} from "@/lib/api/admin";
import { H, card, inputStyle, primaryBtn, IconBtn } from "@/components/admin/adminShared";

const CATEGORY_KIND_IDS: CategoryKind[] = ["post", "community", "listing", "video"];

// Простой транслит для генерации slug из кириллического названия.
function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const s = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `cat-${Date.now()}`;
}

export function CategoriesSection() {
  const { t } = useTranslation();
  const categoryKinds = useMemo(
    () => CATEGORY_KIND_IDS.map((id) => ({ id, label: t(`pages.adminCategories.kinds.${id}`) })),
    [t],
  );
  const [kind, setKind] = useState<CategoryKind>("post");
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const load = (k: CategoryKind) => {
    setLoading(true);
    fetchAdminCategories(k)
      .then(setItems)
      .catch(() => toast.error(t("pages.adminCategories.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(kind);
  }, [kind]);

  const roots = useMemo(
    () => (kind === "video" ? items : items.filter((c) => c.parentId === null)),
    [items, kind],
  );
  const childrenOf = (id: number) => items.filter((c) => c.parentId === id);
  const depthOf = (id: number) => {
    let depth = 0;
    let cur = items.find((x) => x.id === id);
    const seen = new Set<number>();
    while (cur?.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      depth += 1;
      cur = items.find((x) => x.id === cur!.parentId);
    }
    return depth;
  };

  const addRoot = async () => {
    const name = window.prompt(t("pages.adminCategories.promptName"))?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptSlug"), slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, { name, slug, sortOrder: roots.length });
      setItems((p) => [...p, created]);
      toast.success(t("pages.adminCategories.added"));
    } catch {
      toast.error(t("pages.adminCategories.addFailed"));
    }
  };

  const addSub = async (parent: AdminCategory) => {
    if (depthOf(parent.id) >= 2) {
      toast.error(t("pages.adminCategories.parentInvalid"));
      return;
    }
    const name = window
      .prompt(t("pages.adminCategories.promptSubName", { name: parent.name }))
      ?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptSlug"), slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, {
        name,
        slug,
        parentId: parent.id,
        sortOrder: childrenOf(parent.id).length,
      });
      setItems((p) => [...p, created]);
      setOpen((p) => ({ ...p, [parent.id]: true }));
      toast.success(t("pages.adminCategories.subAdded"));
    } catch {
      toast.error(t("pages.adminCategories.subAddFailed"));
    }
  };

  const edit = async (c: AdminCategory) => {
    const name = window.prompt(t("pages.adminCategories.promptEditName"), c.name)?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptEditSlug"), c.slug)?.trim();
    if (!slug) return;
    const icon = window.prompt(t("pages.adminCategories.promptIcon"), c.icon ?? "") ?? c.icon;
    const sortRaw = window.prompt(t("pages.adminCategories.promptSort"), String(c.sortOrder));
    const sortOrder = sortRaw != null && sortRaw !== "" ? Number(sortRaw) : c.sortOrder;
    const parentRaw = window.prompt(
      t("pages.adminCategories.promptParent"),
      c.parentId != null ? String(c.parentId) : "",
    );
    let parentId = c.parentId;
    if (parentRaw !== null) {
      const trimmed = parentRaw.trim();
      parentId = trimmed === "" ? null : Number(trimmed);
      if (parentId != null && (!Number.isInteger(parentId) || parentId < 1 || parentId === c.id)) {
        toast.error(t("pages.adminCategories.parentInvalid"));
        return;
      }
    }
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name,
        slug,
        parentId,
        icon: icon || null,
        sortOrder,
        isActive: c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCommon.saved"));
    } catch {
      toast.error(t("pages.adminCategories.updateFailed"));
    }
  };

  const toggleActive = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: !c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCommon.saved"));
    } catch {
      toast.error(t("pages.adminCategories.updateFailed"));
    }
  };

  const patchCategoryPrices = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCategories.pricesSaved"));
    } catch {
      toast.error(t("pages.adminCategories.pricesSaveFailed"));
    }
  };

  const listingPriceFields = (c: AdminCategory) => {
    if (kind !== "listing") return null;
    return (
      <div className="flex flex-wrap items-center gap-[6px] ml-[24px] mt-[4px] mb-[6px]">
        <label
          className="flex items-center gap-[4px] text-[11px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {t("pages.adminCategories.priceRegular")}
          <input
            type="number"
            min={0}
            placeholder="—"
            style={{ ...inputStyle, width: 72, height: 30, padding: "0 8px", fontSize: 12 }}
            value={c.listingPriceCents != null ? Math.round(c.listingPriceCents / 100) : ""}
            onChange={(e) => {
              const rub = e.target.value === "" ? null : Math.max(0, +e.target.value);
              setItems((p) =>
                p.map((x) =>
                  x.id === c.id ? { ...x, listingPriceCents: rub == null ? null : rub * 100 } : x,
                ),
              );
            }}
            onBlur={() => patchCategoryPrices(c)}
          />
        </label>
        <label
          className="flex items-center gap-[4px] text-[11px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {t("pages.adminCategories.priceSubscriber")}
          <input
            type="number"
            min={0}
            placeholder="—"
            style={{ ...inputStyle, width: 72, height: 30, padding: "0 8px", fontSize: 12 }}
            value={
              c.subscriberListingPriceCents != null
                ? Math.round(c.subscriberListingPriceCents / 100)
                : ""
            }
            onChange={(e) => {
              const rub = e.target.value === "" ? null : Math.max(0, +e.target.value);
              setItems((p) =>
                p.map((x) =>
                  x.id === c.id
                    ? { ...x, subscriberListingPriceCents: rub == null ? null : rub * 100 }
                    : x,
                ),
              );
            }}
            onBlur={() => patchCategoryPrices(c)}
          />
        </label>
      </div>
    );
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(t("pages.adminCategories.deleteConfirm", { name: c.name }))) return;
    try {
      await deleteAdminCategory(kind, c.id);
      const drop = new Set<number>([c.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const x of items) {
          if (x.parentId && drop.has(x.parentId) && !drop.has(x.id)) {
            drop.add(x.id);
            grew = true;
          }
        }
      }
      setItems((p) => p.filter((x) => !drop.has(x.id)));
      toast.success(t("pages.adminCommon.deleted"));
    } catch {
      toast.error(t("pages.adminCategories.deleteFailed"));
    }
  };

  return (
    <div>
      <H
        action={
          <button style={{ ...primaryBtn }} onClick={addRoot}>
            <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />
            {t("pages.adminCommon.add")}
          </button>
        }
      >
        {t("pages.adminCategories.title")}
      </H>

      {kind === "post" && (
        <p className="text-[13px]" style={{ color: "var(--foreground-50)", marginBottom: 12 }}>
          {t("pages.adminCategories.unifiedHint")}
        </p>
      )}

      <div className="flex gap-[6px]" style={{ marginBottom: "12px" }}>
        {categoryKinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: kind === k.id ? 600 : 500,
              borderRadius: "var(--r-pill)",
              border: `1px solid ${kind === k.id ? "var(--border-accent)" : "var(--border)"}`,
              background: kind === k.id ? "var(--accent-soft)" : "transparent",
              color: kind === k.id ? "var(--accent)" : "var(--foreground-70)",
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: "16px" }}>
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCommon.loading")}
          </p>
        ) : roots.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCategories.empty")}
          </p>
        ) : kind === "video" ? (
          roots.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between"
              style={{ padding: "8px 0" }}
            >
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>
                {c.name}
              </span>
              <div className="flex gap-[4px]">
                <IconBtn onClick={() => edit(c)}>
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn danger onClick={() => remove(c)}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
          ))
        ) : (
          roots.map((c) => {
            const subs = childrenOf(c.id);
            return (
              <div key={c.id} style={{ marginBottom: "4px" }}>
                <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}
                    className="flex items-center gap-[8px] flex-1"
                  >
                    <motion.span
                      animate={{ rotate: open[c.id] ? 90 : 0 }}
                      style={{
                        display: "inline-block",
                        color: "var(--foreground-50)",
                        fontSize: "10px",
                      }}
                    >
                      ▶
                    </motion.span>
                    <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>
                      {c.name}
                    </span>
                    {!c.isActive && (
                      <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                        {t("pages.adminCategories.hidden")}
                      </span>
                    )}
                    {subs.length > 0 && (
                      <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
                        ({subs.length})
                      </span>
                    )}
                  </button>
                  <div className="flex gap-[4px]">
                    <IconBtn onClick={() => addSub(c)}>
                      <Plus size={14} />
                    </IconBtn>
                    <IconBtn onClick={() => void toggleActive(c)}>
                      {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    </IconBtn>
                    <IconBtn onClick={() => edit(c)}>
                      <Pencil size={14} />
                    </IconBtn>
                    <IconBtn danger onClick={() => remove(c)}>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </div>
                {listingPriceFields(c)}
                <AnimatePresence>
                  {open[c.id] && subs.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{
                        overflow: "hidden",
                        borderLeft: "1px solid var(--border)",
                        marginLeft: "8px",
                        paddingLeft: "16px",
                      }}
                    >
                      {subs.map((s) => {
                        const thirds = childrenOf(s.id);
                        return (
                          <div key={s.id}>
                            <div
                              className="flex items-center justify-between"
                              style={{ padding: "6px 0" }}
                            >
                              <span
                                className="flex items-center gap-[8px]"
                                style={{ fontSize: "14px", color: "var(--foreground-70)" }}
                              >
                                {s.name}
                                {!s.isActive && (
                                  <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                                    {t("pages.adminCategories.hidden")}
                                  </span>
                                )}
                                {thirds.length > 0 && (
                                  <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
                                    ({thirds.length})
                                  </span>
                                )}
                              </span>
                              <div className="flex gap-[4px]">
                                {depthOf(s.id) < 2 && (
                                  <IconBtn onClick={() => addSub(s)}>
                                    <Plus size={14} />
                                  </IconBtn>
                                )}
                                <IconBtn onClick={() => void toggleActive(s)}>
                                  {s.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                </IconBtn>
                                <IconBtn onClick={() => edit(s)}>
                                  <Pencil size={14} />
                                </IconBtn>
                                <IconBtn danger onClick={() => remove(s)}>
                                  <Trash2 size={14} />
                                </IconBtn>
                              </div>
                            </div>
                            {listingPriceFields(s)}
                            {thirds.map((n) => (
                              <div
                                key={n.id}
                                style={{
                                  borderLeft: "1px solid var(--border)",
                                  marginLeft: "8px",
                                  paddingLeft: "16px",
                                }}
                              >
                                <div
                                  className="flex items-center justify-between"
                                  style={{ padding: "4px 0" }}
                                >
                                  <span
                                    className="flex items-center gap-[8px]"
                                    style={{ fontSize: "13px", color: "var(--foreground-50)" }}
                                  >
                                    {n.name}
                                    {!n.isActive && (
                                      <span style={{ fontSize: "11px" }}>
                                        {t("pages.adminCategories.hidden")}
                                      </span>
                                    )}
                                  </span>
                                  <div className="flex gap-[4px]">
                                    <IconBtn onClick={() => void toggleActive(n)}>
                                      {n.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </IconBtn>
                                    <IconBtn onClick={() => edit(n)}>
                                      <Pencil size={14} />
                                    </IconBtn>
                                    <IconBtn danger onClick={() => remove(n)}>
                                      <Trash2 size={14} />
                                    </IconBtn>
                                  </div>
                                </div>
                                {listingPriceFields(n)}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
