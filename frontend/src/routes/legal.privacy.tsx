import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — МоДелизМ Форум" },
      { name: "description", content: "Как МоДелизМ Форум собирает, хранит и использует данные пользователей." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>← На главную</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>
        Политика обработки данных
      </h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>
        Демонстрационная редакция. Действующая редакция будет опубликована при запуске продакшен-версии.
      </p>

      <section className="mt-[28px] space-y-[20px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        <Block title="1. Какие данные мы собираем">
          Имя, email, аватар, контент, который вы публикуете, а также техническая информация о сессии (IP, устройство, браузер).
        </Block>
        <Block title="2. Зачем нам данные">
          Авторизация, персонализация ленты, защита от мошенничества, аналитика качества сервиса.
        </Block>
        <Block title="3. Передача третьим лицам">
          Мы не продаём ваши данные. Передача возможна только по требованию закона или с явного согласия пользователя.
        </Block>
        <Block title="4. Хранение и удаление">
          Данные хранятся в течение жизни аккаунта. Удалить аккаунт и связанные данные можно из настроек профиля или по запросу.
        </Block>
        <Block title="5. Cookies">
          Используем cookies для авторизации, сохранения настроек интерфейса и базовой аналитики.
        </Block>
        <Block title="6. Контакты">
          Запросы по обработке данных: <a href="mailto:privacy@modelizm.club" style={{ color: "var(--accent)" }}>privacy@modelizm.club</a>
        </Block>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
      <p style={{ color: "var(--foreground-70)", marginTop: 4 }}>{children}</p>
    </div>
  );
}
