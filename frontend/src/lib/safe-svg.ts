// frontend/src/lib/safe-svg.ts
// Клиентская защита перед инлайном SVG через dangerouslySetInnerHTML.
// Это defense-in-depth поверх обязательной серверной санитизации, НЕ замена ей.
// Возвращает true только для строки, которая:
//  - после trim начинается с "<svg" и заканчивается на "</svg>";
//  - не содержит <script, <foreignObject, <iframe;
//  - не содержит inline-обработчиков onXxx=;
//  - не содержит "javascript:" и подозрительных data:-URI в атрибутах.

const FORBIDDEN_TAGS = /<\s*(script|foreignObject|iframe|object|embed|link|meta|style)\b/i;
const INLINE_HANDLER = /\son[a-z]+\s*=/i;
const JS_URI = /(javascript:|data:text\/html)/i;

export function isSafeSvgMarkup(svg: string | null | undefined): boolean {
  if (!svg || typeof svg !== "string") return false;
  const s = svg.trim();
  if (s.length === 0 || s.length > 100_000) return false;
  if (!/^<svg[\s>]/i.test(s)) return false;
  if (!/<\/svg>\s*$/i.test(s)) return false;
  if (FORBIDDEN_TAGS.test(s)) return false;
  if (INLINE_HANDLER.test(s)) return false;
  if (JS_URI.test(s)) return false;
  return true;
}
