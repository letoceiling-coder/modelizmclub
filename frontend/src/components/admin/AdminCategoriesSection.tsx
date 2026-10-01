import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, m } from "framer-motion";
import { Plus, Eye, EyeOff, Pencil, Trash2, ChevronUp, ChevronDown, UserCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  fetchAdminCategories,
  fetchCategorySortMode,
  setCategorySortMode,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  reorderAdminPostCategories,
  type AdminCategory,
  type CategoryKind,
  type CategorySortMode,
  type UpsertCategoryInput,
} from "@/lib/api/admin";
import { H, card, inputStyle, primaryBtn, IconBtn } from "@/components/admin/adminShared";
import { askChoice, askConfirm, askText } from "@/lib/ui/ask";
import { askRequiredField } from "@/lib/ui/prompt-field";
import { reportActionFailure } from "@/lib/errors/handle";
import {
  byOrder,
  canMove as canMoveIn,
  childrenOf as childrenIn,
  depthOf as depthIn,
  parentOptions,
  reordered,
  sortOrderAt,
} from "@/lib/category-tree";
import { useAdminAccess } from "@/lib/admin-access";

/*
 * Две вкладки, а не четыре. Деревья объявлений и сообществ строятся из
 * дерева направлений и напрямую не правятся (сервер отвечает 422): их
 * отдельная правка и развела списки формы подачи, каталога и сообществ
 * (разбор 17.09). Где виден раздел — флаги в строке направления, там же
 * цена размещения.
 */
const CATEGORY_KIND_IDS: CategoryKind[] = ["post", "video"];

const FLAG_KEYS = [
  { key: "inFeed", labelKey: "pages.adminCategories.flagFeed" },
  { key: "inListings", labelKey: "pages.adminCategories.flagListings" },
  { key: "inCommunities", labelKey: "pages.adminCategories.flagCommunities" },
] as const;

