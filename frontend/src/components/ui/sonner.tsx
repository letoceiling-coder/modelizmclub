import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--background-elevated)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-[var(--shadow-card)] group-[.toaster]:rounded-[var(--r-card-sm)]",
          description: "group-[.toast]:text-[var(--foreground-70)]",
          actionButton: "group-[.toast]:bg-[var(--accent)] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[var(--background-surface)] group-[.toast]:text-[var(--foreground-70)]",
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
