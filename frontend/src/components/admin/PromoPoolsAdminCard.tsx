import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  fetchAdminPromoPools,
  createAdminPromoPool,
  updateAdminPromoPool,
  pauseAdminPromoPool,
  resumeAdminPromoPool,
  completeAdminPromoPool,
  type AdminPromoPool,
  type AdminPromoAudience,
  type AdminPromoPoolState,
  type AdminUserOption,
} from "@/lib/api/admin";
import { UserPicker } from "@/components/admin/UserPicker";
import { formatDate } from "@/lib/format/date";

type CardStyle = React.CSSProperties;

const СОСТОЯНИЯ: Record<AdminPromoPoolState, { подпись: string; цвет: string }> = {
  planned: { подпись: "запланирована", цвет: "var(--foreground-50)" },
  active: { подпись: "активна", цвет: "var(--success, #2e7d32)" },
  completed: { подпись: "завершена", цвет: "var(--foreground-50)" },
  paused: { подпись: "на паузе", цвет: "var(--warning, #b26a00)" },
};

const КРУГИ: { значение: AdminPromoAudience; подпись: string }[] = [
  { значение: "all", подпись: "Всем пользователям" },
  { значение: "new", подпись: "Новым пользователям" },
  { значение: "selected", подпись: "Конкретным пользователям" },
];

/** Даты приезжают с московским смещением: первые знаки строки — стенное время. */
const день = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");
const час = (iso: string | null): string => (iso ? iso.slice(11, 16) : "");

/** Пусто — поля нет вовсе; иначе «день + время» без пояса, как ждёт сервер. */
const момент = (дата: string, время: string, поУмолчанию: string): string | null =>
  дата ? `${дата}T${время || поУмолчанию}:00` : null;

interface ФормаПериода {
  name: string;
  maxActivations: number;
  startsDate: string;
  startsTime: string;
  expiresDate: string;
  expiresTime: string;
  autoAssign: boolean;
  audience: AdminPromoAudience;
  people: AdminUserOption[];
}

const ПУСТАЯ: ФормаПериода = {
  name: "Первые 300 пользователей — бесплатно до 31.12.2026",
  maxActivations: 300,
  startsDate: "",
  startsTime: "",
  expiresDate: "2026-12-31",
  expiresTime: "",
  autoAssign: true,
  audience: "all",
  people: [],
};