/** Насколько узел уровня N сдвинут вправо и каким кеглем набран. */
const УРОВНИ = [
  { шрифт: 15, вес: 600, цвет: "var(--foreground)", отступ: "8px 0" },
  { шрифт: 14, вес: 500, цвет: "var(--foreground-70)", отступ: "6px 0" },
  { шрифт: 13, вес: 400, цвет: "var(--foreground-50)", отступ: "4px 0" },
] as const;

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
  const isOwner = useAdminAccess()?.isOwner ?? false;
  const categoryKinds = useMemo(
    () => CATEGORY_KIND_IDS.map((id) => ({ id, label: t(`pages.adminCategories.kinds.${id}`) })),
    [t],
  );
  const [kind, setKind] = useState<CategoryKind>("post");
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  /* Пока ряд сохраняется, стрелки выключены — см. объяснение у `move`. */
  const [переставляем, setПереставляем] = useState(false);
  /*
   * Режим порядка спрашивается у сервера, а не берётся из умолчания.
   * Пока ответа нет — `null`, и дерево не рисуется: нарисовать его по
   * догадке значило бы показать порядок, которого на сайте нет, и
   * переставить строки под человеком через полсекунды.
   */
  const [режим, setРежим] = useState<CategorySortMode | null>(null);

  const load = useCallback(
    (k: CategoryKind) => {
      setLoading(true);
      return fetchAdminCategories(k)
        .then(setItems)
        .catch(() => toast.error(t("pages.adminCategories.loadFailed")))
        .finally(() => setLoading(false));
    },
    [t],
  );

  useEffect(() => {
    fetchCategorySortMode()
      .then(setРежим)
      // Умолчание сервера — алфавит; молча остаться без дерева хуже, чем
      // показать его так, как сервер его и отдал.
      .catch(() => setРежим("alpha"));
  }, []);

  useEffect(() => {
    void load(kind);
  }, [kind, load]);

  const алфавит = режим === "alpha";

  /*
   * Порядок на экране: при ручном считаем сами (после перестановки список
   * не перечитывается), при алфавите — тот, в котором пришло с сервера.
   * Почему не сортируем сами при алфавите — в `category-tree.ts`.
   */
  const roots = useMemo(
    () =>
      kind === "video"
        ? алфавит
          ? items
          : [...items].sort(byOrder)
        : childrenIn(items, null, алфавит ? "alpha" : "manual"),
    [items, kind, алфавит],
  );
  const childrenOf = useCallback(
    (id: number) => childrenIn(items, id, алфавит ? "alpha" : "manual"),
    [items, алфавит],
  );
  const depthOf = (id: number) => depthIn(items, id);

  /**
   * После правки, меняющей место узла, список перечитывается.
   *
   * При алфавите место считает сервер: новая категория должна встать
   * между соседями сразу, а переименованная — переехать. Подставить
   * ответ сервера в прежнюю позицию списка значило бы оставить узел там,
   * где его больше нет, до перезагрузки страницы.
   *
   * При ручном порядке перечитывать нечего: номер известен, и список
   * пересортируется сам.
   */
  const переставитьЕслиАлфавит = () => (алфавит ? load(kind) : Promise.resolve());

  const переключить = async (next: CategorySortMode) => {
    if (next === режим) return;
    const было = режим;
    setРежим(next);
    try {
      setРежим(await setCategorySortMode(next));
      await load(kind);
      toast.success(t("pages.adminCategories.sortModeSaved"));
    } catch (e) {
      setРежим(было);
      reportActionFailure(e, t("pages.adminCategories.sortModeFailed"));
    }
  };

  const addRoot = async () => {
    const name = (await askText({ title: t("pages.adminCategories.promptName") }))?.trim();
    if (!name) return;
    const slug = (
      await askText({ title: t("pages.adminCategories.promptSlug"), defaultValue: slugify(name) })
    )?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, {
        name,
        slug,
        /*
         * Номер проставляется и при алфавите, хотя на порядок он тогда
         * не влияет. Без него новая категория получила бы ноль и при
         * переключении на ручной порядок прыгнула бы в начало ряда —
         * туда, куда её никто не ставил.
         */
        sortOrder: sortOrderAt(roots.length),
      });
      setItems((p) => [...p, created]);
      await переставитьЕслиАлфавит();
      toast.success(t("pages.adminCategories.added"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.addFailed"));
    }
  };

  const canMove = (c: AdminCategory, delta: -1 | 1) => canMoveIn(items, c, delta);

  /** Список родителей с «верхним уровнем» первым пунктом. */
  const родители = (c: AdminCategory) => [
    { value: "", label: t("pages.adminCategories.parentNone") },
    ...parentOptions(items, c),
  ];

  /**
   * Узел целиком — для PATCH.
   *
   * Запрос не частичный: `categoryBody` подставляет пустые значения всему,
   * чего в нём нет, и правка одного поля стёрла бы остальные. Поэтому
   * меняем поверх полного состава, а не вместо него.
   */
  const bodyOf = (c: AdminCategory): UpsertCategoryInput => ({
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    icon: c.icon,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    listingPriceCents: c.listingPriceCents,
    subscriberListingPriceCents: c.subscriberListingPriceCents,
    inFeed: c.inFeed,
    inListings: c.inListings,
    inCommunities: c.inCommunities,
  });

  /**
   * Поменять узел местами с соседом.
   *
   * Ряд уходит целиком одной ручкой перестановки, а не рядом обычных
   * сохранений узла: каждое такое сохранение тянет за собой перестройку
   * всего поддерева, сброс кеша каталога и отдельную строку аудита — на
   * ряду из десяти направлений это десять перестроек там, где человек
   * сделал одно движение.
   *
   * На время запроса кнопки выключены. Иначе второй клик считал бы новый
   * порядок от ряда, который ещё переставляется, и два ответа легли бы
   * друг на друга — на экране оказался бы порядок, которого нет в базе.
   */
  const move = async (c: AdminCategory, delta: -1 | 1) => {
    const ряд = reordered(items, c, delta);
    if (ряд.length === 0 || переставляем) return;

    setПереставляем(true);
    try {
      await reorderAdminPostCategories(ряд.map((x) => x.id));
      const порядок = new Map(ряд.map((x, i) => [x.id, sortOrderAt(i)]));
      setItems((prev) =>
        prev.map((x) => (порядок.has(x.id) ? { ...x, sortOrder: порядок.get(x.id)! } : x)),
      );
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.moveFailed"));
      void load(kind);
    } finally {
      setПереставляем(false);
    }
  };

  const addSub = async (parent: AdminCategory) => {
    if (depthOf(parent.id) >= 2) {
      toast.error(t("pages.adminCategories.parentInvalid"));
      return;
    }
    // Своим диалогом, как название и адрес раздела верхнего уровня: системное
    // окно браузера выбивалось из админки и глушится встроенными браузерами.
    const name = (
      await askText({ title: t("pages.adminCategories.promptSubName", { name: parent.name }) })
    )?.trim();
    if (!name) return;
    const slug = (
      await askText({ title: t("pages.adminCategories.promptSlug"), defaultValue: slugify(name) })
    )?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, {
        name,
        slug,
        parentId: parent.id,
        sortOrder: sortOrderAt(childrenOf(parent.id).length),
      });
      setItems((p) => [...p, created]);
      setOpen((p) => ({ ...p, [parent.id]: true }));
      await переставитьЕслиАлфавит();
      toast.success(t("pages.adminCategories.subAdded"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.subAddFailed"));
    }
  };

  const edit = async (c: AdminCategory) => {
    // Отказ здесь — «не меняю», как у иконки, порядка и родителя ниже.
    const name = await askRequiredField({
      title: t("pages.adminCategories.promptEditName"),
      current: c.name,
      emptyMessage: t("pages.adminCategories.nameRequired"),
    });
    if (name === null) return;
    const slug = await askRequiredField({
      title: t("pages.adminCategories.promptEditSlug"),
      current: c.slug,
      emptyMessage: t("pages.adminCategories.slugRequired"),
    });
    if (slug === null) return;
    const icon =
      (await askText({
        title: t("pages.adminCategories.promptIcon"),
        defaultValue: c.icon ?? "",
      })) ?? c.icon;
    /*
     * Про номер порядка при алфавите не спрашиваем: он ни на что не
     * влияет, а вопрос выглядит как обещание, что влияет.
     */
    let sortOrder = c.sortOrder;
    if (!алфавит) {
      const sortRaw = await askText({
        title: t("pages.adminCategories.promptSort"),
        defaultValue: String(c.sortOrder),
      });
      sortOrder = sortRaw != null && sortRaw !== "" ? Number(sortRaw) : c.sortOrder;
    }
    // Список видео плоский: вкладка рисует его одним уровнем, и родитель,
    // выбранный здесь, на экране всё равно нигде не проявится.
    let parentId = c.parentId;
    if (kind !== "video") {
      const выбор = await askChoice({
        title: t("pages.adminCategories.promptParent"),
        options: родители(c),
        defaultValue: c.parentId != null ? String(c.parentId) : "",
      });
      // Отказ здесь означает «родителя не меняю», а не «забудь всё, что
      // я ввёл в трёх предыдущих окнах»: так же ведёт себя вопрос об иконке.
      if (выбор !== null) parentId = выбор === "" ? null : Number(выбор);
    }
    /*
     * Отказ во всех окнах — это «передумал», а не «сохрани как было».
     *
     * С тех пор как отказ перестал обрывать цепочку, пройти её насквозь,
     * ничего не меняя, стало обычным делом. Без этой проверки такой
     * проход слал PUT с прежними значениями: сервер пересинхронизировал
     * поддерево, сбрасывал кеш каталога и писал строку в аудит, а человек
     * читал «Сохранено». В журнале оставались правки, которых не было.
     */
    const безИзменений =
      name === c.name &&
      slug === c.slug &&
      (icon || null) === (c.icon || null) &&
      sortOrder === c.sortOrder &&
      parentId === c.parentId;
    if (безИзменений) {
      toast.info(t("pages.adminCategories.nothingChanged"));

      return;
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
        inFeed: c.inFeed,
        inListings: c.inListings,
        inCommunities: c.inCommunities,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      // Переименование меняет место в алфавите — узел переезжает сам.
      if (name !== c.name) await переставитьЕслиАлфавит();
      toast.success(t("pages.adminCommon.saved"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.updateFailed"));
    }
  };

  const toggleActive = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        ...bodyOf(c),
        isActive: !c.isActive,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCommon.saved"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.updateFailed"));
    }
  };

  const patchCategoryPrices = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, bodyOf(c));
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCategories.pricesSaved"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.pricesSaveFailed"));
    }
  };

  const toggleFlag = async (c: AdminCategory, flag: (typeof FLAG_KEYS)[number]["key"]) => {
    const next = { ...c, [flag]: !(c[flag] ?? true) };
    try {
      const updated = await updateAdminCategory(kind, c.id, bodyOf(next));
      // Ответ сервера — сам узел, без цены из каталога: её держим свою.
      setItems((p) =>
        p.map((x) =>
          x.id === c.id
            ? {
                ...updated,
                listingPriceCents: next.listingPriceCents,
                subscriberListingPriceCents: next.subscriberListingPriceCents,
              }
            : x,
        ),
      );
      toast.success(t("pages.adminCommon.saved"));
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.updateFailed"));
    }
  };

  const setPrice = (c: AdminCategory, поле: "listing" | "subscriber", рубли: string) => {
    const коп = рубли === "" ? null : Math.max(0, +рубли) * 100;
    setItems((p) =>
      p.map((x) =>
        x.id === c.id
          ? {
              ...x,
              ...(поле === "listing"
                ? { listingPriceCents: коп }
                : { subscriberListingPriceCents: коп }),
            }
          : x,
      ),
    );
  };

  const remove = async (c: AdminCategory) => {
    if (!(await askConfirm({ title: t("pages.adminCategories.deleteConfirm", { name: c.name }) })))
      return;
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
    } catch (e) {
      reportActionFailure(e, t("pages.adminCategories.deleteFailed"));
    }
  };

  /**
   * Что скрыто под стрелкой: числа, флаги, цены.
   *
   * До C5 это висело под каждой строкой всегда, и ряд из девяноста
   * направлений разворачивался в три сотни строк с одинаковыми
   * галочками. Смотреть в них нужно поштучно — значит и открывать
   * поштучно.
   */
  const настройки = (c: AdminCategory): ReactNode => {
    if (kind !== "post") return null;
    const ценыВидны = c.inListings !== false && isOwner;

    return (
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          padding: "6px 0 10px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 4,
        }}
      >
        <NodeCounts c={c} />
        {FLAG_KEYS.map((f) => (
          <label
            key={f.key}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--foreground-50)" }}
          >
            <input
              type="checkbox"
              checked={c[f.key] ?? true}
              onChange={() => void toggleFlag(c, f.key)}
            />
            {t(f.labelKey)}
          </label>
        ))}
        {ценыВидны && (
          <>
            <label
              className="flex items-center gap-1 text-[11px]"
              style={{ color: "var(--foreground-50)" }}
            >
              {t("pages.adminCategories.priceRegular")}
              <input
                type="number"
                min={0}
                placeholder="—"
                style={{ ...inputStyle, width: 72, height: 30, padding: "0 8px", fontSize: 12 }}
                value={c.listingPriceCents != null ? Math.round(c.listingPriceCents / 100) : ""}
                onChange={(e) => setPrice(c, "listing", e.target.value)}
                onBlur={() => void patchCategoryPrices(c)}
              />
            </label>
            <label
              className="flex items-center gap-1 text-[11px]"
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
                onChange={(e) => setPrice(c, "subscriber", e.target.value)}
                onBlur={() => void patchCategoryPrices(c)}
              />
            </label>
          </>
        )}
      </div>
    );
  };

  /** Один узел и всё, что под ним. Одна отрисовка на все три уровня. */
  const узел = (c: AdminCategory, уровень: number): ReactNode => {
    const дети = kind === "video" ? [] : childrenOf(c.id);
    const вид = УРОВНИ[Math.min(уровень, УРОВНИ.length - 1)];
    const раскрыт = Boolean(open[c.id]);
    // Раскрывать есть что всегда, пока это направления: даже у листа
    // под стрелкой лежат флаги и числа. У обзоров — ни того ни другого.
    const раскрывается = kind === "post" || дети.length > 0;

    return (
      <div key={c.id}>
        <div className="flex items-center justify-between" style={{ padding: вид.отступ }}>
          {раскрывается ? (
            <button
              onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}
              className="flex items-center gap-2 flex-1 text-left"
              aria-expanded={раскрыт}
              title={t(
                раскрыт ? "pages.adminCategories.collapse" : "pages.adminCategories.expand",
                { name: c.name },
              )}
            >
              <m.span
                animate={{ rotate: раскрыт ? 90 : 0 }}
                style={{ display: "inline-block", color: "var(--foreground-50)", fontSize: 10 }}
              >
                ▶
              </m.span>
              <NodeName c={c} вид={вид} />
            </button>
          ) : (
            <span className="flex items-center gap-2 flex-1">
              <NodeName c={c} вид={вид} />
            </span>
          )}
          <div className="flex gap-1">
            {/*
             * Стрелки порядка — только при ручном. При алфавите место
             * узла задаёт его название, и кнопка «поднять» обещала бы
             * то, чего сервер не сделает: он отвечает на такой запрос
             * отказом.
             */}
            {!алфавит && kind === "post" && (
              <>
                <IconBtn
                  onClick={() => void move(c, -1)}
                  title={t("pages.adminCategories.actionMoveUp", { name: c.name })}
                  disabled={переставляем || !canMove(c, -1)}
                >
                  <ChevronUp size={14} />
                </IconBtn>
                <IconBtn
                  onClick={() => void move(c, 1)}
                  title={t("pages.adminCategories.actionMoveDown", { name: c.name })}
                  disabled={переставляем || !canMove(c, 1)}
                >
                  <ChevronDown size={14} />
                </IconBtn>
              </>
            )}
            {kind === "post" && depthOf(c.id) < 2 && (
              <IconBtn
                onClick={() => void addSub(c)}
                title={t("pages.adminCategories.actionAddSub", { name: c.name })}
              >
                <Plus size={14} />
              </IconBtn>
            )}
            {kind === "post" && (
              <IconBtn
                onClick={() => void toggleActive(c)}
                title={t(
                  c.isActive
                    ? "pages.adminCategories.actionHide"
                    : "pages.adminCategories.actionShow",
                  { name: c.name },
                )}
              >
                {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
              </IconBtn>
            )}
            <IconBtn
              onClick={() => void edit(c)}
              title={t("pages.adminCategories.actionEditCategory", { name: c.name })}
            >
              <Pencil size={14} />
            </IconBtn>
            <IconBtn
              danger
              onClick={() => void remove(c)}
              title={t("pages.adminCategories.actionRemove", { name: c.name })}
            >
              <Trash2 size={14} />
            </IconBtn>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {раскрыт && раскрывается && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                overflow: "hidden",
                borderLeft: "1px solid var(--border)",
                marginLeft: 8,
                paddingLeft: 16,
              }}
            >
              {настройки(c)}
              {дети.map((д) => узел(д, уровень + 1))}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div>
      <H
        action={
          <button style={{ ...primaryBtn }} onClick={() => void addRoot()}>
            <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />
            {t("pages.adminCommon.add")}
          </button>
        }
      >
        {t("pages.adminCategories.title")}
      </H>

      {kind === "post" && (
        <p className="text-[13px]" style={{ color: "var(--foreground-50)", marginBottom: 12 }}>
          {t(
            // Модератору поля цены не показываются — подсказка о них его путала.
            isOwner
              ? "pages.adminCategories.unifiedHint"
              : "pages.adminCategories.unifiedHintNoPrices",
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "12px" }}>
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

        <span style={{ flex: 1 }} />

        <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adminCategories.sortModeLabel")}
        </span>
        {(["alpha", "manual"] as const).map((m2) => (
          <button
            key={m2}
            onClick={() => void переключить(m2)}
            disabled={режим === null}
            aria-pressed={режим === m2}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: режим === m2 ? 600 : 500,
              borderRadius: "var(--r-pill)",
              border: `1px solid ${режим === m2 ? "var(--border-accent)" : "var(--border)"}`,
              background: режим === m2 ? "var(--accent-soft)" : "transparent",
              color: режим === m2 ? "var(--accent)" : "var(--foreground-70)",
            }}
          >
            {t(
              m2 === "alpha"
                ? "pages.adminCategories.sortModeAlpha"
                : "pages.adminCategories.sortModeManual",
            )}
          </button>
        ))}
      </div>

      <p className="text-[12px]" style={{ color: "var(--foreground-50)", marginBottom: 12 }}>
        {t(
          алфавит
            ? "pages.adminCategories.sortModeAlphaHint"
            : "pages.adminCategories.sortModeManualHint",
        )}
      </p>

      <div style={{ ...card, padding: "16px" }}>
        {loading || режим === null ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCommon.loading")}
          </p>
        ) : roots.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCategories.empty")}
          </p>
        ) : (
          roots.map((c) => узел(c, 0))
        )}
      </div>
    </div>
  );
}

