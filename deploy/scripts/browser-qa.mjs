/**
 * Browser QA smoke for modelizmclub.ru (Playwright).
 * Usage: node deploy/scripts/browser-qa.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.QA_BASE || "https://modelizmclub.ru";
const EMAIL = process.env.QA_EMAIL || "admin@modelizmclub.ru";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const OUT_DIR = join(process.cwd(), "deploy", "qa-artifacts", new Date().toISOString().slice(0, 10));

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

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "ru-RU",
});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("requestfailed", (req) => {
  failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`);
});

// --- Public pages ---
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

// Reviews content check
try {
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle", timeout: 45000 });
  const empty = await page.getByText("Ничего не найдено").isVisible().catch(() => false);
  const loading = await page.getByText("Загрузка…").isVisible().catch(() => false);
  if (loading) await page.waitForTimeout(3000);
  const emptyAfter = await page.getByText("Ничего не найдено").isVisible().catch(() => false);
  const cards = await page.locator("a[href*='/reviews/']").count();
  if (emptyAfter && cards === 0) {
    log("/reviews", "Контент", "FAIL", "Пустая сетка «Ничего не найдено»", "#1");
  } else {
    log("/reviews", "Контент", "OK", `Карточек обзоров: ${cards}`);
  }
  await page.screenshot({ path: join(OUT_DIR, "reviews.png"), fullPage: false });
} catch (e) {
  log("/reviews", "Контент", "FAIL", String(e.message || e), "#1");
}

// Communities members check
try {
  await page.goto(`${BASE}/communities`, { waitUntil: "networkidle", timeout: 45000 });
  const zeroMembers = await page.getByText(/0 участников/).count();
  if (zeroMembers > 0) {
    log("/communities", "Счётчик участников", "FAIL", `${zeroMembers} карточек с «0 участников»`, "#3");
  } else {
    log("/communities", "Счётчик участников", "OK", "Нет нулевых счётчиков на видимых карточках");
  }
  await page.screenshot({ path: join(OUT_DIR, "communities.png"), fullPage: false });
} catch (e) {
  log("/communities", "Счётчик", "FAIL", String(e.message || e), "#3");
}

// Login page OAuth buttons
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const yandex = await page.getByRole("button", { name: "Яндекс" }).isVisible().catch(() => false);
  const vk = await page.getByRole("button", { name: "VK" }).isVisible().catch(() => false);
  if (!yandex) log("/login", "Кнопка Яндекс", "FAIL", "Не найдена", "#4");
  else log("/login", "Кнопка Яндекс", "OK", "Отображается");
  if (!vk) log("/login", "Кнопка VK", "WARN", "Не найдена");
  else log("/login", "Кнопка VK", "OK", "Отображается");
  await page.screenshot({ path: join(OUT_DIR, "login-before-deploy.png"), fullPage: false });
} catch (e) {
  log("/login", "OAuth кнопки", "FAIL", String(e.message || e), "#4");
}

// Hero video on landing
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  const videoErrors = failedRequests.filter((u) => u.includes("herovideo") || u.includes("/videos/"));
  if (videoErrors.length) {
    log("/", "Hero-video", "FAIL", videoErrors.join("; "), "#2");
  } else {
    log("/", "Hero-video", "OK", "Нет failed-запросов к herovideo");
  }
} catch (e) {
  log("/", "Hero-video", "WARN", String(e.message || e), "#2");
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

// Feed: duplicate categories requests
try {
  const catReqs = [];
  page.on("request", (req) => {
    if (req.url().includes("/categories/posts")) catReqs.push(req.url());
  });
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);
  if (catReqs.length > 1) {
    log("/feed", "categories/posts", "FAIL", `${catReqs.length} запросов`, "#5");
  } else {
    log("/feed", "categories/posts", "OK", `${catReqs.length || 0} запрос(ов)`);
  }
} catch (e) {
  log("/feed", "categories/posts", "WARN", String(e.message || e), "#5");
}

// Admin design/icons section
try {
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 45000 });
  const design = page.getByText("Дизайн", { exact: false });
  if (await design.first().isVisible().catch(() => false)) {
    await design.first().click();
    await page.waitForTimeout(1500);
    const icons = await page.getByText("Иконки").isVisible().catch(() => false);
    log("/admin", "Раздел Иконки", icons ? "OK" : "WARN", icons ? "Виден в Дизайне" : "Не найден текст «Иконки»");
  } else {
    log("/admin", "Дизайн", "WARN", "Пункт меню не найден");
  }
  await page.screenshot({ path: join(OUT_DIR, "admin.png"), fullPage: false });
} catch (e) {
  log("/admin", "UI", "FAIL", String(e.message || e));
}

// Console summary
if (consoleErrors.length) {
  log("global", "console.errors", "WARN", `${consoleErrors.length} ошибок в консоли`);
} else {
  log("global", "console.errors", "OK", "0 ошибок");
}

const report = {
  base: BASE,
  email: EMAIL,
  at: new Date().toISOString(),
  results,
  consoleErrors: consoleErrors.slice(0, 20),
  failedRequests: failedRequests.slice(0, 20),
};
writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

const pass = results.filter((r) => r.status === "OK").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const warn = results.filter((r) => r.status === "WARN").length;
console.log(`\n=== QA: ${pass} OK, ${warn} WARN, ${fail} FAIL ===`);
console.log(`Report: ${join(OUT_DIR, "report.json")}`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
