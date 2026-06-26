import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/rules")({
  head: () => ({
    meta: [
      { title: "Правила сообщества — МоДелизМ Форум" },
      { name: "description", content: "Правила публикации, общения и поведения в сообществе МоДелизМ Форум." },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>← На главную</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>
        Правила сообщества
      </h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>
        Эти правила обеспечивают комфортное общение всех участников МоДелизМ Форум.
      </p>

      <section className="mt-[28px] space-y-[18px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        <Rule n="1" title="Уважение к участникам">
          Запрещены оскорбления, угрозы, разжигание ненависти и дискриминация по любому признаку.
        </Rule>
        <Rule n="2" title="Тематика публикаций">
          Размещайте материалы по теме моделизма: модели, технологии, обзоры, события, мастер-классы.
        </Rule>
        <Rule n="3" title="Без спама и накруток">
          Запрещены массовые рассылки, накрутка реакций, фальшивые отзывы и реклама вне раздела «Объявления».
        </Rule>
        <Rule n="4" title="Достоверность">
          Не публикуйте заведомо ложную информацию о товарах, продавцах и брендах.
        </Rule>
        <Rule n="5" title="Авторские права">
          Не размещайте чужой контент без согласия автора и указания источника.
        </Rule>
        <Rule n="6" title="Модерация">
          Команда модераторов может скрывать материалы, нарушающие правила. Повторные нарушения — блокировка аккаунта.
        </Rule>
      </section>

      <p className="mt-[32px]" style={{ color: "var(--foreground-50)", fontSize: 13 }}>
        Вопросы и жалобы: <a href="mailto:support@modelizm.club" style={{ color: "var(--accent)" }}>support@modelizm.club</a>
      </p>
    </main>
  );
}

function Rule({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-[14px]">
      <span
        className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full font-semibold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13 }}
      >
        {n}
      </span>
      <div>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
        <p style={{ color: "var(--foreground-70)", marginTop: 2 }}>{children}</p>
      </div>
    </div>
  );
}