/**
 * Название узла и единственный признак состояния.
 *
 * Раньше в строке рядом стояли: слово «(скрыта)», число подкатегорий,
 * число записей, число объявлений и значок администратора — пять
 * сообщений об одном узле, четыре из которых повторяли то, что и так
 * видно (подкатегории — под стрелкой, числа — в настройках). Осталось
 * имя и то, чего иначе не узнать: что раздел скрыт.
 */
function NodeName({ c, вид }: { c: AdminCategory; вид: (typeof УРОВНИ)[number] }) {
  const { t } = useTranslation();

  return (
    <>
      <span style={{ fontSize: вид.шрифт, fontWeight: вид.вес, color: вид.цвет }}>{c.name}</span>
      {!c.isActive && (
        <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
          {t("pages.adminCategories.hidden")}
        </span>
      )}
    </>
  );
}

/**
 * Что в узле есть, кроме имени: записи, объявления, администратор.
 *
 * Отсутствие числа и ноль — разные ответы. Счётчиков нет у вкладки
 * обзоров, и тогда не показывается ничего; ноль же показывается, потому
 * что «здесь пусто» — как раз то, что нужно знать перед удалением.
 *
 * Числа прямые: считается то, что лежит в самом узле, без подкатегорий.
 * Поэтому у направления, все записи которого разложены по подкатегориям,
 * будет ноль — а числа подкатегорий видны в них самих, при раскрытии.
 */
