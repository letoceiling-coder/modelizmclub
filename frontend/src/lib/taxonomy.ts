export type RailVariant = "feed" | "ads" | "communities" | "channels";

export function parseTaxonomyId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

type TaxonomyNode = { id: string; name: string; children?: TaxonomyNode[] };

/** Finds a node at any depth — category rooms exist on levels 2 and 3. */
export function findDescendant<T extends TaxonomyNode>(nodes: T[], targetId: string): T | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const nested = node.children ? findDescendant(node.children as T[], targetId) : null;
    if (nested) return nested;
  }
  return null;
}

/** Ancestor chain from the root down to (but excluding) `targetId`, or null. */
export function pathToDescendant<T extends TaxonomyNode>(nodes: T[], targetId: string): T[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [];
    const nested = node.children ? pathToDescendant(node.children as T[], targetId) : null;
    if (nested !== null) return [node, ...nested];
  }
  return null;
}

export function collectDescendantNames(
  nodes: Array<{ id: string; name: string; children?: Array<{ id: string; name: string; children?: unknown[] }> }>,
  targetId: string,
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return flattenNames(node);
    }
    const nested = node.children ? collectDescendantNames(node.children as typeof nodes, targetId) : null;
    if (nested) return nested;
  }
  return null;
}

function flattenNames(node: { name: string; children?: Array<{ name: string; children?: unknown[] }> }): string[] {
  const names = [node.name];
  for (const child of node.children ?? []) {
    names.push(...flattenNames(child as { name: string; children?: Array<{ name: string; children?: unknown[] }> }));
  }
  return names;
}
