// Детерминированная SVG-заглушка для demo-картинок и onError-fallback.
// Без сетевых запросов — всегда рендерится (в т.ч. на стенде/офлайн).

const CATEGORY_COLORS: Record<string, [string, string]> = {
  Автомодели: ["#c8102e", "#6e0f1c"],
  Самолёты: ["#1e73be", "#0d3a63"],
  Корабли: ["#0e7490", "#083344"],
  Квадрокоптеры: ["#7c3aed", "#3b1d6e"],
  Электроника: ["#0891b2", "#083344"],
  Аккумуляторы: ["#ca8a04", "#713f12"],
  Радиоаппаратура: ["#4338ca", "#1e1b4b"],
  Электросамокаты: ["#059669", "#064e3b"],
  Разработчики: ["#475569", "#1e293b"],
  Запчасти: ["#b45309", "#5c2e07"],
};

const FALLBACK_COLORS: [string, string] = ["#374151", "#1f2937"];

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Заглушка обложки для сообщества или канала, у которых её нет.
 *
 * Раньше на этом месте была ровная заливка в 80 px — читалась как забытое
 * место, а не как решение. Здесь тот же приём, что у карточек объявлений:
 * детерминированный градиент из имени, без сетевых запросов.
 *
 * Буква была ростом в 210 при высоте блока 200 — то есть выше самого блока,
 * обрезанная сверху и снизу. Такое читается не как оформление, а как
 * сломавшаяся картинка. Теперь она 15% высоты, в правом нижнем углу и с
 * непрозрачностью 8%: подпись на фоне, а не заголовок. Слева внизу на
 * обложку заходит аватар — там буква и раньше стояла бы поперёк него.
 */
export function coverPlaceholder(name: string): string {
  const h = hashSeed(name);
  // Оттенок из имени, но не любой: полоса стоит под шапкой, и кислотные тона
  // спорили бы с акцентным цветом интерфейса.
  const hue = h % 360;
  const c1 = `hsl(${hue} 42% 34%)`;
  const c2 = `hsl(${(hue + 38) % 360} 46% 20%)`;
  const letter = (name.trim()[0] || "?").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200" viewBox="0 0 1200 200">` +
    `<defs><linearGradient id="g" gradientTransform="rotate(${h % 90} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="1200" height="200" fill="url(#g)"/>` +
    `<text x="1164" y="176" font-family="system-ui,sans-serif" font-size="30" font-weight="800" ` +
    `fill="rgba(255,255,255,0.08)" text-anchor="end">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function categoryPlaceholder(seed: string | number, category?: string): string {
  const [c1, c2] = (category && CATEGORY_COLORS[category]) || FALLBACK_COLORS;
  const angle = hashSeed(seed) % 360;
  const label = (category || "МоДелизМ").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>` +
    `<text x="400" y="312" font-family="system-ui,sans-serif" font-size="40" font-weight="700" ` +
    `fill="rgba(255,255,255,0.82)" text-anchor="middle" letter-spacing="1">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
