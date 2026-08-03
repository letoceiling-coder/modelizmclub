/**
 * Browser QA smoke for modelizmclub.ru (Playwright) — Task 43 regression harness.
 * Usage: cd deploy && npm install && npx playwright install chromium && npm run qa
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.QA_BASE || "https://modelizmclub.ru";
const EMAIL = process.env.QA_EMAIL || "admin@modelizmclub.ru";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const OUT_DIR = join(process.cwd(), "qa-artifacts", new Date().toISOString().slice(0, 10));

const BOUNDARY_MARKERS = [
  "Что-то пошло не так",
  "Something went wrong",
  "errors.boundaryTitle",
];

const routes = [
  { path: "/", name: "Главная" },
  { path: "/login", name: "Вход" },
  { path: "/register", name: "Регистрация" },
  { path: "/ads", name: "Объявления" },
  { path: "/feed", name: "Лента" },
  { path: "/reviews", name: "Обзоры" },
  { path: "/communities", name: "Сообщества" },
  { path: "/channels", name: "Каналы" },
  { path: "/categories", name: "Категории" },
  { path: "/messenger", name: "Мессенджер" },
  { path: "/profile", name: "Профиль" },
  { path: "/settings", name: "Настройки" },
  { path: "/friends", name: "Друзья" },
  { path: "/subscription", name: "Подписка" },
  { path: "/notifications", name: "Уведомления" },
  { path: "/my-ads", name: "Мои объявления" },
  { path: "/favorites", name: "Избранное" },
  { path: "/help", name: "Помощь" },
  { path: "/admin", name: "Админка" },
  { path: "/legal/privacy", name: "Политика" },
  { path: "/legal/rules", name: "Правила" },
];

/** @type {Array<{page:string,element:string,status:string,bug?:string,description:string}>} */
const results = [];

function log(page, element, status, description, bug) {
  results.push({ page, element, status, description, ...(bug ? { bug } : {}) });
  const icon = status === "OK" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  console.log(`${icon} [${page}] ${element}: ${description}${bug ? ` (${bug})` : ""}`);
}

