// frontend/src/lib/api/icons.ts
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { updateAdminSettings, fetchAuditLogPage } from "@/lib/api/admin";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import type { TokenKey } from "@/lib/icon-slots";

export type IconFormat = "svg" | "png";

export interface IconAsset {
  id: string;
  name: string;
  format: IconFormat;
  svg?: string;
  url?: string;
  mediaUuid?: string;
  createdAt?: string;
}

export interface IconOverride {
  assetId: string;
  format?: IconFormat;
  svg?: string;
  url?: string;
  token: TokenKey;
}

export interface IconMediaItem {
  uuid: string;
  filename: string;
  mimeType: string;
  url: string;
  width?: number;
  height?: number;
  registered: boolean;
  createdAt?: string;
}

export type IconOverrideMap = Record<string, IconOverride>;

// Ключи localStorage для demo-режима (нет бэкенда).
const DEMO_ASSETS_KEY = "modelizm_icon_assets";
const DEMO_OVERRIDES_KEY = "modelizm_icon_overrides";

function readDemoAssets(): IconAsset[] {
  try { return JSON.parse(localStorage.getItem(DEMO_ASSETS_KEY) || "[]"); } catch { return []; }
}
function writeDemoAssets(list: IconAsset[]): void {
  localStorage.setItem(DEMO_ASSETS_KEY, JSON.stringify(list));
}

// --- Публичная карта назначений ---

export async function fetchIconOverrides(): Promise<IconOverrideMap> {
  if (isDemoMode()) {
    try { return JSON.parse(localStorage.getItem(DEMO_OVERRIDES_KEY) || "{}"); } catch { return {}; }
  }
  try {
    const res = await api<{ data: IconOverrideMap }>("/icon-overrides", { auth: false });
    return res.data ?? {};
  } catch {
    return {}; // fallback: пустая карта → все слоты на lucide-дефолтах
  }
}

// --- Библиотека иконок ---

export async function fetchIconAssets(): Promise<IconAsset[]> {
  if (isDemoMode()) return readDemoAssets();
  const res = await api<{ data: IconAsset[] }>("/admin/icon-assets");
  return res.data ?? [];
}

export async function fetchIconMedia(opts?: { unregistered?: boolean }): Promise<IconMediaItem[]> {
  if (isDemoMode()) return [];
  const q = opts?.unregistered ? "?unregistered=1" : "";
  const res = await api<{ data: IconMediaItem[] }>(`/admin/icon-media${q}`);
  return res.data ?? [];
}

export async function registerIconFromMedia(mediaUuid: string): Promise<IconAsset> {
  const res = await api<{ data: IconAsset }>("/admin/icon-assets/from-media", {
    method: "POST",
    body: { media_uuid: mediaUuid },
  });
  return res.data;
}

// Клиентская best-effort токенизация для DEMO (на бэке — жёсткая версия).
function demoTokenizeSvg(raw: string): { svg: string } | { error: string } {
  const s = raw.trim();
  if (!isSafeSvgMarkup(s)) return { error: "Файл не распознан как безопасный SVG" };
  if (/<(linearGradient|radialGradient)\b/i.test(s)) return { error: "Иконка должна быть одноцветной (обнаружен градиент)" };
  const fills = new Set(
    Array.from(s.matchAll(/fill\s*=\s*"([^"]*)"/gi))
      .map((m) => m[1].toLowerCase())
      .filter((c) => c && c !== "none" && c !== "currentcolor"),
  );
  if (fills.size > 1) return { error: "Иконка должна быть одноцветной (найдено несколько цветов)" };
  const tokenized = s
    .replace(/\sfill\s*=\s*"(?!none)[^"]*"/gi, ' fill="currentColor"')
    .replace(/\sstroke\s*=\s*"(?!none)[^"]*"/gi, ' stroke="currentColor"')
    .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "");
  return { svg: tokenized };
}

export async function uploadIconAsset(file: File): Promise<IconAsset> {
  if (isDemoMode()) {
    if (file.type === "image/png" || /\.png$/i.test(file.name)) {
      const asset: IconAsset = {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.png$/i, ""),
        format: "png",
        url: URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
      };
      writeDemoAssets([asset, ...readDemoAssets()]);
      return asset;
    }
    const raw = await file.text();
    const result = demoTokenizeSvg(raw);
    if ("error" in result) throw new Error(result.error);
    const asset: IconAsset = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name.replace(/\.svg$/i, ""),
      format: "svg",
      svg: result.svg,
      createdAt: new Date().toISOString(),
    };
    writeDemoAssets([asset, ...readDemoAssets()]);
    return asset;
  }
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", "icon");
  const res = await api<{ data: IconAsset }>("/media", { method: "POST", body: form });
  return res.data;
}

export async function deleteIconAsset(id: string): Promise<void> {
  if (isDemoMode()) {
    writeDemoAssets(readDemoAssets().filter((a) => a.id !== id));
    return;
  }
  await api(`/admin/icon-assets/${id}`, { method: "DELETE" });
}

// --- Публикация назначений ---

export async function publishIconOverrides(map: IconOverrideMap): Promise<void> {
  if (isDemoMode()) {
    localStorage.setItem(DEMO_OVERRIDES_KEY, JSON.stringify(map));
    return;
  }
  await updateAdminSettings([{ key: "icon_overrides", value: map, group: "design" }]);
}

export async function fetchLastPublishedIconOverrides(): Promise<IconOverrideMap | null> {
  if (isDemoMode()) return null;
  try {
    const page = await fetchAuditLogPage(1);
    for (const entry of page.entries) {
      if (entry.action !== "admin.settings.update") continue;
      const oldVals = entry.oldValues;
      if (oldVals && Object.prototype.hasOwnProperty.call(oldVals, "icon_overrides")) {
        const prev = oldVals["icon_overrides"];
        if (prev && typeof prev === "object") return prev as IconOverrideMap;
        if (prev === null) return {};
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function assetToOverride(asset: IconAsset, token: TokenKey): IconOverride {
  return {
    assetId: asset.id,
    format: asset.format ?? (asset.svg ? "svg" : "png"),
    svg: asset.svg,
    url: asset.url,
    token,
  };
}
