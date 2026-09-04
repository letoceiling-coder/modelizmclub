import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Sun, Moon, CheckCircle2 } from "lucide-react";
import {
  generateVariations,
  applyTheme,
  loadTheme,
  ACCENT_PRESET_LIST,
  ACCENT_PRESETS,
  DEFAULT_ACCENT_ID,
  isAccentPresetId,
  type Mode,
  type AccentSwatch,
  type AccentPreset,
  type AccentPresetId,
} from "@/lib/theme-manager";
import { SiteBrandingAdminCard } from "@/components/admin/SiteBrandingAdminCard";
import { PreviewArea } from "@/components/admin/AdminDesignSystemPreview";
import { Panel } from "@/components/admin/adminShared";

export function DesignSystemSection() {
  const { t } = useTranslation();
  const initial = loadTheme();
  const [mode, setMode] = useState<Mode>(
    initial?.mode ??
      (typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark"),
  );
  const [accent, setAccent] = useState<string>(initial?.accent ?? DEFAULT_ACCENT_ID);

  const activeHex = isAccentPresetId(accent) ? ACCENT_PRESETS[accent].primary : accent;
  const variations = useMemo(() => generateVariations(activeHex), [activeHex]);

  function pickPreset(id: AccentPresetId) {
    setAccent(id);
    applyTheme({ mode, accent: id });
  }
  function pickAccent(hex: string) {
    setAccent(hex);
    applyTheme({ mode, accent: hex });
  }
  function pickMode(m: Mode) {
    setMode(m);
    applyTheme({ mode: m, accent });
  }
  function reset() {
    setMode("dark");
    setAccent(DEFAULT_ACCENT_ID);
    applyTheme({ mode: "dark", accent: DEFAULT_ACCENT_ID });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}
          >
            {t("pages.adminDesignSystem.title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--foreground-70)" }}>
            {t("pages.adminDesignSystem.subtitle")}
          </p>
        </div>
        <a
          href="/admin/design-system"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            background: "var(--accent-soft)",
            whiteSpace: "nowrap",
          }}
        >
          {t("pages.adminDesignSystem.uiKitLink")}
        </a>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
        <Panel title={t("pages.adminDesignSystem.themeMode")}>
          <div style={{ display: "flex", gap: 8 }}>
            <ModeBtn
              active={mode === "light"}
              onClick={() => pickMode("light")}
              icon={<Sun size={16} />}
              label="Light"
            />
            <ModeBtn
              active={mode === "dark"}
              onClick={() => pickMode("dark")}
              icon={<Moon size={16} />}
              label="Dark"
            />
            <button
              onClick={reset}
              style={{
                marginLeft: "auto",
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 13,
                border: "1px solid var(--border)",
                background: "var(--background-surface)",
                color: "var(--foreground-70)",
              }}
            >
              {t("pages.adminDesignSystem.reset")}
            </button>
          </div>
        </Panel>

        <Panel title={t("pages.adminDesignSystem.brandColor")}>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {ACCENT_PRESET_LIST.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={isAccentPresetId(accent) && accent === p.id}
                onPick={() => pickPreset(p.id)}
              />
            ))}
          </div>
        </Panel>

        {/* Advanced / debug — free-form hex is intentionally NOT the main scenario. */}
        <details
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            padding: 16,
          }}
        >
          <summary
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground-70)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {t("pages.adminDesignSystem.advancedMode")}
          </summary>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                type="color"
                value={activeHex}
                onChange={(e) => pickAccent(e.target.value)}
                aria-label={t("pages.adminDesignSystem.pickAccentAria")}
                style={{
                  width: 48,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "transparent",
                  cursor: "pointer",
                  padding: 2,
                }}
              />
              <input
                type="text"
                value={activeHex}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) pickAccent(v.toUpperCase());
                }}
                placeholder="#RRGGBB"
                spellCheck={false}
                style={{
                  width: 130,
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  border: "1px solid var(--border)",
                  background: "var(--background-surface)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>
                {t("pages.adminDesignSystem.debugHint")}
              </span>
            </div>
            <SwatchRow swatches={variations} active={activeHex} onPick={pickAccent} />
          </div>
        </details>
      </div>

      {/* Preview */}
      <SiteBrandingAdminCard
        cardStyle={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
        }}
      />

      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginTop: 8 }}>
        {t("pages.adminDesignSystem.previewTitle")}
      </h2>
      <PreviewArea />

      <p
        style={{
          fontSize: 13,
          color: "var(--foreground-50)",
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--background-elevated)",
        }}
      >
        {t("pages.adminDesignSystem.iconsHint")}{" "}
        <Link
          to="/admin"
          search={{ section: "icons" }}
          style={{ color: "var(--accent)", fontWeight: 600 }}
        >
          {t("pages.adminDesignSystem.iconsLink")}
        </Link>
        .
      </p>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        background: active ? "var(--accent)" : "var(--background-surface)",
        color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        boxShadow: active ? "var(--shadow-button)" : "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SwatchRow({
  swatches,
  active,
  onPick,
}: {
  swatches: AccentSwatch[];
  active: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {swatches.map((s) => {
        const isActive = s.hex.toUpperCase() === active.toUpperCase();
        return (
          <button
            key={s.id + s.hex}
            onClick={() => onPick(s.hex)}
            title={`${s.label} — ${s.hex}`}
            style={{
              width: 88,
              padding: 6,
              borderRadius: 12,
              border: `2px solid ${isActive ? "var(--foreground)" : "transparent"}`,
              background: "var(--background-surface)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ height: 44, borderRadius: 8, background: s.hex }} />
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--foreground-70)" }}>
              {s.hex}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Brand preset chooser card — swatch + hex + live component samples (rendered
 *  with the preset's OWN colors so it previews before you apply it). */
function PresetCard({
  preset,
  active,
  onPick,
}: {
  preset: AccentPreset;
  active: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        border: `2px solid ${active ? preset.primary : "var(--border)"}`,
        borderRadius: 16,
        padding: 16,
        background: "var(--background-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: active ? `0 0 0 4px ${preset.soft}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: preset.primary,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
              {preset.label}
            </span>
            {active && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: preset.primary,
                }}
              >
                <CheckCircle2 size={13} /> {t("pages.adminDesignSystem.presetActive")}
              </span>
            )}
          </div>
          <div
            style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--foreground-50)" }}
          >
            {preset.primary}
          </div>
        </div>
      </div>

      {/* live component samples in the preset's own colors */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: preset.primary,
            color: preset.foreground,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t("pages.adminDesignSystem.presetButton")}
        </span>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "var(--r-pill)",
            background: preset.primary,
            color: preset.foreground,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          PRO
        </span>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            background: preset.soft,
            color: preset.primary,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t("pages.adminDesignSystem.presetTab")}
        </span>
      </div>

      <button
        onClick={onPick}
        disabled={active}
        style={{
          marginTop: "auto",
          height: 40,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: active ? "default" : "pointer",
          border: active ? "1px solid var(--border)" : "none",
          background: active ? "var(--background-elevated)" : preset.primary,
          color: active ? "var(--foreground-50)" : preset.foreground,
        }}
      >
        {active
          ? t("pages.adminDesignSystem.presetPrimary")
          : t("pages.adminDesignSystem.presetMakePrimary")}
      </button>
    </div>
  );
}
