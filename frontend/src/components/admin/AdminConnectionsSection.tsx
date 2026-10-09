import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadFailed } from "@/components/ui/load-failed";
import { reportReadFailure } from "@/lib/errors/handle";
import { fetchAdminDiagnostics, type AdminDiagnostics } from "@/lib/api/admin";

/**
 * Подключения: что настроено, а что нет — без показа ключей.
 *
 * Решение Ж4 от 09.10, часть Б3: «настройки подключений с признаком
 * „настроено или нет“ без показа ключей». До 09.10 это было только на
 * странице `/diag`, вне админки: владелец не видел ни состояния SMS, ни того,
 * на какой контур смотрит эквайринг.
 *
 * **Ключей здесь нет и быть не должно.** Сервер их и не отдаёт: ответ
 * диагностики содержит признаки `*_configured`, адрес денежного контура и
 * последний отказ SMS без номера получателя. Правило 8 раздела 2 файла
 * `RELEASE-RUN.md` запрещает печатать секреты, а `docs/known-issues.md`
 * помнит, почему: кеш конфигурации с паролем базы лежал читаемым для всех.
 *
 * **«Настроено» не значит «работает».** Это главное, что экран должен
 * сказать. Ключи SMS бывают на месте, а подпись отправителя не согласована —
 * и тогда код не приходит никому, а признак показывает «да». Поэтому строка
 * последнего отказа стоит рядом с признаком и важнее его (решение Ж5).
 */
export function AdminConnectionsSection() {
  const [data, setData] = useState<AdminDiagnostics | null>(null);
  const [состояние, setСостояние] = useState<"loading" | "ok" | "failed">("loading");

  const загрузить = () => {
    setСостояние("loading");
    fetchAdminDiagnostics()
      .then((d) => {
        setData(d);
        setСостояние("ok");
      })
      .catch((e) => {
        setСостояние("failed");
        reportReadFailure(e, "состояние подключений");
      });
  };

  useEffect(загрузить, []);

  if (состояние === "loading") {
    return (
      <Card className="p-5">
        <Loader2 size={18} className="animate-spin" />
      </Card>
    );
  }

  if (состояние === "failed" || !data) {
    return <LoadFailed onRetry={загрузить} />;
  }

  const и = data.integrations;
  const отказSms = и.sms_last_failure;

  return (
    <div className="space-y-3">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        «Настроено» означает, что ключи и имена на месте, — но не то, что подключение работает. Если
        был отказ, он показан рядом и важнее признака.
      </p>

      <Card className="p-4">
        <h3 className="mb-3 text-[15px] font-semibold">Приём денег</h3>
        <Строка имя="Поставщик" значение={и.billing_provider} />
        <Признак имя="ВТБ включён" ok={и.vtb_enabled} />
        <Признак имя="ВТБ настроен" ok={и.vtb_configured} />
        <Строка
          имя="Контур"
          значение={и.vtb_contour}
          /* Боевой контур от испытательного отличается только адресом, и
             именно забытая переменная однажды увела оплату в песочницу —
             поэтому контур назван словом, а не выведен из признаков. */
          тревога={и.vtb_contour !== "боевой"}
        />
        <Строка имя="Адрес" значение={и.vtb_api_url || "не задан"} />
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[15px] font-semibold">SMS</h3>
        <Строка имя="Шлюз" значение={и.sms_driver} />
        <Признак имя="Настроен" ok={и.sms_configured} />
        {отказSms ? (
          <div
            className="mt-3 rounded-[8px] p-3 text-[13px]"
            style={{ background: "var(--danger-soft)", color: "var(--foreground)" }}
            role="status"
          >
            <div className="font-medium">
              Последний отказ: {отказSms.our_fault ? "на нашей стороне" : "шлюз отклонил номер"}
            </div>
            <div style={{ color: "var(--foreground-70)" }}>
              {new Date(отказSms.at).toLocaleString("ru-RU")} · {отказSms.hint}
            </div>
            <code
              className="mt-1 block text-[11px]"
              style={{ color: "var(--foreground-50)", wordBreak: "break-all" }}
            >
              {отказSms.technical}
            </code>
          </div>
        ) : (
          <p className="mt-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Отказов за последнюю неделю не было.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[15px] font-semibold">Доставка СДЭК</h3>
        <Признак имя="Включена" ok={и.cdek_enabled} />
        <Признак имя="Настроена" ok={и.cdek_configured} />
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[15px] font-semibold">Службы</h3>
        {Object.entries(data.checks).map(([имя, с]) => (
          <Признак key={имя} имя={имя} ok={с.ok} />
        ))}
        <Строка имя="Окружение" значение={data.app.env} тревога={data.app.env !== "production"} />
      </Card>
    </div>
  );
}

function Признак({ имя, ok }: { имя: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-[4px] text-[13px]">
      <span style={{ color: "var(--foreground-70)" }}>{имя}</span>
      {/* Состояние названо словом, а не только точкой: цвет один из двух
          признаков, а не единственный. */}
      <span
        className="inline-flex items-center gap-[6px]"
        style={{ color: ok ? "var(--success)" : "var(--danger)" }}
      >
        <span
          aria-hidden
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: "currentColor" }}
        />
        {ok ? "да" : "нет"}
      </span>
    </div>
  );
}

function Строка({ имя, значение, тревога }: { имя: string; значение: string; тревога?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[4px] text-[13px]">
      <span style={{ color: "var(--foreground-70)" }}>{имя}</span>
      <span
        className="min-w-0 truncate text-right"
        style={{ color: тревога ? "var(--danger)" : "var(--foreground)" }}
        title={значение}
      >
        {значение}
      </span>
    </div>
  );
}
