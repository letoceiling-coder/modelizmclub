import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fetchAdminDiagnostics, type AdminDiagnostics } from "@/lib/api/admin";
import { isAdminUser } from "@/lib/auth/verification";
import { getSessionUser } from "@/lib/session";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/diag")({
  beforeLoad: async ({ location }) => {
    await requireAdmin(location);
  },
  component: DiagPage,
});

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: ok ? "#22c55e" : "#ef4444" }}
      aria-hidden
    />
  );
}

function DiagPage() {
  const [data, setData] = useState<AdminDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = getSessionUser();
  const allowed = isAdminUser(me);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    fetchAdminDiagnostics()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить диагностику");
      });
    return () => {
      alive = false;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16">
        <h1 className="font-display text-2xl font-bold">Нет доступа</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--foreground-70)" }}>
          Страница диагностики доступна только администраторам.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm underline"
          style={{ color: "var(--accent)" }}
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-12">
      <h1 className="font-display text-[28px] font-bold">Диагностика</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--foreground-50)" }}>
        Состояние сервисов. Секреты не показываются.
      </p>
      {error ? (
        <p className="mt-6 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <p className="mt-6 text-sm" style={{ color: "var(--foreground-50)" }}>
          Загрузка…
        </p>
      ) : null}
      {data ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Приложение</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt style={{ color: "var(--foreground-50)" }}>Имя</dt>
              <dd>{data.app.name}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>Окружение</dt>
              <dd>{data.app.env}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>Laravel</dt>
              <dd>{data.app.laravel}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>PHP</dt>
              <dd>{data.app.php}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>Статус</dt>
              <dd className="inline-flex items-center gap-2">
                <StatusDot ok={data.status === "ok"} />
                {data.status}
              </dd>
            </dl>
          </section>
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Проверки</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(data.checks).map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <StatusDot ok={value.ok} />
                  <span>{key}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Интеграции</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt style={{ color: "var(--foreground-50)" }}>Биллинг</dt>
              <dd>{data.integrations.billing_provider}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>ВТБ включён</dt>
              <dd>{data.integrations.vtb_enabled ? "да" : "нет"}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>ВТБ настроен</dt>
              <dd className="inline-flex items-center gap-2">
                <StatusDot ok={data.integrations.vtb_configured} />
                {data.integrations.vtb_configured ? "да" : "нет"}
              </dd>
              <dt style={{ color: "var(--foreground-50)" }}>СДЭК включён</dt>
              <dd>{data.integrations.cdek_enabled ? "да" : "нет"}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>СДЭК настроен</dt>
              <dd className="inline-flex items-center gap-2">
                <StatusDot ok={data.integrations.cdek_configured} />
                {data.integrations.cdek_configured ? "да" : "нет"}
              </dd>
              <dt style={{ color: "var(--foreground-50)" }}>SMS</dt>
              <dd>{data.integrations.sms_driver}</dd>
              <dt style={{ color: "var(--foreground-50)" }}>SMS настроен</dt>
              <dd className="inline-flex items-center gap-2">
                <StatusDot ok={data.integrations.sms_configured} />
                {data.integrations.sms_configured ? "да" : "нет"}
              </dd>
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
