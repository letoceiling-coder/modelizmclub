import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { fetchTariffs, type TariffsData } from "@/lib/api/rules";
import i18n from "@/lib/i18n";

const SITE_ORIGIN = "https://modelizmclub.ru";
const META_DESCRIPTION =
  "Стоимость платных услуг Моделизма: подписка, размещение объявления, продвижение, комиссия безопасной сделки.";

/**
 * Страница стоимости платных услуг.
 *
 * Нужна банку-эквайеру и статье 10 ЗоЗПП: цена в рублях и условия
 * приобретения должны быть опубликованы. Ни одного числа на этой странице не
 * записано — всё приходит из `/public/tariffs`, то есть из тех же настроек,
 * по которым считается оплата. Захардкоженная таблица разошлась бы с
 * действительностью при первом изменении тарифа, а на эту страницу ссылается
 * оферта.
 *
 * Пояснительные тексты — тоже не здесь: условия, порядок списания и отмены
 * живут документами в админке и правятся без выкатки. Здесь только цены и
 * ссылки на документы.
 */
export const Route = createFileRoute("/rules/tariffs")({
  loader: () => fetchTariffs(),
  head: () => ({
    meta: [
      { title: `Тарифы и стоимость услуг — ${i18n.t("common.appName")}` },
      { name: "description", content: META_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/rules/tariffs` }],
  }),
  component: TariffsPage,
});

function rub(cents: number): string {
  return (cents / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function periodLabel(days: number): string {
  if (days % 365 === 0) return days / 365 === 1 ? "год" : `${days / 365} года`;
  if (days % 30 === 0) return days / 30 === 1 ? "месяц" : `${days / 30} мес.`;
  return `${days} дн.`;
}

function Row({ name, price, note }: { name: string; price: string; note?: string }) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-4 py-3.5"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
          {name}
        </div>
        {note && (
          <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--foreground-60)" }}>
            {note}
          </p>
        )}
      </div>
      <div
        className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums"
        style={{ color: "var(--foreground)" }}
      >
        {price}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
        {title}
      </h2>
      <div
        className="mt-3 divide-y rounded-[var(--r-card)] border"
        style={{ borderColor: "var(--border)" }}
      >
        {children}
      </div>
    </section>
  );
}

function TariffsPage() {
  const t: TariffsData = Route.useLoaderData();

  const feePercent = t.safe_deal.percent;
  const feeMin = t.safe_deal.min_cents;

  return (
    <div
      style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}
    >
      <header
        className="mx-auto flex h-[64px] max-w-[960px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link to="/">
          <Logo size={28} />
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--foreground-70)" }}
        >
          <ArrowLeft size={15} /> На главную
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-12">
        <nav
          className="mb-6 flex items-center gap-1 text-[12.5px]"
          style={{ color: "var(--foreground-50)" }}
          aria-label="Хлебные крошки"
        >
          <Link to="/rules" className="rounded-md px-1.5 py-0.5">
            Правила
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <span aria-current="page" className="px-1.5 py-0.5 font-semibold">
            Тарифы
          </span>
        </nav>

        <h1
          className="font-display font-extrabold"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Тарифы и стоимость услуг
        </h1>
        <p
          className="mt-4 max-w-[62ch] text-[15px] leading-relaxed"
          style={{ color: "var(--foreground-70)" }}
        >
          Все цены указаны в рублях и включают все налоги. Оплата — банковской картой.
        </p>

        <Section title="Подписка">
          {t.subscriptions.length === 0 && (
            <div className="px-4 py-3.5 text-[14px]" style={{ color: "var(--foreground-50)" }}>
              Тарифы подписки временно недоступны.
            </div>
          )}
          {t.subscriptions.map((plan) => (
            <Row
              key={plan.slug}
              name={plan.name}
              price={`${rub(plan.price_cents)} ₽ / ${periodLabel(plan.period_days)}`}
            />
          ))}
        </Section>

        <Section title="Размещение объявления">
          <Row
            name="Без подписки"
            price={`${rub(t.placement.without_subscription_cents)} ₽`}
            note="За одно объявление."
          />
          <Row
            name="С активной подпиской"
            price={`${rub(t.placement.with_subscription_cents)} ₽`}
            note="За одно объявление."
          />
        </Section>

        {t.boost.length > 0 && (
          <Section title="Продвижение объявления">
            {t.boost.map((b) => (
              <Row key={b.id} name={b.label} price={`${rub(b.price_cents)} ₽`} />
            ))}
          </Section>
        )}

        {t.safe_deal.enabled && (
          <Section title="Безопасная сделка">
            <Row
              name="Комиссия сервиса"
              price={`${feePercent}%`}
              note={`Не менее ${rub(feeMin)} ₽ за сделку.${
                t.safe_deal.max_cents ? ` Не более ${rub(t.safe_deal.max_cents)} ₽.` : ""
              }${
                t.safe_deal.base === "item"
                  ? " Считается от стоимости товара; доставка в расчёт комиссии не входит."
                  : ""
              }`}
            />
            <Row
              name="Доставка"
              price="по тарифу перевозчика"
              note="Стоимость доставки рассчитывает СДЭК при оформлении. Площадка её не увеличивает."
            />
          </Section>
        )}

        <div
          className="mt-10 rounded-[var(--r-card)] border p-4 text-[13.5px] leading-relaxed"
          style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
        >
          Условия оказания услуг, порядок списания, продления и отмены — в{" "}
          <Link to="/rules/$slug" params={{ slug: "services-offer" }} className="underline">
            оферте на платные услуги
          </Link>
          . Порядок оплаты — на странице{" "}
          <Link to="/payment" className="underline">
            «Оплата»
          </Link>
          , порядок возврата — на странице{" "}
          <Link to="/refund" className="underline">
            «Возврат»
          </Link>
          . Правила безопасной сделки —{" "}
          <Link to="/rules/$slug" params={{ slug: "safe-deal" }} className="underline">
            здесь
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
