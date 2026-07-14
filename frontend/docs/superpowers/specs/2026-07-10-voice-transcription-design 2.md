# Voice Message Transcription (Demo UI) — Design Spec

## Context

The landing advertises "Голосовые сообщения с транскрибацией" as a Pro subscription benefit, but transcription is not exposed anywhere. Real speech-to-text requires a backend/third-party STT service — it is **not** implemented on the frontend and must not be faked.

Two findings from the code:
- `VoiceMessage.transcript?: string` already exists (`lib/mock.ts`), and `VoiceBubble.tsx` already renders it (a `FileText` button showing a preview + expand/collapse) **when present**.
- **No voice message currently carries a transcript** (no seeded demo transcripts; real recordings via `sendVoice` don't produce one), so that UI never actually appears today.

## Goal

Surface an honest transcription affordance under voice messages: a collapsed "Показать текст" toggle that reveals a transcript when one exists, and an honest "unavailable" note when it doesn't — never a fabricated on-demand transcription. Seed a small amount of authored demo content so the feature is demonstrable in demo mode. Document the real STT endpoint for the backend track.

## Honesty principle

Fabricating a transcript for a voice note the system never processed — even labeled "demo" — is the same false-capability illusion rejected for payments/2FA in the settings coverage audit. Therefore:
- The **on-demand** action (clicking "Показать текст" on a message with no transcript) shows an honest "недоступно" note, never invented text.
- Authored **demo seed** transcripts are acceptable (like all demo content — posts, ads, prices): they represent "a voice message that was transcribed server-side," demonstrating what the feature produces without pretending live STT runs on the client.

## Design

### `VoiceBubble.tsx`

- Replace the current always-visible transcript block with a **collapsed "Показать текст" toggle**:
  - A button under the waveform labeled "Показать текст" (with the existing `FileText` icon), collapsed by default.
  - Clicking toggles an inline reveal (reuse the existing `AnimatePresence` height animation), and flips the label to "Скрыть текст".
  - **If `voice.transcript` is set:** the revealed content is the transcript (keep the existing preview/expand-for-long behavior, or simply show the full transcript inside the toggle — the toggle itself is now the collapse mechanism, so long transcripts just render in full when open).
  - **If `voice.transcript` is empty/undefined:** the revealed content is an honest muted note: **"Расшифровка недоступна — распознавание речи подключается на сервере."**
- The toggle appears on **every** voice bubble (both `isMe` and incoming), styled with the existing `isMe`-aware colors.

### Demo seed data

- Add a `transcript` to **1-2** existing demo voice messages in the seeded conversations (wherever demo voice messages live — `lib/demo-data.ts` or `lib/mock.ts`; the implementer locates the seeded voice messages). Use plausible Russian transcript text matching the modeling domain.
- Freshly-recorded voice notes (via `sendVoice`) continue to have **no** transcript, so their "Показать текст" reveals the honest "недоступно" note — demonstrating both states.

### Backend-track documentation

- Append to `frontend/docs/backend-endpoints-needed.md`: a `POST /media/{uuid}/transcribe` (or `GET /media/{uuid}/transcript`) endpoint returning `{ "text": string, "lang"?: string }`, produced by a server-side STT provider (async job acceptable). Note that the frontend currently ships only the reveal UI + the honest "unavailable" state; once the endpoint exists, "Показать текст" on a transcript-less message would call it and render the returned text (gated behind the Pro subscription per the landing claim).

## Non-goals

- No real/client-side speech recognition.
- No fabricated on-demand transcripts.
- No change to voice recording/sending (Stage 1's demo fix stays as-is).
- No change to the waveform/playback UI.

## Testing

No unit-test framework — `npx tsc --noEmit` + live Playwright at 375px (mobile-first) then desktop.

- A seeded demo voice message shows a collapsed "Показать текст"; clicking reveals the seeded transcript; clicking again hides it; label toggles.
- A voice message without a transcript (e.g. one recorded live in the session) shows "Показать текст"; clicking reveals the honest "Расшифровка недоступна…" note, not invented text.
- Both `isMe` (outgoing) and incoming bubbles render the toggle with correct colors.
- No new console errors in the messenger at 375px + desktop.
