import { useCallback, useEffect, useState } from "react";

/**
 * Установка приложения на домашний экран.
 *
 * Chrome/Edge/Samsung дают событие beforeinstallprompt — его нужно перехватить
 * и придержать: браузер отдаёт его один раз, и без preventDefault показать
 * системное окно позже уже нельзя. Safari на iOS такого события не имеет,
 * поэтому там показываем инструкцию «Поделиться → На экран Домой».
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Событие приходит один раз и до монтирования React — ловим его сразу. */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ представляется маком — отличаем по наличию тач-точек.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type PwaInstallMode = "prompt" | "ios-instructions" | "unavailable";

export interface PwaInstall {
  /** Что показывать: системное окно, инструкцию для iOS или ничего. */
  mode: PwaInstallMode;
  /** Приложение уже открыто как установленное. */
  installed: boolean;
  /** Вызывает системное окно установки. Возвращает true, если пользователь согласился. */
  promptInstall: () => Promise<boolean>;
}

export function usePwaInstall(): PwaInstall {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCanPrompt(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    sync();
    setIos(isIos());
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Системное окно одноразовое: показать его второй раз нельзя.
    deferredPrompt = null;
    notify();
    return outcome === "accepted";
  }, []);

  const mode: PwaInstallMode = installed
    ? "unavailable"
    : canPrompt
      ? "prompt"
      : ios
        ? "ios-instructions"
        : "unavailable";

  return { mode, installed, promptInstall };
}