function hasErrorBoundary(text) {
  return BOUNDARY_MARKERS.some((m) => text.includes(m));
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function makePage(viewport) {
  const context = await browser.newContext({ viewport, locale: "ru-RU" });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (err) => pageErrors.push(String(err.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Stale guest token or expected unauthenticated probe — not a regression.
      if (/401\b/.test(text) || /401\s*\(\)/.test(text)) return;
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`);
  });
  return { context, page, pageErrors, consoleErrors, failedRequests };
}

// --- Desktop public pages ---
const desktop = await makePage({ width: 1280, height: 800 });
const { page, pageErrors, consoleErrors, failedRequests } = desktop;

for (const r of routes.filter((x) => !["/admin", "/profile", "/messenger", "/friends", "/notifications", "/my-ads", "/favorites", "/settings"].includes(x.path))) {
  try {
    const res = await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res?.status() ?? 0;
    if (status >= 200 && status < 400) {
      log(r.path, "Загрузка", "OK", `HTTP ${status}`);
    } else {
      log(r.path, "Загрузка", "FAIL", `HTTP ${status}`, `#http-${r.path}`);
    }
  } catch (e) {
    log(r.path, "Загрузка", "FAIL", String(e.message || e), `#nav-${r.path}`);
  }
}

// Task 25 — reviews list + detail (P0)
try {
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);
  const cards = await page.locator("a[href*='/reviews/']").count();
  if (cards === 0) {
    log("P0-25", "/reviews", "FAIL", "Нет карточек обзоров", "Task25");
  } else {
    log("P0-25", "/reviews", "OK", `Карточек: ${cards}`);
    const href = await page.locator("a[href*='/reviews/']").first().getAttribute("href");
    if (href) {
      await page.goto(`${BASE}${href}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(3000);
      const body = await page.textContent("body");
      const h1 = await page.locator("main h1").first().textContent().catch(() => null);
      if (hasErrorBoundary(body ?? "") || pageErrors.length) {
        log("P0-25", "/reviews/$id", "FAIL", `Error boundary или pageerror: ${pageErrors.join("; ") || "boundary"}`, "Task25");
      } else if (!h1?.trim()) {
        log("P0-25", "/reviews/$id", "FAIL", "Нет заголовка h1 на детальной странице", "Task25");
      } else {
        log("P0-25", "/reviews/$id", "OK", `Деталь: «${h1.trim().slice(0, 40)}»`);
      }
      await page.screenshot({ path: join(OUT_DIR, "review-detail-desktop.png"), fullPage: false });
    }
  }
  await page.screenshot({ path: join(OUT_DIR, "reviews-desktop.png"), fullPage: false });
} catch (e) {
  log("P0-25", "reviews flow", "FAIL", String(e.message || e), "Task25");
}

// Task 25 — mobile viewport 375px
try {
  const mobile = await makePage({ width: 375, height: 812 });
  await mobile.page.goto(`${BASE}/reviews`, { waitUntil: "networkidle", timeout: 45000 });
  await mobile.page.waitForTimeout(2000);
  const link = mobile.page.locator("a[href*='/reviews/']").first();
  if (await link.count()) {
    await link.click();
    await mobile.page.waitForTimeout(4000);
    const body = await mobile.page.textContent("body");
    const h1 = await mobile.page.locator("main h1").first().textContent().catch(() => null);
    if (hasErrorBoundary(body ?? "") || mobile.pageErrors.length) {
      log("P0-25", "mobile /reviews/$id", "FAIL", mobile.pageErrors.join("; ") || "boundary", "Task25-mobile");
    } else if (!h1?.trim()) {
      log("P0-25", "mobile /reviews/$id", "FAIL", "Нет h1", "Task25-mobile");
    } else {
      log("P0-25", "mobile /reviews/$id", "OK", `375px: «${h1.trim().slice(0, 30)}»`);
    }
    await mobile.page.screenshot({ path: join(OUT_DIR, "review-detail-mobile.png"), fullPage: false });
  } else {
    log("P0-25", "mobile /reviews", "WARN", "Нет ссылок на обзоры");
  }
  await mobile.context.close();
} catch (e) {
  log("P0-25", "mobile reviews", "FAIL", String(e.message || e), "Task25-mobile");
}

// Communities members check (client-rendered list)
try {
  await page.goto(`${BASE}/communities`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  const zeroMembers = await page.getByText(/^0 участников$/).count();
  const newCommunity = await page.getByText(/Новое сообщество/).count();
  if (zeroMembers > 0) {
    log("/communities", "Счётчик участников", "WARN", `${zeroMembers} карточек с «0 участников»`);
  } else if (newCommunity > 0) {
    log("/communities", "Счётчик участников", "OK", `${newCommunity} карточек «Новое сообщество»`);
  } else {
    log("/communities", "Счётчик участников", "OK", "Нет нулевых счётчиков");
  }
} catch (e) {
  log("/communities", "Счётчик", "WARN", String(e.message || e));
}

// Login page — OAuth hydrated (informational; SSR may omit labels)
try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  const yandex = await page.getByRole("link", { name: /Яндекс|Yandex/i }).isVisible().catch(() => false);
  const vk = await page.getByRole("link", { name: /^VK$/i }).isVisible().catch(() => false);
  if (yandex || vk) {
    log("/login", "OAuth links", "OK", `Яндекс=${yandex}, VK=${vk}`);
  } else {
    log("/login", "OAuth links", "WARN", "OAuth-ссылки не видны после hydration");
  }
} catch (e) {
  log("/login", "OAuth", "WARN", String(e.message || e));
}

// Hero video on landing
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  const videoErrors = failedRequests.filter((u) => u.includes("herovideo") || u.includes("/videos/herovideo"));
  if (videoErrors.length) {
    log("/", "Hero-video", "WARN", videoErrors.join("; "));
  } else {
    log("/", "Hero-video", "OK", "Нет failed-запросов к herovideo");
  }
} catch (e) {
  log("/", "Hero-video", "WARN", String(e.message || e));
}

// --- Login flow ---
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(feed|admin|profile)/, { timeout: 30000 });
  log("/login", "Вход admin", "OK", `Редирект на ${page.url()}`);
  await page.screenshot({ path: join(OUT_DIR, "after-login.png"), fullPage: false });
} catch (e) {
  log("/login", "Вход admin", "FAIL", String(e.message || e), "#auth");
}

// Auth-only pages
const authRoutes = [
  { path: "/feed", name: "Лента (auth)" },
  { path: "/profile", name: "Профиль" },
  { path: "/messenger", name: "Мессенджер" },
  { path: "/friends", name: "Друзья" },
  { path: "/notifications", name: "Уведомления" },
  { path: "/my-ads", name: "Мои объявления" },
  { path: "/favorites", name: "Избранное" },
  { path: "/settings", name: "Настройки" },
  { path: "/admin", name: "Админка" },
  { path: "/reviews/upload", name: "Загрузка обзора" },
  { path: "/ads/new", name: "Новое объявление" },
];

for (const r of authRoutes) {
  try {
    const res = await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res?.status() ?? 0;
    const onLogin = page.url().includes("/login");
    if (onLogin) {
      log(r.path, "Доступ", "FAIL", "Редирект на login после входа", "#auth-session");
    } else if (status >= 200 && status < 400) {
      log(r.path, "Доступ", "OK", `HTTP ${status}`);
    } else {
      log(r.path, "Доступ", "FAIL", `HTTP ${status}`);
    }
  } catch (e) {
    log(r.path, "Доступ", "FAIL", String(e.message || e));
  }
}

// Task 19 — ads/new loads for admin (preview CTA checked on mobile separately)
try {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/ads/new`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  const onLogin = page.url().includes("/login");
  if (onLogin) {
    log("P0-19", "/ads/new mobile", "FAIL", "Редирект на login", "Task19");
  } else {
    const body = await page.textContent("body");
    if (hasErrorBoundary(body ?? "")) {
      log("P0-19", "/ads/new mobile", "FAIL", "Error boundary", "Task19");
    } else {
      log("P0-19", "/ads/new mobile", "OK", "Страница создания объявления открывается на 375px");
    }
  }
  await page.screenshot({ path: join(OUT_DIR, "ads-new-mobile.png"), fullPage: false });
} catch (e) {
  log("P0-19", "/ads/new", "FAIL", String(e.message || e), "Task19");
}

// Admin section
try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 45000 });
  const body = await page.textContent("body");
  if (hasErrorBoundary(body ?? "")) {
    log("/admin", "UI", "FAIL", "Error boundary");
  } else {
    log("/admin", "UI", "OK", "Админка без error boundary");
  }
  await page.screenshot({ path: join(OUT_DIR, "admin.png"), fullPage: false });
} catch (e) {
  log("/admin", "UI", "FAIL", String(e.message || e));
}

