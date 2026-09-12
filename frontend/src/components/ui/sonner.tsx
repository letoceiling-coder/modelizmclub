import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          // Sonner ships its own base stylesheet with an inline --border-radius
          // default and a generic system-ui font, both with enough specificity
          // to beat un-flagged Tailwind classes — hence the `!` on radius/font
          // here (matches the pattern the border-left override below already
          // used for the same reason).
          toast:
            "group toast font-sans group-[.toaster]:!rounded-[12px] group-[.toaster]:bg-[var(--background-elevated)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-[var(--shadow-card)]",
          // Размер по дизайн-системе: 14 у заголовка, 13 у пояснения. Было
          // 12 и 11 — тосты выглядели мельче всего остального на экране.
          title:
            "group-[.toast]:text-[14px] group-[.toast]:font-semibold group-[.toast]:leading-[1.35]",
          description: "group-[.toast]:text-[13px] group-[.toast]:text-[var(--foreground-70)]",
          actionButton: "group-[.toast]:bg-[var(--accent)] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[var(--background-surface)] group-[.toast]:text-[var(--foreground-70)]",
          // Sonner's default close button is a hardcoded white/gray circle —
          // recolor to the app's icon-button convention (background-surface
          // fill, foreground-70 ink, border token) instead of the library look.
          closeButton:
            "group-[.toast]:!bg-[var(--background-surface)] group-[.toast]:!text-[var(--foreground-70)] group-[.toast]:!border-[var(--border)]",
          // Значок по типу рисует сама библиотека; цветная полоса слева
          // остаётся вторым признаком — по ней тип виден и боковым зрением.
          icon: "group-[.toast]:shrink-0",
          success: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[var(--success)]",
          error: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[var(--danger)]",
          warning: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[var(--warning)]",
          info: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[var(--info)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
