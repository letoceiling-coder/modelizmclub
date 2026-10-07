import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { fetchAdminPlansDetailed, updateAdminPlan, type AdminPlanRow } from "@/lib/api/admin";
import { reportReadFailure } from "@/lib/errors/handle";

type CardStyle = React.CSSProperties;

/**
 * Описания тарифов.
 *
 * ТОЛЬКО ОПИСАНИЕ. Решение владельца от 05.10: из админки правится текст, а
 * цены, сроки и состав тарифов — нет. Поэтому здесь нет ни поля цены, ни
 * периода, ни признака активности: их нельзя поменять по недосмотру, потому
 * что их тут не существует. Цена приходит с сервера и показана только для
 * того, чтобы человек понимал, какой тариф правит.
 *
 * Зачем экран вообще появился: описание тарифа отдаётся публичным
 * `GET /api/v1/plans`, и у базового тарифа там стоял текст «Бесплатный тариф
 * для Swagger-тестов» — название внутреннего инструмента читал любой
 * посетитель. Сервер правку принимал и раньше (`UpdatePlanRequest` знает
 * `description`), но в клиенте поля не было, и поменять текст было нельзя
 * ниоткуда, кроме базы.
 */
export function PlanDescriptionsAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [черновики, setЧерновики] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [ошибка, setОшибка] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setОшибка(false);
    fetchAdminPlansDetailed()
      .then((rows) => {
        setPlans(rows);
        setЧерновики(Object.fromEntries(rows.map((r) => [r.slug, r.description])));
      })
      .catch((e) => {
        // Состояние показываем сами: помощник только записывает отказ.
        setОшибка(true);
        reportReadFailure(e, "тарифы для правки описаний");
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const save = async (plan: AdminPlanRow) => {
    const текст = (черновики[plan.slug] ?? "").trim();
    setSaving(plan.slug);
    try {
      await updateAdminPlan(plan.slug, { description: текст });
      // Сохранённое значение кладём в список, иначе «Сохранить» останется
      // доступной и человек не поймёт, прошла ли правка.
      setPlans((prev) =>
        prev.map((p) => (p.slug === plan.slug ? { ...p, description: текст } : p)),
      );
      toast.success(`Описание тарифа «${plan.name}» сохранено`);
    } catch {
      toast.error(`Не удалось сохранить описание тарифа «${plan.name}»`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={cardStyle}>
      <h3 className="mb-1 text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
        Описания тарифов
      </h3>
      <p className="mb-4 text-[13px]" style={{ color: "var(--foreground-60)" }}>
        Текст видно всем на странице подписки. Цены, сроки и состав тарифов здесь не меняются.
      </p>

      {loading ? (
        <p className="text-[13px]" style={{ color: "var(--foreground-60)" }}>
          Загрузка…
        </p>
      ) : ошибка ? (
        <div className="flex items-center gap-3">
          <p className="text-[13px]" style={{ color: "var(--foreground-60)" }}>
            Не удалось загрузить тарифы.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Повторить
          </Button>
        </div>
      ) : plans.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--foreground-60)" }}>
          Тарифов нет.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {plans.map((plan) => {
            const черновик = черновики[plan.slug] ?? "";
            const изменено = черновик.trim() !== plan.description.trim();
            return (
              <div key={plan.slug} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                    {plan.name}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {Math.round(plan.priceCents / 100)} ₽ · {plan.periodDays} дн.
                  </span>
                </div>
                <textarea
                  value={черновик}
                  onChange={(e) =>
                    setЧерновики((prev) => ({ ...prev, [plan.slug]: e.target.value }))
                  }
                  rows={2}
                  // 16px на телефоне: иначе iOS увеличивает страницу при фокусе.
                  className="w-full resize-y rounded-[10px] border px-3 py-2 text-[16px] sm:text-[14px]"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  placeholder="Описание тарифа"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!изменено}
                    loading={saving === plan.slug}
                    onClick={() => void save(plan)}
                  >
                    Сохранить
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
