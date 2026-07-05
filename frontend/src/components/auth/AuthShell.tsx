import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import cover from "@/assets/cover-modelizm.jpg";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Custom left-column content (register/login). Falls back to the brand
   *  block below when omitted — keeps recover/reset-password/verify-email
   *  visually unchanged. */
  leftContent?: ReactNode;
}

function DefaultLeftContent() {
  return (
    <>
      <Logo size={40} />
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.7)",
            textTransform: "uppercase",
          }}
        >
          МоДелизМ · v2.1
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginTop: 16,
            maxWidth: 460,
          }}
        >
          Сообщество моделистов
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Сборки, обсуждения, объявления и тематические чаты — для тех, для кого моделизм это жизнь.
        </p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );
}

export function AuthShell({ title, subtitle, children, footer, leftContent }: Props) {
  return (
    <div
      className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* LEFT — visual */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(200,16,46,0.85) 0%, rgba(15,15,20,0.92) 70%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-[40px]" style={{ color: "#fff" }}>
          {leftContent ?? <DefaultLeftContent />}
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between px-[24px] py-[20px] lg:hidden">
          <Link to="/"><Logo /></Link>
          <ThemeToggle />
        </div>
        <div className="hidden justify-end p-[24px] lg:flex">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 flex-col justify-center px-[24px] pb-[40px] sm:px-[48px]">
          <div className="mx-auto w-full" style={{ maxWidth: 400 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--foreground-70)", marginTop: 10, fontSize: "var(--fs-sm)" }}>{subtitle}</p>
            )}
            <div className="mt-[32px]">{children}</div>
            {footer && (
              <div className="mt-[24px]" style={{ fontSize: "var(--fs-sm)", color: "var(--foreground-70)" }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "12px 14px",
  fontSize: "var(--fs-sm)",
  color: "var(--foreground)",
  outline: "none",
};

export const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "var(--fs-sm)",
  padding: "12px 16px",
  borderRadius: "var(--r-button)",
  border: "none",
  cursor: "pointer",
  boxShadow: "var(--shadow-button)",
};
