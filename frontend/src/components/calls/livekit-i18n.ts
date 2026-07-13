/**
 * @livekit/components-react's prebuilt <VideoConference> ships hardcoded
 * English copy (confirmed by grepping its dist bundle — there is no
 * translations/locale prop on VideoConference, ControlBar, or any of its
 * sub-components in the installed version). Rebuilding the whole prefab
 * from primitives just to relabel it would risk regressing screen share,
 * chat, layout, and device-picker behavior that the prefab already handles
 * correctly. Instead this walks the room's DOM and replaces known English
 * strings — in text nodes and in aria-label/title attributes — with their
 * Russian equivalents, live, via a MutationObserver (see useLiveKitRussianLabels).
 */
export const LIVEKIT_RU_LABELS: Record<string, string> = {
  "Camera": "Камера",
  "Chat": "Чат",
  "Disconnect": "Завершить",
  "Leave": "Покинуть",
  "Messages": "Сообщения",
  "Microphone": "Микрофон",
  "Send": "Отправить",
  "Settings": "Настройки",
  "Share screen": "Показать экран",
  "Stop screen share": "Остановить показ экрана",
  "Audio inputs": "Устройства звука",
  "Video inputs": "Устройства видео",
  "Allow Audio": "Включить звук",
  "Disconnected": "Отключён",
};

const TRANSLATED_ATTRS = ["aria-label", "title", "placeholder"] as const;

function translateNode(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const trimmed = node.nodeValue?.trim();
    if (trimmed && LIVEKIT_RU_LABELS[trimmed] && node.nodeValue !== LIVEKIT_RU_LABELS[trimmed]) {
      node.nodeValue = node.nodeValue!.replace(trimmed, LIVEKIT_RU_LABELS[trimmed]);
    }
    node = walker.nextNode();
  }

  if (root instanceof Element || root instanceof Document || root instanceof DocumentFragment) {
    for (const attr of TRANSLATED_ATTRS) {
      root.querySelectorAll(`[${attr}]`).forEach((el) => {
        const value = el.getAttribute(attr);
        if (value && LIVEKIT_RU_LABELS[value]) el.setAttribute(attr, LIVEKIT_RU_LABELS[value]);
      });
    }
  }
}

/** Attaches a MutationObserver to `container` that keeps translating LiveKit's
 *  UI as it re-renders (control bar toggles, screen-share state, chat panel
 *  open/close all swap English text in place). Returns a cleanup function. */
export function watchAndTranslateLiveKitUI(container: HTMLElement): () => void {
  translateNode(container);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData" && m.target.nodeValue) {
        translateNode(m.target.parentNode ?? m.target);
      } else {
        m.addedNodes.forEach((n) => translateNode(n));
        if (m.type === "attributes" && m.target instanceof Element) translateNode(m.target);
      }
    }
  });
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRS],
  });
  return () => observer.disconnect();
}