/** P2 matrix evidence — 375px + 1280px screenshots keyed by route slug */
const P2_ROUTES = [
  { slug: "feed", path: "/feed" },
  { slug: "profile", path: "/profile" },
  { slug: "messenger", path: "/messenger" },
  { slug: "notifications", path: "/notifications" },
  { slug: "channels", path: "/channels" },
  { slug: "ads", path: "/ads" },
  { slug: "ads-new", path: "/ads/new" },
  { slug: "reviews", path: "/reviews" },
  { slug: "reviews-upload", path: "/reviews/upload" },
  { slug: "admin", path: "/admin" },
  { slug: "settings", path: "/settings" },
  { slug: "my-ads", path: "/my-ads" },
  { slug: "favorites", path: "/favorites" },
  { slug: "friends", path: "/friends" },
];

async function captureP2Route(targetPage, path, slug) {
  for (const [width, suffix] of [
    [375, "mobile"],
    [1280, "desktop"],
  ]) {
    try {
      await targetPage.setViewportSize({ width, height: width === 375 ? 812 : 800 });
      const res = await targetPage.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
      await targetPage.waitForTimeout(1200);
      const onLogin = targetPage.url().includes("/login");
      const body = await targetPage.textContent("body");
      const httpOk = (res?.status() ?? 0) >= 200 && (res?.status() ?? 0) < 400;
      if (onLogin) {
        log("P2", `${slug}@${suffix}`, "FAIL", "Редирект на login", `#p2-${slug}`);
      } else if (hasErrorBoundary(body ?? "")) {
        log("P2", `${slug}@${suffix}`, "FAIL", "Error boundary", `#p2-${slug}`);
      } else if (!httpOk) {
        log("P2", `${slug}@${suffix}`, "FAIL", `HTTP ${res?.status()}`, `#p2-${slug}`);
      } else {
        await targetPage.screenshot({ path: join(OUT_DIR, `p2-${slug}-${suffix}.png`), fullPage: false });
        log("P2", `${slug}@${suffix}`, "OK", `${path} ${width}px`);
      }
    } catch (e) {
      log("P2", `${slug}@${suffix}`, "FAIL", String(e.message || e), `#p2-${slug}`);
    }
  }
}