function NodeCounts({ c }: { c: AdminCategory }) {
  const { t } = useTranslation();
  const посты = c.postsCount;
  const лоты = c.listingsCount;

  if (посты === undefined && лоты === undefined && !c.hasAdmin) return null;

  const подпись = t(
    c.hasAdmin
      ? "pages.adminCategories.nodeCountsLabelWithAdmin"
      : "pages.adminCategories.nodeCountsLabel",
    { posts: посты ?? 0, listings: лоты ?? 0 },
  );

  return (
    <span
      /*
       * Роль нужна, чтобы подпись вообще прочиталась. У голого `span`
       * роль `generic`, а её именовать нельзя.
       */
      role="img"
      title={подпись}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}
      // Иначе диктор прочитает «0 0» без объяснения, что это за числа.
      aria-label={подпись}
    >
      {посты !== undefined && (
        <span style={{ color: "var(--foreground-50)" }} aria-hidden>
          {t("pages.adminCategories.countPosts", { count: посты })}
        </span>
      )}
      {лоты !== undefined && (
        <span style={{ color: "var(--foreground-50)" }} aria-hidden>
          {t("pages.adminCategories.countListings", { count: лоты })}
        </span>
      )}
      {c.hasAdmin && (
        <span
          title={t("pages.adminCategories.hasAdmin")}
          style={{ color: "var(--success)", display: "inline-flex" }}
          aria-hidden
        >
          <UserCheck size={13} />
        </span>
      )}
    </span>
  );
}
