/**
 * Дерево направлений в админке: порядок, глубина, перенос.
 *
 * Отдельным модулем, а не внутри раздела, потому что это единственная
 * часть C2, которую можно проверить без браузера: правила «куда можно
 * перенести» и «что записать при перестановке» — арифметика над списком,
 * и ошибка в ней выглядит на экране не поломкой, а просто другим порядком.
 */

export type TreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  sortOrder: number;
};

/** Глубина дерева: 0 — корень, 2 — третий уровень. Больше не бывает. */
export const MAX_DEPTH = 2;

/** Порядок на экране и на сервере: sort_order, при равенстве — имя. */
export function byOrder(a: TreeNode, b: TreeNode): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru");
}

export function childrenOf<T extends TreeNode>(items: T[], parentId: number | null): T[] {
  return items.filter((x) => x.parentId === parentId).sort(byOrder);
}

/** Соседи узла — ряд, в котором он нарисован. */
export function siblingsOf<T extends TreeNode>(items: T[], node: T): T[] {
  return childrenOf(items, node.parentId);
}

export function depthOf(items: TreeNode[], id: number): number {
  let depth = 0;
  let cur = items.find((x) => x.id === id);
  const seen = new Set<number>();
  while (cur?.parentId != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    cur = items.find((x) => x.id === cur!.parentId);
  }

  return depth;
}

/** Высота поддерева: 0 у листа, 1 если есть дети, 2 если есть внуки. */
export function heightOf(items: TreeNode[], id: number, seen = new Set<number>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const дети = items.filter((x) => x.parentId === id);

  return дети.length === 0 ? 0 : 1 + Math.max(...дети.map((x) => heightOf(items, x.id, seen)));
}

/** Узел и всё, что под ним. Своим потомкам узел родителем быть не может. */
export function subtreeOf(items: TreeNode[], id: number): Set<number> {
  const свои = new Set<number>([id]);
  let добавили = true;
  while (добавили) {
    добавили = false;
    for (const x of items) {
      if (x.parentId != null && свои.has(x.parentId) && !свои.has(x.id)) {
        свои.add(x.id);
        добавили = true;
      }
    }
  }

  return свои;
}

/** Путь от корня: «Авиация → Вторая мировая». Чтобы тёзки различались. */
export function pathOf(items: TreeNode[], node: TreeNode): string {
  const части: string[] = [node.name];
  let cur = node;
  const seen = new Set<number>([node.id]);
  while (cur.parentId != null && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    const вверх = items.find((x) => x.id === cur.parentId);
    if (!вверх) break;
    части.unshift(вверх.name);
    cur = вверх;
  }

  return части.join(" → ");
}

/**
 * Куда узел можно перенести.
 *
 * Родитель отсеивается не только по своей глубине, но и по высоте
 * переносимого поддерева: направление с детьми нельзя вложить туда, где
 * его внуки оказались бы четвёртым уровнем. Сам узел и его потомки
 * исключены — иначе ветка отрезается от дерева.
 */
export function parentOptions(
  items: TreeNode[],
  node: TreeNode,
): { value: string; label: string }[] {
  const свои = subtreeOf(items, node.id);
  const высота = heightOf(items, node.id);

  return items
    .filter((x) => !свои.has(x.id) && depthOf(items, x.id) + 1 + высота <= MAX_DEPTH)
    .map((x) => ({ value: String(x.id), label: pathOf(items, x) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function canMove(items: TreeNode[], node: TreeNode, delta: -1 | 1): boolean {
  const ряд = siblingsOf(items, node);
  const i = ряд.findIndex((x) => x.id === node.id);

  return i >= 0 && i + delta >= 0 && i + delta < ряд.length;
}

/**
 * Шаг нумерации порядка: 10, 20, 30…
 *
 * Тот же, что на сервере (`AdminPostCategoryController::reorder`) и в
 * наполнении справочника. Разойдись они — первый же перенос сдвинул бы
 * все номера ряда и на экране, и в базе без нужды.
 */
export const SORT_STEP = 10;

export function sortOrderAt(index: number): number {
  return (index + 1) * SORT_STEP;
}

/**
 * Ряд в новом порядке — с узлом, переставленным на соседнее место.
 *
 * Пустой список означает, что двигать некуда. Наружу отдаётся весь ряд, а
 * не пара переставленных узлов: порядок сохраняется одним запросом, и
 * сервер принимает ряд целиком — так он может проверить, что клиент видит
 * всех соседей, а не обрезанную страницу списка.
 */
export function reordered<T extends TreeNode>(items: T[], node: T, delta: -1 | 1): T[] {
  if (!canMove(items, node, delta)) return [];
  const ряд = siblingsOf(items, node);
  const i = ряд.findIndex((x) => x.id === node.id);

  const новый = [...ряд];
  [новый[i], новый[i + delta]] = [новый[i + delta], новый[i]];

  return новый;
}
