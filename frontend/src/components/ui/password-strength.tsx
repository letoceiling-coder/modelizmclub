interface StrengthResult {
  score: number; // 0-4, count of met criteria
  label: "Слабый" | "Средний" | "Надёжный";
  color: string;
  missing: string[];
}

/** Checks the same four requirements the hint copy promises: length,
 *  mixed case, digit, special character. */
function getPasswordStrength(password: string): StrengthResult {
  const checks = {
    length: password.length >= 8,
    case: /[a-zа-яё]/i.test(password) && /[A-ZА-ЯЁ]/.test(password) && /[a-zа-яё]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-zА-Яа-яЁё0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 1 ? "Слабый" : score <= 3 ? "Средний" : "Надёжный";
  const color = score <= 1 ? "var(--danger)" : score <= 3 ? "var(--warning)" : "var(--success)";

  const missing: string[] = [];
  if (!checks.length) missing.push("минимум 8 символов");
  if (!checks.case) missing.push("заглавные и строчные буквы");
  if (!checks.digit) missing.push("хотя бы одна цифра");
  if (!checks.special) missing.push("хотя бы один спецсимвол");

  return { score, label, color, missing };
}

/** Strength bar + label + missing-requirements hint for a password field.
 *  Renders nothing when the field is empty (no signal to show yet). */
function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color, missing } = getPasswordStrength(password);

  return (
    <div className="space-y-[6px]" aria-live="polite">
      <div className="flex items-center gap-[8px]">
        <div className="flex flex-1 gap-[4px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[4px] flex-1 rounded-full transition-colors"
              style={{ background: i < score ? color : "var(--border)" }}
            />
          ))}
        </div>
        <span className="text-[12px] font-medium" style={{ color }}>{label}</span>
      </div>
      {missing.length > 0 && (
        <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Не хватает: {missing.join(", ")}
        </p>
      )}
    </div>
  );
}

export { PasswordStrengthMeter, getPasswordStrength };
