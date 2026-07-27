/**
 * Expands en.ts / zh.ts to match ru.ts structure.
 * Keeps existing English where present; fills new keys from ru (Russian) as fallback.
 */
import { writeFileSync } from "node:fs";
import { ru } from "../src/lib/i18n/locales/ru.ts";
import { en as baseEn } from "../src/lib/i18n/locales/en.ts";

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (!(k in out)) {
      out[k] = v;
    }
  }
  return out;
}

function toTs(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[\n" + obj.map((v) => pad + "  " + toTs(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  const lines = Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
    const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    return `${pad}  ${key}: ${toTs(v, indent + 1)}`;
  });
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}

const en = deepMerge(baseEn as unknown as Record<string, unknown>, ru as unknown as Record<string, unknown>);
const zh = en;

writeFileSync("src/lib/i18n/locales/en.ts", `import type { TranslationSchema } from "./ru";\n\nexport const en: TranslationSchema = ${toTs(en)};\n`);
writeFileSync("src/lib/i18n/locales/zh.ts", `import type { TranslationSchema } from "./ru";\n\nexport const zh: TranslationSchema = ${toTs(zh)};\n`);
console.log("Expanded en.ts and zh.ts to match ru.ts");
