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
  t: number;
  level: LogLevel;
  tag: string;
  msg: string;
  call_uuid?: string;
  data?: unknown;
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
    buffer = raw ? (JSON.parse(raw) as LogEntry[]) : [];
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
  const entry: LogEntry = { t: Date.now(), level, tag, msg, call_uuid: activeCallUuid, data: safeData(data) };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(buffer.length - MAX_BUFFER);
  saveBuffer();
  if (level === "error") void flushLogs();
}

export async function flushLogs(): Promise<void> {
  if (flushing || typeof window === "undefined") return;
  if (buffer.length === 0) return;
  if (!getToken()) return; // only logged-in sessions can post
  flushing = true;
  const batch = buffer.slice(0, BATCH_SIZE);
  try {
    await api("/diagnostics/logs", {
      method: "POST",
      json: { session_id: sessionId, device, entries: batch },
    });
    buffer = buffer.slice(batch.length);
    saveBuffer();
  } catch {
    // keep buffer for the next attempt
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
