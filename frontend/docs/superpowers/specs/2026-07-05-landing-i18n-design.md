# Landing i18n — Design Spec

## Контекст

Раунд C из премиум-бэклога (после A+B). Лендинг (`frontend/src/routes/index.tsx`,
822 строки) сейчас полностью на русском хардкоде — **ноль** `t()`-вызовов, ~65
видимых строк в hero + 8 секциях + футере + data-массивах. Приложение уже имеет
рабочую i18n-инфраструктуру (i18next, локали ru/en/zh в
`src/lib/i18n/locales/*.ts`, единый namespace `translation`, dot-path ключи,
`setLocale` → localStorage `mc_lang`), но лендинг к ней не подключён, и
`LanguageSwitcher` с лендинга был убран в прошлом раунде (тогда — из-за
отсутствия перевода).

Этот спек: подключить лендинг к i18n (все видимые строки → `t()`), добавить
поддерево `landing.*` во все три локали с профессиональным en/zh переводом,
вернуть `LanguageSwitcher` на топ-нав лендинга.

## Решения (утверждены)

- **SEO-мета остаётся русской.** `head()` в TanStack Router выполняется вне
  React — `t()`/хук там недоступны без усложнения SSR. `title`/`description` в
  `Route.head()` НЕ трогаем. Локализуется только видимый UI.
- **Бренд латиницей, категории переводим.** «МоДелизМ» → «Modelizm» в en/zh
  (в ru остаётся «МоДелизМ»). Категории и весь остальной текст — полноценный
  смысловой перевод (Авиация → Aviation → 航空).
- **Валюта ₽ сохраняется** во всех локалях (цены в рублях). `toLocaleString`
  остаётся `"ru-RU"` для разрядов (не завязано на UI-язык — демо-данные).

## Архитектура

Три файла локалей получают новый ключ `landing`. `index.tsx` переписывается так,
что **весь видимый текст** читается через `t("landing.…")`. Module-level
data-массивы (`QUICK`, `CATEGORIES`, `STEPS`, `PLANS`, `VALUES`, `FAQ`,
`FOOTER_COLS`, hero-stats) сохраняют **только не-текстовую идентичность** (иконка
+ route + стабильный строковый `key`); отображаемый текст берётся при рендере
через `t()`. Иконки (lucide-компоненты) и routes остаются в коде — они не могут
жить в JSON/локали.

Каждый компонент-секция, который сейчас читает хардкод, получает
`const { t } = useTranslation();`.

## Структура ключей `landing`

Единая форма для всех трёх локалей (значения — переведённые строки):

```
landing: {
  nav: {
    ads, communities, channels, how, subscription,   // ссылки топ-нава
    login, register, demo,                            // кнопки (demo = "Открыть демо"/"Open demo"/"打开演示")
    menu,                                             // aria-label бургер-меню
  },
  hero: {
    brand,        // "МоДелизМ" / "Modelizm" / "Modelizm"
    tagline,      // "Маркетплейс, лента и сообщество для моделистов"
    subtitle,     // "Покупайте модели и запчасти…"
    ctaBrowse,    // "Смотреть объявления"
    scroll,       // "Листайте"
    stats: { modelers, communities, categories },  // подписи под числами (числа остаются в коде)
  },
  quick: {
    eyebrow,      // "Всё в одном месте"
    title,        // "Что есть в МоДелизМ"
    subtitle,     // "Шесть инструментов…"
    open,         // "Открыть"
    items: {
      ads:        { title, desc },
      feed:       { title, desc },
      communities:{ title, desc },
      channels:   { title, desc },
      messenger:  { title, desc },
      events:     { title, desc },
    },
  },
  listings: {
    eyebrow,      // "Маркетплейс"
    title,        // "Популярные объявления"
    all,          // "Все объявления"
    photoSoon,    // "Фото скоро"
  },
  categories: {
    eyebrow,      // "Категории"
    title,        // "Всё, что движется и летает"
    countSuffix,  // "объявлений" (после числа "180+")
    items: {
      aviation, cars, ships, railways, engines, radio, parts, tools,  // только name
    },
  },
  steps: {
    eyebrow,      // "Как это работает"
    title,        // "Три шага до сообщества"
    items: {
      direction: { title, desc },
      find:      { title, desc },
      share:     { title, desc },
    },
  },
  pricing: {
    eyebrow,      // "Тарифы"
    title,        // "Простая подписка"
    subtitle,     // "Базовые возможности бесплатны…"
    recommended,  // "Рекомендуем"
    more,         // "Подробнее"
    plans: {
      start: { name, price, period, features },  // features: string[]
      month: { name, price, period, features },
      year:  { name, price, period, features },
    },
  },
  values: {
    eyebrow,      // "Почему МоДелизМ"
    title,        // "Почему моделисты выбирают нас"
    items: {
      focus:     { title, desc },
      community:  { title, desc },
      allInOne:   { title, desc },
      direct:     { title, desc },
    },
  },
  faq: {
    eyebrow,      // "Вопросы"
    title,        // "Часто спрашивают"
    items: [ { q, a }, { q, a }, { q, a }, { q, a }, { q, a } ],  // 5 шт, массив
  },
  footer: {
    tagline,      // "Маркетплейс, лента и сообщество… остальное детали."
    theme,        // "Тема"
    contacts,     // "Контакты"
    hours,        // "Пн–Вс, 10:00–20:00 МСК"
    cols: {
      brand:   { title, links: { about, company, partners, advertising } },
      docs:    { title, links: { rules, privacy, compliance, consent } },
      support: { title, links: { faq, support, feedback, contact } },
    },
  },
  card: {
    hide,          // "Скрыть"
    notInterested, // "Не интересно"
    report,        // "Пожаловаться"
    favAdd,        // "В избранное"
    favRemove,     // "Убрать из избранного"
    adMenu,        // "Меню объявления" (aria)
  },
}
```

