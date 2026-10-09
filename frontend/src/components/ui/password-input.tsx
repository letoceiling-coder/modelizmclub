import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/lib/utils";

/** `Input` with a show/hide toggle ("глазик") — same UI Kit styling, just password-specific. */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        {/*
          Кнопка остаётся в порядке обхода клавиатурой.

          Стояло `tabIndex={-1}`, то есть показать пароль мышью можно, а с
          клавиатуры — нет. Для того, кто не пользуется мышью, кнопки
          попросту не существовало: замер 09.10 на форме регистрации дал
          `tabIndex: [-1, -1]` у обоих «глазиков». Опечатку в пароле, который
          нельзя увидеть, такой человек найти не может.

          `aria-pressed` называет состояние словами — подпись кнопки меняется
          с «Показать» на «Скрыть», и диктор сообщает, что именно нажато.
        */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          className="hit-target absolute right-[10px] top-1/2 grid h-[28px] w-[28px] -translate-y-1/2 place-items-center rounded-full transition-colors"
          style={{ color: "var(--foreground-50)" }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
