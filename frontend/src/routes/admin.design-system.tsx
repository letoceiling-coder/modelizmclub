import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Home,
  Bell,
  Settings,
  Heart,
  Star,
  Search as SearchIcon,
  ChevronRight,
  Camera,
  ShieldCheck,
  Award,
  Wrench,
  Plane,
  Ship,
  Car,
} from "lucide-react";
import { Button, SplitButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/admin/design-system")({
  head: () => ({ meta: [{ title: "Design System — МоДелизМ" }] }),
  // Живая страница токенов доступна и в prod — только под админом.
  // Роль проверяется в компоненте по той же схеме, что и /admin (см. requireAdmin).
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: DesignSystemPage,
});

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-[var(--border)] py-12 first:pt-0 last:border-0"
    >
      <h2
        className="mb-6 text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, hex, varName }: { name: string; hex: string; varName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-20 w-full rounded-[var(--r-card-sm)] border border-[var(--border)]"
        style={{ background: `var(${varName})` }}
      />
      <div className="text-xs">
        <div className="font-semibold text-[var(--foreground)]">{name}</div>
        <div className="font-mono text-[var(--foreground-70)]">{hex}</div>
        <div className="font-mono text-[var(--foreground-50)]">{varName}</div>
      </div>
    </div>
  );
}

const navSections = [
  { id: "palette", label: "Палитра" },
  { id: "typography", label: "Типографика" },
  { id: "spacing", label: "Отступы" },
  { id: "buttons", label: "Кнопки" },
  { id: "badges", label: "Бейджи" },
  { id: "alerts", label: "Уведомления" },
  { id: "forms", label: "Формы" },
  { id: "cards", label: "Карточки" },
  { id: "navigation", label: "Навигация" },
  { id: "breakpoints", label: "Брейкпоинты" },
];

function DesignSystemPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"new" | "popular" | "near">("new");
  const [page, setPage] = useState(3);
  const [sidebarActive, setSidebarActive] = useState<"fleet" | "aviation" | "ships">("aviation");

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div>
            <Link
              to="/admin"
              className="text-xs text-[var(--foreground-70)] hover:text-[var(--accent)]"
            >
              ← Назад в админку
            </Link>
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Design System — UI Kit 2.0
            </h1>
          </div>
          <nav className="hidden flex-wrap gap-1 md:flex">
            {navSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--foreground-70)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-8">
        {/* ===== 1. Палитра ===== */}
        <Section id="palette" title="1. Цветовая палитра">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">
            Нейтральная шкала
          </h3>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-8">
            <Swatch name="Neutral 900" hex="#0F1519" varName="--neutral-900" />
            <Swatch name="Neutral 700" hex="var(--neutral-700)" varName="--neutral-700" />
            <Swatch name="Neutral 600" hex="var(--neutral-600)" varName="--neutral-600" />
            <Swatch name="Neutral 400" hex="var(--neutral-400)" varName="--neutral-400" />
            <Swatch name="Neutral 300" hex="var(--neutral-300)" varName="--neutral-300" />
            <Swatch name="Neutral 200" hex="var(--neutral-200)" varName="--neutral-200" />
            <Swatch name="Neutral 100" hex="var(--neutral-100)" varName="--neutral-100" />
            <Swatch name="Neutral 50" hex="var(--neutral-50)" varName="--neutral-50" />
          </div>

          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">Акценты</h3>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch name="Primary accent" hex="var(--accent)" varName="--accent" />
            <Swatch name="Primary hover" hex="#4F66E8" varName="--accent-hover" />
            <Swatch
              name="Commercial accent"
              hex="var(--accent-commercial)"
              varName="--accent-commercial"
            />
            <Swatch
              name="Commercial hover"
              hex="var(--accent-commercial-hover)"
              varName="--accent-commercial-hover"
            />
          </div>

          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">Семантика</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch name="Success" hex="зелёный" varName="--success" />
            <Swatch name="Warning" hex="оранжевый" varName="--warning" />
            <Swatch name="Error" hex="красный" varName="--danger" />
            <Swatch name="Info" hex="голубой" varName="--info" />
          </div>
        </Section>

        {/* ===== 2. Типографика ===== */}
        <Section id="typography" title="2. Типографика">
          <div className="space-y-5">
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h1)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Клуб авиамоделистов
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                H1 · Space Grotesk Bold · {`var(--fs-h1)`}
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h2)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Новая RC-яхта на стапеле
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                H2 · Space Grotesk Bold · {`var(--fs-h2)`}
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h3)",
                  fontWeight: 600,
                }}
              >
                Сборка двигателя ДВС 26 см³
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                H3 · Space Grotesk Medium · {`var(--fs-h3)`}
              </span>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)" }}>
                Сегодня испытали новую багги на трассе в Подольске — подвеска отработала отлично,
                сервоприводы держат нагрузку.
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                Body · Manrope Regular · {`var(--fs-body)`}
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-sm)",
                  color: "var(--foreground-70)",
                }}
              >
                Категория: Машиностроение · 120 товаров в наличии
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                Small · Manrope Regular · {`var(--fs-sm)`}
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-xs)",
                  color: "var(--foreground-50)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Опубликовано 2 часа назад
              </p>
              <span className="text-xs text-[var(--foreground-50)]">
                Caption · Manrope Medium · {`var(--fs-xs)`}
              </span>
            </div>
            <div>
              <Button>Написать продавцу</Button>
              <span className="ml-3 text-xs text-[var(--foreground-50)]">
                Button text · Manrope SemiBold · 14px
              </span>
            </div>
          </div>

          <h3 className="mb-3 mt-10 text-sm font-semibold text-[var(--foreground-70)]">
            Утилиты для контента (styles.css → @utility)
          </h3>
          <div className="space-y-4 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--background-elevated)] p-5">
            {[
              {
                cls: "text-card-title",
                spec: "20px / 1.3 / 600",
                sample: "Продам багги Kyosho Inferno MP10, готова к гонкам",
              },
              {
                cls: "text-body",
                spec: "16px / 1.5",
                sample:
                  "Полностью обслужена перед продажей: новые подшипники, свежее масло в амортизаторах, аккумулятор 2S держит заряд.",
              },
              {
                cls: "text-meta",
                spec: "14px / 1.4",
                sample: "Краснодар · Б/у · 18 000 ₽ · доставка СДЭК",
              },
              {
                cls: "text-caption",
                spec: "12px / 1.3",
                sample: "Опубликовано сегодня в 14:32 · 1 240 просмотров",
              },
            ].map((t) => (
              <div key={t.cls}>
                <p className={t.cls}>{t.sample}</p>
                <span className="text-xs text-[var(--foreground-50)]">
                  <code className="font-mono">.{t.cls}</code> · {t.spec}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== 3. Шкала отступов ===== */}
        <Section id="spacing" title="3. Шкала отступов">
          <p className="mb-5 text-sm text-[var(--foreground-70)]">
            Дефолтная шкала Tailwind v4:{" "}
            <code className="font-mono">--spacing = 0.25rem = 4px</code>. Она покрывает все значения
            проекта, поэтому точные px в классах отступов не нужны:{" "}
            <code className="font-mono">p-[12px] → p-3</code>. Линт предупреждает о новых px.
          </p>
          <div className="space-y-2">
            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12].map((step) => {
              const px = step * 4;
              return (
                <div key={step} className="flex items-center gap-4">
                  <code className="w-14 shrink-0 text-right font-mono text-xs text-[var(--foreground-70)]">
                    {step}
                  </code>
                  <div
                    className="h-4 shrink-0 rounded-sm bg-[var(--accent)]"
                    style={{ width: `${px}px` }}
                    aria-hidden
                  />
                  <span className="text-xs text-[var(--foreground-50)]">
                    {px}px ·{" "}
                    <code className="font-mono">
                      p-{step} / gap-{step} / m-{step}
                    </code>
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ===== 4. Кнопки ===== */}
        <Section id="buttons" title="4. Кнопки">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Подать объявление</Button>
            <Button variant="secondary">Сохранить черновик</Button>
            <Button variant="outline">Отменить</Button>
            <Button variant="ghost">Подробнее</Button>
            <Button variant="commercial">Поднять в ТОП</Button>
            <Button variant="destructive">Удалить модель</Button>
            <Button disabled>Недоступно</Button>
          </div>
          <h3 className="mb-3 mt-6 text-sm font-semibold text-[var(--foreground-70)]">
            Приоритеты (docs/design-system.md): primary → secondary → tertiary; detached — отдельно
            стоящая; icon — только иконка
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md">
              Написать
            </Button>
            <Button variant="secondary" size="md">
              Позвонить
            </Button>
            <Button variant="tertiary" size="md">
              Пожаловаться
            </Button>
            <Button variant="detached" size="md">
              Подписаться
            </Button>
            <Button variant="icon" size="icon" aria-label="В избранное">
              <Heart className="size-5" />
            </Button>
            <Button variant="icon" size="icon" aria-label="Поделиться">
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button>
              Смотреть каталог <ChevronRight className="size-4" />
            </Button>
            <SplitButton onDropdownClick={() => {}}>Действия с объявлением</SplitButton>
            <SplitButton variant="outline" onDropdownClick={() => {}}>
              Сортировка
            </SplitButton>
          </div>
          <h3 className="mb-3 mt-6 text-sm font-semibold text-[var(--foreground-70)]">
            Размеры: sm 36 · md 44 · icon 44×44 (тап-таргет). default 40 и lg 44 — legacy-имена для
            существующего кода
          </h3>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Button size="sm">sm · 36</Button>
            <Button size="md">md · 44</Button>
            <Button size="icon" variant="icon" aria-label="icon · 44">
              <Heart className="size-5" />
            </Button>
            <Button size="default" variant="outline">
              default · 40 (legacy)
            </Button>
            <Button size="lg" variant="outline">
              lg · 44 (legacy)
            </Button>
          </div>
        </Section>

        {/* ===== 5. Бейджи ===== */}
        <Section id="badges" title="5. Бейджи">
          <div className="flex flex-wrap gap-3">
            <Badge variant="top">ТОП</Badge>
            <Badge variant="top-outline">ТОП</Badge>
            <Badge variant="active">Активен</Badge>
            <Badge variant="error">Ошибка</Badge>
            <Badge variant="info">Инфо</Badge>
            <Badge variant="warning">Платное размещение</Badge>
            <Badge variant="moderation">На модерации</Badge>
            <Badge variant="published">Опубликовано</Badge>
            <Badge variant="draft">Черновик</Badge>
          </div>
        </Section>

        {/* ===== 6. Уведомления ===== */}
        <Section id="alerts" title="6. Уведомления / Alerts">
          <div className="space-y-3">
            <Alert variant="success">
              <AlertTitle>Объявление опубликовано</AlertTitle>
              <AlertDescription>
                «Самолёт Cessna 182, масштаб 1:6» теперь видно в каталоге.
              </AlertDescription>
            </Alert>
            <Alert variant="info">
              <AlertTitle>Важная информация</AlertTitle>
              <AlertDescription>
                Модерация объявлений в выходные занимает до 24 часов.
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Платное размещение истекает</AlertTitle>
              <AlertDescription>
                ТОП-позиция для «RC-катер Восход» закончится через 2 дня.
              </AlertDescription>
            </Alert>
            <Alert variant="error">
              <AlertTitle>Ошибка отправки</AlertTitle>
              <AlertDescription>
                Не удалось загрузить фото двигателя — файл превышает 10 МБ.
              </AlertDescription>
            </Alert>
          </div>
        </Section>

        {/* ===== 7. Формы ===== */}
        <Section id="forms" title="7. Формы">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Название модели</label>
              <Input placeholder="Например: Eachine E58 FPV дрон" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Поле в фокусе</label>
              <Input
                placeholder="Кликните, чтобы увидеть фокус"
                autoFocus
                className="ring-2 ring-[var(--accent-soft)] border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Цена закупки</label>
              <Input error defaultValue="0 руб" />
              <p className="mt-1 text-xs text-[var(--danger)]">Укажите цену больше нуля</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Поиск по каталогу</label>
              <SearchInput
                placeholder="Например: вертолёт, сервопривод, ДВС"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Описание лота</label>
              <Textarea
                placeholder="Опишите состояние модели, комплектацию и историю сборки"
                rows={4}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Категория</label>
              <select
                className="h-10 w-full rounded-[var(--r-input)] border border-[var(--border)] bg-[var(--background-input)] px-3 text-sm text-[var(--foreground)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
                defaultValue="aviation"
              >
                <option value="aviation">Авиамоделизм</option>
                <option value="ships">Судомоделизм</option>
                <option value="cars">Автомоделизм</option>
                <option value="drones">Дроны и FPV</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Фото модели</label>
              <div className="flex h-10 items-center gap-2 rounded-[var(--r-input)] border border-dashed border-[var(--border)] px-3 text-sm text-[var(--foreground-50)]">
                <Camera className="size-4" /> до 10 фото, JPG/PNG
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-card-sm)] border border-dashed border-[var(--border)] bg-[var(--background-elevated)] py-12 text-center">
              <Camera className="size-6 text-[var(--accent)]" />
              <p className="text-sm">
                <span className="cursor-pointer text-[var(--accent)] hover:underline">
                  Нажмите на ссылку
                </span>
                , чтобы выбрать фотографии или просто перетащите их сюда
              </p>
              <p className="text-xs text-[var(--foreground-50)]">
                Например, фото готовой модели «Як-52» с разных ракурсов
              </p>
            </div>
          </div>
        </Section>

        {/* ===== 8. Карточки ===== */}
        <Section id="cards" title="8. Карточки">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Default card
              </div>
              <div className="text-sm font-semibold">Сообщество «Авиамоделисты Москвы»</div>
              <p className="mt-1 text-sm text-[var(--foreground-70)]">
                312 участников · 18 новых постов на этой неделе
              </p>
            </Card>

            <Card airy className="p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Airy card
              </div>
              <div className="text-sm font-semibold">Мастер-класс: пайка регулятора оборотов</div>
              <p className="mt-1 text-sm text-[var(--foreground-70)]">
                Суббота, 14:00 · Клуб «Стапель»
              </p>
            </Card>

            <Card airy className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Stats card
              </div>
              <div
                className="mt-2 text-3xl font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                1 248
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <span className="text-[var(--success)]">+12% ↑</span>
                <span className="text-[var(--foreground-50)]">объявлений за месяц</span>
              </div>
            </Card>

            <Card airy className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Dashboard card
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { label: "RC-самолёты", value: 86 },
                  { label: "Танковые модели", value: 54 },
                  { label: "Парусники", value: 21 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card airy className="overflow-hidden p-0">
              <div className="flex h-32 items-center justify-center bg-[var(--accent-soft)]">
                <Plane className="size-10 text-[var(--accent)]" />
              </div>
              <div className="p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                  Listing card
                </div>
                <div className="text-sm font-semibold">Cessna 182, масштаб 1:6, ДВС 26см³</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--accent)]">42 000 ₽</span>
                  <Badge variant="top" withIcon>
                    ТОП
                  </Badge>
                </div>
              </div>
            </Card>

            <Card airy className="p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Post card
              </div>
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-foreground)]">
                  АТ
                </div>
                <div className="text-sm font-semibold">Анастасия Т.</div>
              </div>
              <p className="mt-2 text-sm text-[var(--foreground-70)]">
                Закончила обшивку фюзеляжа планера — на очереди покраска и установка авионики.
              </p>
              <div className="mt-2 flex items-center gap-4 text-xs text-[var(--foreground-50)]">
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" /> 24
                </span>
                <span className="flex items-center gap-1">
                  <Star className="size-3.5" /> 4.9
                </span>
              </div>
            </Card>

            <Card airy className="p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-50)]">
                Community card
              </div>
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-[var(--r-card-sm)] bg-[var(--accent-soft)]">
                  <Ship className="size-5 text-[var(--accent)]" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Судомоделисты Невы</div>
                  <div className="text-xs text-[var(--foreground-50)]">128 участников</div>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ===== 9. Навигация ===== */}
        <Section id="navigation" title="9. Навигация (preview)">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">
            Sidebar — состояния
          </h3>
          <div className="mb-8 max-w-xs space-y-1 rounded-[var(--r-card-sm)] border border-[var(--border)] bg-[var(--background-elevated)] p-2">
            {[
              { id: "fleet" as const, label: "Автомоделизм", icon: Car },
              { id: "aviation" as const, label: "Авиамоделизм", icon: Plane },
              { id: "ships" as const, label: "Судомоделизм", icon: Ship },
            ].map((item) => {
              const Icon = item.icon;
              const active = sidebarActive === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSidebarActive(item.id)}
                  className="flex w-full items-center gap-2.5 rounded-[var(--r-button)] px-3 py-2 text-sm transition-colors"
                  style={{
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent)" : "var(--foreground-70)",
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--background-surface)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="-mt-6 mb-8 text-xs text-[var(--foreground-50)]">
            Кликните пункт, чтобы увидеть active-состояние; наведите курсор — hover.
          </p>

          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">Tabs</h3>
          <div className="mb-8 inline-flex rounded-[var(--r-button)] border border-[var(--border)] bg-[var(--background-elevated)] p-1">
            {[
              { id: "new" as const, label: "Новые" },
              { id: "popular" as const, label: "Популярные" },
              { id: "near" as const, label: "Рядом" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="rounded-[calc(var(--r-button)-2px)] px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: tab === t.id ? "var(--accent)" : "transparent",
                  color: tab === t.id ? "var(--accent-foreground)" : "var(--foreground-70)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground-70)]">Пагинация</h3>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className="grid size-9 place-items-center rounded-[var(--r-button)] text-sm font-medium transition-colors"
                style={{
                  background: page === n ? "var(--accent)" : "transparent",
                  color: page === n ? "var(--accent-foreground)" : "var(--foreground-70)",
                  border: page === n ? "none" : "1px solid var(--border)",
                }}
              >
                {n}
              </button>
            ))}
            <Button variant="outline" size="sm">
              Дальше
            </Button>
          </div>
        </Section>

        {/* ===== 10. Брейкпоинты ===== */}
        <Section id="breakpoints" title="10. Брейкпоинты и ширины контента">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--foreground-50)]">
                  <th className="py-2 pr-4 font-semibold">Точка</th>
                  <th className="py-2 pr-4 font-semibold">Tailwind</th>
                  <th className="py-2 pr-4 font-semibold">Раскладка</th>
                  <th className="py-2 font-semibold">Ширина контента</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-[var(--border)] [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top">
                <tr>
                  <td className="font-mono">375</td>
                  <td className="font-mono">(base)</td>
                  <td>
                    Одна колонка, нижняя навигация, шапка{" "}
                    <code className="font-mono">--mobile-header-h</code>
                  </td>
                  <td>100% − 2 × 16px</td>
                </tr>
                <tr>
                  <td className="font-mono">768</td>
                  <td className="font-mono">md:</td>
                  <td>Одна колонка шире, сетки 2 в ряд, боковые панели скрыты</td>
                  <td>100% − 2 × 24px</td>
                </tr>
                <tr>
                  <td className="font-mono">1280</td>
                  <td className="font-mono">xl:</td>
                  <td>
                    Sidebar <code className="font-mono">--sidebar-w</code> 240 + контент + rightbar{" "}
                    <code className="font-mono">--rightbar-w</code> 260
                  </td>
                  <td>
                    до <code className="font-mono">--container-max</code> 1560, поля{" "}
                    <code className="font-mono">--container-pad</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[var(--foreground-50)]">
            Mobile-first: базовые классы — для 375, модификаторы{" "}
            <code className="font-mono">md:</code> и <code className="font-mono">xl:</code>{" "}
            добавляют, а не переопределяют. Промежуточный <code className="font-mono">lg:</code>{" "}
            (1024) используется точечно для появления сайдбара.
          </p>
        </Section>

        <footer className="flex items-center gap-2 pb-12 pt-6 text-xs text-[var(--foreground-50)]">
          <ShieldCheck className="size-3.5" />
          Внутренняя страница превью — не индексируется и не используется на публичных страницах
          сайта.
          <Award className="size-3.5 ml-2" />
          <Wrench className="size-3.5" />
          <SearchIcon className="size-3.5" />
          <Home className="size-3.5" />
          <Bell className="size-3.5" />
          <Settings className="size-3.5" />
        </footer>
      </div>
    </div>
  );
}
