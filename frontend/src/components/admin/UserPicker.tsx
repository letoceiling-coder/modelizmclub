import { useEffect, useRef, useState } from "react";
import { searchAdminUserOptions, type AdminUserOption } from "@/lib/api/admin";

/**
 * Выбор людей поиском: набрал имя, почту или телефон — выбрал из списка.
 *
 * Выбранные показываются тегами с крестиком, а не строкой идентификаторов.
 * Это не украшение: список «12, 45, 78» нельзя проверить глазами — админ
 * видит числа, а решение принимает про людей. Тег несёт имя и почту, то
 * есть то, по чему человека узнают.
 *
 * Поиск с задержкой в 300 мс и с отменой устаревшего ответа: без отмены
 * медленный ответ на «ив» приезжает после быстрого на «иванов» и затирает
 * его — список показывает не то, что набрано.
 */
export function UserPicker({
  value,
  onChange,
  placeholder = "Имя, почта или телефон",
  disabled = false,
}: {
  value: AdminUserOption[];
  onChange: (next: AdminUserOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<AdminUserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const поколение = useRef(0);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setFound([]);
      setSearching(false);
      setFailed(false);
      return;
    }

    const моё = ++поколение.current;
    setSearching(true);
    setFailed(false);
    const таймер = setTimeout(() => {
      searchAdminUserOptions(needle)
        .then((rows) => {
          if (поколение.current !== моё) return;
          setFound(rows);
        })
        .catch(() => {
          if (поколение.current !== моё) return;
          // Молчать нельзя: пустой список и несостоявшийся поиск
          // выглядят одинаково, а значат разное.
          setFound([]);
          setFailed(true);
        })
        .finally(() => {
          if (поколение.current === моё) setSearching(false);
        });
    }, 300);

    return () => clearTimeout(таймер);
  }, [query]);

  const выбран = (id: number) => value.some((u) => u.id === id);

  const добавить = (u: AdminUserOption) => {
    if (выбран(u.id)) return;
    onChange([...value, u]);
    setQuery("");
    setFound([]);
  };

  const убрать = (id: number) => onChange(value.filter((u) => u.id !== id));

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground)",
    width: "100%",
  };

  const свободные = found.filter((u) => !выбран(u.id));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-2"
              style={{
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--accent-soft)",
                color: "var(--foreground)",
                fontSize: 12,
                padding: "4px 6px 4px 10px",
              }}
            >
              <span>
                {u.name}
                {u.email ? (
                  <span style={{ color: "var(--foreground-50)" }}> · {u.email}</span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={`Убрать ${u.name}`}
                disabled={disabled}
                onClick={() => убрать(u.id)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  color: "var(--foreground-50)",
                  fontSize: 14,
                  lineHeight: "16px",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
        {query.trim().length >= 2 && (
          <div
            style={{
              marginTop: 4,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--background)",
              overflow: "hidden",
            }}
          >
            {searching ? (
              <p style={{ fontSize: 12, color: "var(--foreground-50)", padding: "8px 10px" }}>
                Ищем…
              </p>
            ) : failed ? (
              <p style={{ fontSize: 12, color: "var(--foreground-50)", padding: "8px 10px" }}>
                Поиск не выполнился. Повторите запрос.
              </p>
            ) : свободные.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--foreground-50)", padding: "8px 10px" }}>
                Никого не нашли.
              </p>
            ) : (
              свободные.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => добавить(u)}
                  className="block w-full text-left"
                  style={{
                    padding: "8px 10px",
                    fontSize: 13,
                    color: "var(--foreground)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {u.name}
                  <span style={{ color: "var(--foreground-50)", marginLeft: 6, fontSize: 12 }}>
                    {[u.email, u.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
