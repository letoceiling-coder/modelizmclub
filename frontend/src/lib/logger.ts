/**
 * Client diagnostic logger for call stability.
 *
 * Buffers structured log entries in localStorage and flushes them to the
 * backend (`POST /diagnostics/logs`) periodically and on page hide / unload.
 * Captures device + OS + network so we can correlate failures across devices.
 */

import { api, getToken } from "./api/client";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  id: string;
  t: number;
  level: LogLevel;
  tag: string;
  msg: string;
  call_uuid?: string;
  data?: unknown;
  n?: number; // repeat count for collapsed consecutive duplicates
}

interface DeviceInfo {
  platform: string;
  os: string;
  browser: string;
  device: "mobile" | "tablet" | "desktop";
  network: string;
  user_agent: string;
}

const BUF_KEY = "mc_logs";
const SID_KEY = "mc_sid";
const MAX_BUFFER = 500;
const FLUSH_MS = 15_000;
const BATCH_SIZE = 100;
const COLLAPSE_MS = 4_000; // fold identical repeats (e.g. recurring errors) within this window

let buffer: LogEntry[] = [];
let sessionId = "";
let device: DeviceInfo | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let flushing = false;
let activeCallUuid: string | undefined;

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function detectDevice(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string; mobile?: boolean } }).userAgentData;

  let os = "unknown";
  let platform = "unknown";
  if (/Android/i.test(ua)) {
    platform = "Android";
    os = (ua.match(/Android\s+([\d.]+)/i)?.[1] ?? "").trim() ? `Android ${ua.match(/Android\s+([\d.]+)/i)?.[1]}` : "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua) || (uaData?.platform === "iOS")) {
    platform = "iOS";
    os = `iOS ${(ua.match(/OS\s+([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".")}`.trim();
  } else if (/Windows/i.test(ua)) {
    platform = "Windows";
    os = ua.match(/Windows NT\s+([\d.]+)/i)?.[1] ? `Windows NT ${ua.match(/Windows NT\s+([\d.]+)/i)?.[1]}` : "Windows";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = "macOS";
    os = `macOS ${(ua.match(/Mac OS X\s+([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".")}`.trim();
  } else if (/Linux/i.test(ua)) {
    platform = "Linux";
    os = "Linux";
  }

  let browser = "unknown";
  if (/Edg\//i.test(ua)) browser = `Edge ${ua.match(/Edg\/([\d.]+)/i)?.[1] ?? ""}`;
  else if (/OPR\//i.test(ua)) browser = `Opera ${ua.match(/OPR\/([\d.]+)/i)?.[1] ?? ""}`;
  else if (/YaBrowser/i.test(ua)) browser = `Yandex ${ua.match(/YaBrowser\/([\d.]+)/i)?.[1] ?? ""}`;
  else if (/Chrome\//i.test(ua)) browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/i)?.[1] ?? ""}`;
  else if (/Firefox\//i.test(ua)) browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/i)?.[1] ?? ""}`;
  else if (/Safari\//i.test(ua)) browser = `Safari ${ua.match(/Version\/([\d.]+)/i)?.[1] ?? ""}`;

  const isTablet = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = uaData?.mobile ?? /Mobi|Android|iPhone|iPod/i.test(ua);
  const deviceType: DeviceInfo["device"] = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  const conn = (navigator as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;
  const network = conn?.type ?? conn?.effectiveType ?? "unknown";

  return {
    platform,
    os: os.trim() || platform,
    browser: browser.trim(),
    device: deviceType,
    network,
    user_agent: ua.slice(0, 512),
  };
}

function loadBuffer(): void {
  try {
    const raw = window.localStorage.getItem(BUF_KEY);
    const parsed = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    // Backfill ids for entries written by older builds so id-based dedup/removal stays precise.
    buffer = Array.isArray(parsed)
      ? parsed.map((e) => (e && e.id ? e : { ...e, id: uuid() }))
      : [];
  } catch {
    buffer = [];
  }
}

function saveBuffer(): void {
  try {
    window.localStorage.setItem(BUF_KEY, JSON.stringify(buffer));
  } catch {
    // quota — drop the oldest half and retry once
    buffer = buffer.slice(Math.floor(buffer.length / 2));
    try {
      window.localStorage.setItem(BUF_KEY, JSON.stringify(buffer));
    } catch {
      /* give up */
    }
  }
}

function safeData(data: unknown): unknown {
  if (data === undefined) return undefined;
  try {
    const json = JSON.stringify(data, (_k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message };
      return v;
    });
    if (!json) return undefined;
    return JSON.parse(json.length > 4000 ? json.slice(0, 4000) : json);
  } catch {
    return String(data);
  }
}

/** Tag the current call so every subsequent entry is correlated to it. */
export function setLogCall(uuid: string | undefined): void {
  activeCallUuid = uuid && !uuid.startsWith("pending_") ? uuid : undefined;
}

export function logEvent(level: LogLevel, tag: string, msg: string, data?: unknown): void {
  if (typeof window === "undefined") return;
  const safe = safeData(data);

  // Collapse a burst of identical entries (same level/tag/msg/call + payload)
  // into a single record with a repeat count, so recurring errors don't flood
  // the buffer and get sent many times over.
  const last = buffer[buffer.length - 1];
  if (
    last &&
    last.level === level &&
    last.tag === tag &&
    last.msg === msg &&
    last.call_uuid === activeCallUuid &&
    Date.now() - last.t < COLLAPSE_MS &&
    JSON.stringify(last.data) === JSON.stringify(safe)
  ) {
    last.n = (last.n ?? 1) + 1;
    last.t = Date.now();
    saveBuffer();
    return;
  }

  const entry: LogEntry = { id: uuid(), t: Date.now(), level, tag, msg, call_uuid: activeCallUuid, data: safe };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(buffer.length - MAX_BUFFER);
  saveBuffer();
  if (level === "error") void flushLogs();
}

export async function flushLogs(): Promise<void> {
  if (flushing || typeof window === "undefined") return;
  if (!getToken()) return; // only logged-in sessions can post
  // Re-read the persisted buffer so concurrent tabs share one source of truth
  // and we never re-send entries another tab already cleared.
  loadBuffer();
  if (buffer.length === 0) return;
  flushing = true;
  const batch = buffer.slice(0, BATCH_SIZE);
  const entries = batch.map((e) => ({
    id: e.id,
    t: e.t,
    level: e.level,
    tag: e.tag,
    msg: e.n && e.n > 1 ? `${e.msg} (×${e.n})` : e.msg,
    call_uuid: e.call_uuid,
    data: e.data,
  }));
  try {
    await api("/diagnostics/logs", {
      method: "POST",
      json: { session_id: sessionId, device, entries },
    });
    // Remove exactly the sent entries by id (cross-tab safe; tolerant of new
    // entries appended during the request).
    const sent = new Set(batch.map((e) => e.id));
    loadBuffer();
    buffer = buffer.filter((e) => !sent.has(e.id));
    saveBuffer();
  } catch {
    // keep buffer for the next attempt — backend dedupes by client_id on retry
  } finally {
    flushing = false;
  }
}

export function initLogger(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  try {
    sessionId = window.localStorage.getItem(SID_KEY) ?? "";
    if (!sessionId) {
      sessionId = uuid();
      window.localStorage.setItem(SID_KEY, sessionId);
    }
  } catch {
    sessionId = uuid();
  }

  device = detectDevice();
  loadBuffer();
  logEvent("info", "session", "session start", { device });

  flushTimer = setInterval(() => void flushLogs(), FLUSH_MS);

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushLogs();
  });
  window.addEventListener("pagehide", () => void flushLogs());
  window.addEventListener("beforeunload", () => void flushLogs());

  window.addEventListener("error", (e) => {
    logEvent("error", "window", e.message ?? "window error", {
      src: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    logEvent("error", "promise", "unhandledrejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

export function getDeviceInfo(): DeviceInfo | null {
  return device;
}
