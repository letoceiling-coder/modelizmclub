/**
 * English translations for P4 i18n keys (call screen, voice/file bubbles).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  components: {
    callScreen: {
      ariaLabel: "Call screen",
      statusRinging: "Calling…",
      statusConnecting: "Connecting…",
      statusConnected: "In call",
      statusReconnecting: "Reconnecting…",
      statusEnded: "Call ended",
      resultRejected: "Call declined",
      resultBusy: "Line busy",
      resultMissed: "No answer",
      resultAnswered: "Ended",
      toastDeclinedSelf: "You declined the call",
      toastNoAnswer: "No answer — {{name}}",
      toastMissed: "Missed call — {{name}}",
      toastRejected: "Call declined — {{name}}",
      toastBusy: "Busy — {{name}}",
      toastAnsweredEnded: "Call ended · {{duration}}",
      toastEnded: "Call ended",
      directionOutgoing: "Outgoing",
      directionIncoming: "Incoming",
      videoSuffix: " · video",
      decline: "Decline",
      accept: "Accept",
      micOn: "Unmute microphone",
      micOff: "Mute microphone",
      speakerOn: "Unmute peer audio",
      speakerOff: "Mute peer audio",
      cameraOn: "Turn camera on",
      cameraOff: "Turn camera off",
      switchCamera: "Switch camera",
      endCall: "End call",
    },
    voiceBubble: {
      transcriptUnavailable: "Transcript unavailable — speech recognition is being enabled on the server.",
      demoTranscript: "Sample voice message transcript.",
      speechNotRecognized: "Speech not recognized.",
      pause: "Pause",
      play: "Play",
      voiceLabel: "voice",
      hideText: "Hide text",
      showText: "Show text",
    },
    messageFileBubble: {
      download: "Download",
      sizeMb: "{{size}} MB",
      sizeKb: "{{size}} KB",
    },
  },
};

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const merged = deepMerge(en as unknown as Record<string, unknown>, patch);

function toTs(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[\n" + obj.map((v) => pad + "  " + toTs(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  const lines = Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
    const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    return `${pad}  ${key}: ${toTs(v, indent + 1)}`;
  });
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}

writeFileSync(
  "src/lib/i18n/locales/en.ts",
  `import type { TranslationSchema } from "./ru";\n\nexport const en: TranslationSchema = ${toTs(merged)};\n`,
);
console.log("Patched en.ts with P4 translations");
