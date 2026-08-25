export type RailVariant = "feed" | "ads" | "communities" | "channels";

export function parseTaxonomyId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 ? n : undefined;
  }
  return undefined;
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