export function PromoPoolsAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [pools, setPools] = useState<AdminPromoPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ФормаПериода>(ПУСТАЯ);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ФормаПериода>(ПУСТАЯ);

  const reload = () => {
    setLoading(true);
    fetchAdminPromoPools()
      .then(setPools)
      .catch(() => toast.error("Не удалось загрузить промо-пулы"))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const create = async () => {
    if (!form.expiresDate) {
      toast.error("Укажите дату окончания");
      return;
    }
    if (form.audience === "selected" && form.people.length === 0) {
      toast.error("Выберите хотя бы одного человека");
      return;
    }
    const конец = момент(form.expiresDate, form.expiresTime, "23:59");
    if (!конец) return;
    setSaving(true);
    try {
      await createAdminPromoPool({
        name: form.name.trim() || `Промо-пул на ${form.maxActivations} мест`,
        max_activations: Math.max(1, form.maxActivations),
        starts_at: момент(form.startsDate, form.startsTime, "00:00"),
        expires_at: конец,
        auto_assign_on_register: form.autoAssign,
        audience: form.audience,
        user_ids: form.people.map((u) => u.id),
      });
      toast.success("Промо-пул создан");
      setForm(ПУСТАЯ);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать пул");
    } finally {
      setSaving(false);
    }
  };

  const открытьПравку = (p: AdminPromoPool) => {
    setEditing(p.uuid);
    setEditForm({
      name: p.name,
      maxActivations: p.max_activations,
      startsDate: день(p.starts_at),
      startsTime: час(p.starts_at),
      expiresDate: день(p.expires_at),
      expiresTime: час(p.expires_at),
      autoAssign: p.auto_assign_on_register,
      audience: p.audience,
      people: p.audience_users ?? [],
    });
  };

  const сохранитьПравку = async () => {
    if (!editing) return;
    if (editForm.audience === "selected" && editForm.people.length === 0) {
      toast.error("Выберите хотя бы одного человека");
      return;
    }
    setSaving(true);
    try {
      await updateAdminPromoPool(editing, {
        name: editForm.name.trim(),
        max_activations: Math.max(1, editForm.maxActivations),
        starts_at: момент(editForm.startsDate, editForm.startsTime, "00:00"),
        expires_at: момент(editForm.expiresDate, editForm.expiresTime, "23:59") ?? undefined,
        auto_assign_on_register: editForm.autoAssign,
        audience: editForm.audience,
        user_ids: editForm.people.map((u) => u.id),
      });
      toast.success("Акция обновлена");
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground)",
  };
  const primaryBtn: React.CSSProperties = {
    height: 36,
    padding: "0 16px",
    borderRadius: 8,
    background: "var(--accent-fill)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
  };
  const ghostBtn: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--foreground-70)",
    fontSize: 12,
    fontWeight: 600,
  };
  const подпись: React.CSSProperties = { fontSize: 11, color: "var(--foreground-50)" };

  const период = (данные: ФормаПериода, задать: (f: ФормаПериода) => void) => (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label style={{ display: "grid", gap: 4 }}>
          <span style={подпись}>Начало</span>
          <input
            type="date"
            value={данные.startsDate}
            onChange={(e) => задать({ ...данные, startsDate: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={подпись}>Время начала</span>
          <input
            type="time"
            value={данные.startsTime}
            onChange={(e) => задать({ ...данные, startsTime: e.target.value })}
            style={{ ...inputStyle, width: 110 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={подпись}>Окончание</span>
          <input
            type="date"
            value={данные.expiresDate}
            min={данные.startsDate || undefined}
            onChange={(e) => задать({ ...данные, expiresDate: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={подпись}>Время окончания</span>
          <input
            type="time"
            value={данные.expiresTime}
            onChange={(e) => задать({ ...данные, expiresTime: e.target.value })}
            style={{ ...inputStyle, width: 110 }}
          />
        </label>
      </div>
      <p style={подпись}>
        Пустое начало — акция идёт с этой минуты. Пустое время — сутки целиком: начало в 00:00,
        окончание в 23:59. Старт и завершение происходят по датам сами, включать вручную ничего не
        нужно.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { подпись: "До конца 2026", дата: "2026-12-31" },
            { подпись: "До конца 2027", дата: "2027-12-31" },
          ] as const
        ).map((б) => (
          <button
            key={б.дата}
            type="button"
            onClick={() => задать({ ...данные, expiresDate: б.дата })}
            style={ghostBtn}
          >
            {б.подпись}
          </button>
        ))}
      </div>
    </>
  );

  const круг = (данные: ФормаПериода, задать: (f: ФормаПериода) => void) => (
    <div style={{ display: "grid", gap: 8 }}>
      <strong style={{ fontSize: 13, color: "var(--foreground)" }}>Кому доступна акция</strong>
      <div className="flex flex-wrap gap-3">
        {КРУГИ.map((к) => (
          <label
            key={к.значение}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "var(--foreground-70)" }}
          >
            <input
              type="radio"
              checked={данные.audience === к.значение}
              onChange={() => задать({ ...данные, audience: к.значение })}
            />
            {к.подпись}
          </label>
        ))}
      </div>
      {данные.audience === "new" && (
        <p style={подпись}>
          Новыми считаются зарегистрировавшиеся после начала акции. Если начало не задано — все, кто
          дойдёт до выдачи.
        </p>
      )}
      {данные.audience === "selected" && (
        <UserPicker
          value={данные.people}
          onChange={(people) => задать({ ...данные, people })}
          placeholder="Имя, почта или телефон"
        />
      )}
    </div>
  );

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--foreground)",
        }}
      >
        Промо-пулы и гранты
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Акция вроде «Первые 300 до 31.12.2026». Пауза и завершение останавливают выдачу новым, уже
        выданные места не снимаются.
      </p>

      <div
        className="mt-4 grid gap-3"
        style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}
      >
        <strong style={{ fontSize: 13, color: "var(--foreground)" }}>
          Создать промо-пул подписок
        </strong>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={подпись}>Название</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label style={{ display: "grid", gap: 4 }}>
            <span style={подпись}>Количество доступных мест</span>
            <input
              type="number"
              min={1}
              value={form.maxActivations}
              onChange={(e) => setForm({ ...form, maxActivations: +e.target.value })}
              style={{ ...inputStyle, width: 120 }}
            />
          </label>
          {([100, 200, 300] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  maxActivations: n,
                  name: `Первые ${n} пользователей — бесплатно до 31.12.2026`,
                })
              }
              style={{
                ...ghostBtn,
                background: form.maxActivations === n ? "var(--accent-soft)" : "transparent",
                color: form.maxActivations === n ? "var(--accent)" : "var(--foreground-70)",
              }}
            >
              {n} мест
            </button>
          ))}
        </div>
        {период(form, setForm)}
        {круг(form, setForm)}
        <label
          className="flex items-center gap-2 text-[13px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <input
            type="checkbox"
            checked={form.autoAssign}
            onChange={(e) => setForm({ ...form, autoAssign: e.target.checked })}
          />
          Автоматически выдавать новым зарегистрированным
        </label>
        <button type="button" onClick={create} disabled={saving} style={primaryBtn}>
          {saving ? "Создаём…" : "Создать промо-пул подписок"}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : pools.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Пул ещё не создан.</p>
        ) : (
          <table
            className="w-full min-w-[820px] text-left text-[13px]"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{ color: "var(--foreground-50)", borderBottom: "1px solid var(--border)" }}
              >
                <th className="py-2 pr-3 font-medium">Название</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 pr-3 font-medium">Места</th>
                <th className="py-2 pr-3 font-medium">Период</th>
                <th className="py-2 pr-3 font-medium">Кому</th>
                <th className="py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => {
                const состояние = СОСТОЯНИЯ[p.state] ?? СОСТОЯНИЯ.active;
                return (
                  <tr key={p.uuid} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-3" style={{ color: "var(--foreground)" }}>
                      {p.name}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        style={{
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          padding: "2px 8px",
                          fontSize: 12,
                          color: состояние.цвет,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {состояние.подпись}
                      </span>
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>
                      выдано {p.current_activations}, осталось {p.seats_left} из {p.max_activations}
                    </td>
                    <td
                      className="py-2 pr-3"
                      style={{ color: "var(--foreground-50)", whiteSpace: "nowrap" }}
                    >
                      {p.starts_at ? formatDate(p.starts_at, "date") : "сразу"} —{" "}
                      {p.expires_at ? formatDate(p.expires_at, "date") : "бессрочно"}
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--foreground-50)" }}>
                      {p.audience === "all"
                        ? "всем"
                        : p.audience === "new"
                          ? "новым"
                          : `выбранным (${p.audience_users?.length ?? 0})`}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {!p.completed_at && (
                          <button
                            type="button"
                            style={ghostBtn}
                            onClick={() =>
                              editing === p.uuid ? setEditing(null) : открытьПравку(p)
                            }
                          >
                            {editing === p.uuid ? "Свернуть" : "Изменить"}
                          </button>
                        )}
                        {!p.completed_at && p.is_active && (
                          <button
                            type="button"
                            style={ghostBtn}
                            onClick={() =>
                              pauseAdminPromoPool(p.uuid)
                                .then(reload)
                                .catch(() => toast.error("Не удалось приостановить"))
                            }
                          >
                            Приостановить
                          </button>
                        )}
                        {!p.completed_at && !p.is_active && (
                          <button
                            type="button"
                            style={ghostBtn}
                            onClick={() =>
                              resumeAdminPromoPool(p.uuid)
                                .then(reload)
                                .catch(() => toast.error("Не удалось возобновить"))
                            }
                          >
                            Возобновить
                          </button>
                        )}
                        {!p.completed_at && (
                          <button
                            type="button"
                            style={ghostBtn}
                            onClick={() =>
                              completeAdminPromoPool(p.uuid)
                                .then(reload)
                                .catch(() => toast.error("Не удалось завершить"))
                            }
                          >
                            Завершить
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div
          className="mt-4 grid gap-3"
          style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}
        >
          <strong style={{ fontSize: 13, color: "var(--foreground)" }}>Изменить акцию</strong>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={подпись}>Название</span>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={подпись}>Количество доступных мест</span>
            <input
              type="number"
              min={1}
              value={editForm.maxActivations}
              onChange={(e) => setEditForm({ ...editForm, maxActivations: +e.target.value })}
              style={{ ...inputStyle, width: 120 }}
            />
          </label>
          <p style={подпись}>
            Уменьшить число мест ниже уже выданных нельзя: выданные подписки от этого не исчезнут, а
            счётчик стал бы показывать больше ста из ста.
          </p>
          {период(editForm, setEditForm)}
          {круг(editForm, setEditForm)}
          <label
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "var(--foreground-70)" }}
          >
            <input
              type="checkbox"
              checked={editForm.autoAssign}
              onChange={(e) => setEditForm({ ...editForm, autoAssign: e.target.checked })}
            />
            Автоматически выдавать новым зарегистрированным
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={сохранитьПравку} disabled={saving} style={primaryBtn}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button type="button" onClick={() => setEditing(null)} style={ghostBtn}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
