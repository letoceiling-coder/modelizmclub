import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, LifeBuoy, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";

// Lightweight premium placeholder pages for the footer's info/legal links.
// One dynamic route covers them all — content is keyed by slug.
const PAGES: Record<string, { title: string; desc: string }> = {
  about: { title: "О нас", desc: "МоДелизМ — маркетплейс, лента и сообщество для моделистов России. Мы объединяем тех, кто строит, летает и гоняет." },
  company: { title: "О компании", desc: "Юридическая и организационная информация о проекте МоДелизМ. Реквизиты и данные компании появятся при запуске продакшен-версии." },
  partners: { title: "Партнёрам", desc: "Сотрудничество с магазинами, брендами и клубами. Совместные акции, витрины и каналы для брендов моделизма." },
  advertising: { title: "Размещение рекламы", desc: "Форматы продвижения на платформе: баннеры, продвинутые объявления и брендовые каналы. Медиакит в подготовке." },
  compliance: { title: "Compliance", desc: "Принципы соответствия требованиям законодательства РФ, модерация контента и правила безопасной сделки." },
  consent: { title: "Согласие на обработку персональных данных", desc: "Условия обработки персональных данных пользователей платформы МоДелизМ." },
  support: { title: "Служба поддержки", desc: "Мы на связи каждый день с 10:00 до 20:00 МСК. Напишите нам — поможем с аккаунтом, объявлением или сделкой." },
  feedback: { title: "Обратная связь", desc: "Ваши идеи и замечания делают платформу лучше. Оставьте отзыв или сообщите о проблеме." },
};

export const Route = createFileRoute("/info/$slug")({
  head: () => ({ meta: [{ title: "Информация — МоДелизМ" }] }),
  component: InfoPage,
});

function InfoPage() {
  const { slug } = useParams({ from: "/info/$slug" });
  const page = PAGES[slug] ?? {
    title: "Страница в подготовке",
    desc: "Этот раздел скоро появится. Пока вы можете вернуться на главную или написать в поддержку.",
  };

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}>
      <header className="mx-auto flex h-[64px] max-w-[900px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <Link to="/"><Logo size={28} /></Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--foreground-70)" }}>
          <ArrowLeft size={15} /> На главную
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-16">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
          <FileText size={13} /> Информация
        </div>
        <h1 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {page.title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--foreground-70)", maxWidth: 560 }}>
          {page.desc}
        </p>

        <div className="mt-8 flex items-center gap-2 rounded-[var(--r-card)] p-4"
          style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          <span className="grid place-items-center rounded-full" style={{ width: 36, height: 36, background: "var(--accent-soft)", color: "var(--accent)" }}>
            <LifeBuoy size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold">Документ в подготовке</div>
            <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Действующая редакция будет опубликована при запуске продакшен-версии.
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/help" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}>
            <LifeBuoy size={15} /> Написать в поддержку
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <ArrowLeft size={15} /> Вернуться на главную
          </Link>
        </div>
      </main>
    </div>
  );
}
