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
            "group toast font-sans group-[.toaster]:!rounded-[var(--r-card-sm)] group-[.toaster]:bg-[var(--background-elevated)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-[var(--shadow-card)]",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold",
          description: "group-[.toast]:text-[var(--foreground-70)]",
          actionButton: "group-[.toast]:bg-[var(--accent)] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[var(--background-surface)] group-[.toast]:text-[var(--foreground-70)]",
          // Sonner's default close button is a hardcoded white/gray circle —
          // recolor to the app's icon-button convention (background-surface
          // fill, foreground-70 ink, border token) instead of the library look.
          closeButton:
            "group-[.toast]:!bg-[var(--background-surface)] group-[.toast]:!text-[var(--foreground-70)] group-[.toast]:!border-[var(--border)]",
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
