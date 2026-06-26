import { useTranslation } from "@/lib/i18n";
import { Crown, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { firstHundredStats } from "@/lib/mock";

export function FirstHundredBanner() {
  const { t } = useTranslation();
  const taken = Math.max(0, Math.min(firstHundredStats.total, firstHundredStats.taken));
  const total = firstHundredStats.total;
  const pct = Math.round((taken / total) * 100);
  const left = total - taken;

  return (
    <section style={{ padding: "32px 24px" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "1100px",
          position: "relative",
          overflow: "hidden",
          borderRadius: "24px",
          padding: "clamp(24px, 4vw, 40px)",
          background: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 45%, #B45309 100%)",
          boxShadow: "0 24px 60px -20px rgba(245, 158, 11, 0.55)",
          color: "#1F1300",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(600px circle at 10% 0%, rgba(255,255,255,0.35), transparent 60%), radial-gradient(500px circle at 90% 100%, rgba(255,255,255,0.18), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "grid", gap: "20px" }}>
          <div className="flex flex-wrap items-center" style={{ gap: "10px" }}>
            <span
              className="inline-flex items-center"
              style={{
                gap: "6px",
                padding: "6px 12px",
                background: "rgba(31, 19, 0, 0.18)",
                borderRadius: 999,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={12} /> {t("landing.launchBadge")}
            </span>
            <span
              className="inline-flex items-center"
              style={{
                gap: "6px",
                padding: "6px 12px",
                background: "#1F1300",
                color: "#FCD34D",
                borderRadius: 999,
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              <Crown size={12} />{t("components.firstHundredBadge")}</span>
          </div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(24px, 4vw, 36px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: "720px",
            }}
          >
            {t("landing.firstHundredTitle")}
          </h2>
          <p style={{ fontSize: "15px", maxWidth: "640px", opacity: 0.85, lineHeight: 1.5 }}>
            {t("landing.firstHundredDesc")}
          </p>

          <div className="grid" style={{ gap: "10px", maxWidth: "520px" }}>
            <div className="flex items-end justify-between" style={{ gap: "12px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "28px" }}>
                {t("common.occupied", { taken, total })}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, opacity: 0.8 }}>
                {t("common.spotsLeft", { left, word: left === 1 ? t("common.spot") : t("common.spots") })}
              </span>
            </div>
            <div
              style={{
                height: "12px",
                borderRadius: 999,
                background: "rgba(31, 19, 0, 0.18)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #1F1300 0%, #7C2D12 100%)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap" style={{ gap: "10px" }}>
            <Link
              to="/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "48px",
                padding: "0 22px",
                borderRadius: "12px",
                background: "#1F1300",
                color: "#FCD34D",
                fontWeight: 700,
                fontSize: "15px",
              }}
            >
              {t("landing.getYearFree")}
            </Link>
            <Link
              to="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "48px",
                padding: "0 18px",
                borderRadius: "12px",
                background: "rgba(31, 19, 0, 0.1)",
                color: "#1F1300",
                fontWeight: 600,
                fontSize: "14px",
                border: "1px solid rgba(31, 19, 0, 0.3)",
              }}
            >
              {t("landing.alreadyWithUs")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