console.log("\n--- P2 evidence capture (375px + 1280px) ---");
for (const r of P2_ROUTES) {
  await captureP2Route(page, r.path, r.slug);
}

// Dynamic detail routes: first channel + first listing
try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/channels`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  const channelHref = await page.locator("a[href*='/channel/']").first().getAttribute("href");
  if (channelHref) {
    await captureP2Route(page, channelHref.replace(BASE, "") || channelHref, "channel-detail");
  } else {
    log("P2", "channel-detail", "WARN", "Нет ссылок на канал");
  }
} catch (e) {
  log("P2", "channel-detail", "WARN", String(e.message || e));
}

try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/ads`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  const adLinks = page.locator("a[href*='/ads/']");
  let adHref = null;
  for (let i = 0; i < (await adLinks.count()); i++) {
    const href = await adLinks.nth(i).getAttribute("href");
    if (href && !href.includes("/ads/new") && !href.endsWith("/ads")) {
      adHref = href;
      break;
    }
  }
  if (adHref) {
    await captureP2Route(page, adHref.replace(BASE, "") || adHref, "ads-detail");
  } else {
    log("P2", "ads-detail", "WARN", "Нет карточек объявлений");
  }
} catch (e) {
  log("P2", "ads-detail", "WARN", String(e.message || e));
}

// Alias task-specific names for matrix cross-ref
try {
  const aliases = [
    ["ads-new-mobile.png", "task-19-mobile.png"],
    ["p2-feed-mobile.png", "task-4-mobile.png"],
    ["p2-feed-desktop.png", "task-4-desktop.png"],
    ["p2-profile-mobile.png", "task-8-mobile.png"],
    ["p2-notifications-mobile.png", "task-16-mobile.png"],
    ["p2-messenger-desktop.png", "task-13-desktop.png"],
    ["p2-admin-desktop.png", "task-42-desktop.png"],
    ["review-detail-mobile.png", "task-25-mobile.png"],
    ["review-detail-desktop.png", "task-25-desktop.png"],
  ];
  const { copyFileSync, existsSync } = await import("fs");
  for (const [src, dst] of aliases) {
    const from = join(OUT_DIR, src);
    if (existsSync(from)) copyFileSync(from, join(OUT_DIR, dst));
  }
  log("P2", "aliases", "OK", `${aliases.length} task-* symlinks via copy`);
} catch (e) {
  log("P2", "aliases", "WARN", String(e.message || e));
}

if (consoleErrors.length) {
  const preview = consoleErrors.slice(0, 3).join(" | ");
  log("global", "console.errors", "WARN", `${consoleErrors.length} ошибок в консоли: ${preview}`);
} else {
  log("global", "console.errors", "OK", "0 ошибок");
}

await desktop.context.close();

const report = {
  base: BASE,
  email: EMAIL,
  at: new Date().toISOString(),
  task: "43-regression+p2-evidence",
  results,
  consoleErrors: consoleErrors.slice(0, 20),
  failedRequests: failedRequests.slice(0, 20),
};
writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

const pass = results.filter((r) => r.status === "OK").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const warn = results.filter((r) => r.status === "WARN").length;
console.log(`\n=== QA Task 43: ${pass} OK, ${warn} WARN, ${fail} FAIL ===`);
console.log(`Report: ${join(OUT_DIR, "report.json")}`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