### Списочные значения
- `landing.pricing.plans.<k>.features` и `landing.faq.items` — массивы. Читать
  через `t("landing.pricing.plans.start.features", { returnObjects: true }) as string[]`
  и `t("landing.faq.items", { returnObjects: true }) as { q: string; a: string }[]`.

## Изменения в `index.tsx`

### Data-массивы → идентичность без текста
- `NAV_LINKS`: `{ to, key }` где `key ∈ {ads,communities,channels,how,subscription}`;
  label читается `t("landing.nav."+key)`. (Для `#how` route остаётся `"#how"`.)
- `QUICK`: `{ icon, to, key }`, `key ∈ {ads,feed,communities,channels,messenger,events}`.
- `CATEGORIES`: `{ icon, key, count }`, `key ∈ {aviation,cars,ships,railways,engines,radio,parts,tools}`.
  `count` (строка "180+") остаётся в коде.
- `STEPS`: `{ icon, key }`, `key ∈ {direction,find,share}`.
- `PLANS`: `{ icon?, key, accent? }`, `key ∈ {start,month,year}`; name/price/period/features
  из локали. (`price`/`period` — переводимые, т.к. "0 ₽"/"от 99 ₽"/"пробный период".)
- `VALUES`: `{ icon, key }`, `key ∈ {focus,community,allInOne,direct}`.
- `FAQ`: убрать массив-хардкод; рендер по `t("landing.faq.items", {returnObjects:true})`.
- `FOOTER_COLS`: `{ key, links: { to, labelKey }[] }` — title и label из локали;
  routes (`to`) остаются в коде.
- hero stats массив: `{ n, key }`, `key ∈ {modelers,communities,categories}`; подпись
  из `t("landing.hero.stats."+key)`. Число `n` остаётся в коде.
- Hero H1 рендерит `t("landing.hero.brand")` вместо литерала «МоДелизМ».

### `t()` в каждом компоненте-секции
`TopNav`, `Hero`, `QuickSections`, `PopularListings`, `LandingListingCard`,
`CategoriesSection`, `StepsTimeline`, `PricingSection`, `WhyChoose`, `FaqSection`,
`Footer` — каждый добавляет `const { t } = useTranslation();` и заменяет литералы.

### LanguageSwitcher на лендинге
- Импорт `import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";`.
- Desktop: в блоке right-controls `TopNav` — перед кнопкой «Войти» (`enter.login`).
- Mobile: внутри `motion.div`-шита меню, отдельной строкой сверху или снизу списка
  ссылок.
- Компонент уже вызывает `setLocale` (меняет `i18n.changeLanguage` + persist в
  `mc_lang` + `document.lang`), поэтому переключение работает мгновенно на всём
  лендинге и переживает reload.

### Что НЕ меняется в `index.tsx`
- `Route.head()` мета (остаётся русской).
- Все inline-стили, motion-варианты, `cardStyle`/`ctaPrimary`/`mutedP` и пр.
- `ad.price.toLocaleString("ru-RU")`, `CONDITION_COLOR` (завязан на demo-строку
  `"Новое"` — данные, не UI; трогать нельзя, иначе сломается сравнение цвета).
  `alt`-тексты картинок из `ad.title` — данные, не переводим.

## Перевод (качество)

Профессиональный идиоматичный перевод, не дословный. en — естественный
маркетинговый английский; zh — упрощённый китайский (Simplified). Примеры
направления:
- «Всё, что движется и летает» → "Everything that moves and flies" → 「一切会动会飞的」
- «Три шага до сообщества» → "Three steps to the community" → 「加入社区，三步搞定」
- Категории: Авиация/Aviation/航空, Автомодели/Cars/车辆模型, Судомодели/Ships/船舶模型,
  Железные дороги/Railways/铁路模型, Двигатели/Engines/发动机, Аппаратура/Radio Gear/
  遥控设备, Запчасти/Parts/配件, Инструменты/Tools/工具.

## Тестирование / приёмка

- `npx tsc --noEmit` чист.
- На лендинге виден `LanguageSwitcher` (desktop + mobile).
- Переключение ru→en→zh меняет ВЕСЬ видимый текст лендинга (hero, все 8 секций,
  футер); reload сохраняет выбранный язык.
- Ни одной «сырой» русской строки не остаётся в en/zh рендере (кроме бренда-цены
  ₽ и demo-данных объявлений — они не в scope).
- SEO-title страницы остаётся русским во всех локалях (сознательно).

## Ручной QA

Desktop 1440 + mobile 390: (1) переключить язык на en → hero, «What's in
Modelizm», категории, тарифы, FAQ, футер — всё на английском; (2) на zh — всё
на китайском; (3) F5 на en → лендинг остаётся английским; (4) вернуть ru → всё
по-русски; (5) горизонтального оверфлоу нет ни в одной локали (китайский/
английский длиннее/короче — проверить переносы в карточках и кнопках).

## Вне scope

- SEO-мета (head) — русская.
- Любой роут кроме `/` (`index.tsx`).
- Перевод demo-данных объявлений (title/city/condition).
- Формат цены (₽ + ru-RU разряды).
