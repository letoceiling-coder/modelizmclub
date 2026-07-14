# Voice Transcription (Demo UI) Implementation Plan

> **For agentic workers:** Execute inline as a sub-stage of the Mobile Functional Fixes pass, single checkpoint + commit approval.

**Goal:** A collapsed "Показать текст" toggle on voice bubbles that reveals a transcript when present or an honest "недоступно" note when not; seed one demo voice message with a transcript; document the STT endpoint.

**Tech Stack:** React 19, TypeScript, framer-motion (existing), UI-Kit CSS vars.

## Global Constraints

- Never fabricate an on-demand transcript — a transcript-less message reveals an honest "unavailable" note.
- Seeded demo transcripts are authored demo content (fine); recording flow unchanged.
- `npx tsc --noEmit` clean; live 375px + desktop verification.

---

### Task 1: "Показать текст" toggle in `VoiceBubble.tsx`

**Files:** `frontend/src/components/messenger/VoiceBubble.tsx`.

- [ ] **Step 1:** The component already has `const [expanded, setExpanded] = useState(false)` and computes `transcript`/`preview`. Replace the current `{transcript && ( … )}` block (the always-shown transcript button) with a **toggle that always renders**:

```tsx
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-[8px] flex w-full items-center gap-[6px] rounded-[10px] px-[8px] py-[6px] text-left transition-colors"
        style={{
          background: isMe ? "rgba(255,255,255,0.12)" : "color-mix(in oklab, var(--accent) 8%, transparent)",
          color: fg,
        }}
        aria-expanded={expanded}
      >
        <FileText size={12} style={{ color: subtle, flexShrink: 0 }} />
        <span className="flex-1 text-[12px] font-medium">{expanded ? "Скрыть текст" : "Показать текст"}</span>
        <ChevronDown
          size={12}
          style={{ color: subtle, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="mt-[6px] rounded-[10px] px-[8px] py-[6px] text-[12px] leading-[1.45]"
              style={{
                background: isMe ? "rgba(255,255,255,0.10)" : "color-mix(in oklab, var(--accent) 6%, transparent)",
                color: transcript ? fg : subtle,
              }}
            >
              {transcript
                ? transcript
                : "Расшифровка недоступна — распознавание речи подключается на сервере."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 2:** Remove the now-unused `previewLimit`/`isLong`/`preview` locals (the toggle shows the full transcript when open, no preview truncation needed). Keep `const transcript = voice.transcript ?? "";`.

- [ ] **Step 3:** Typecheck — `cd frontend && npx tsc --noEmit` clean (no unused-var errors; if `AnimatePresence`/`motion`/`ChevronDown`/`FileText` were already imported, no import change needed — verify they are).

---

### Task 2: Seed one demo voice message with a transcript

**Files:** `frontend/src/lib/mock.ts`.

- [ ] **Step 1:** In the `dialogs` array, dialog `d1`'s `messages`, insert a voice message from `u2` after `d1m6` (before `d1m7`). `makeMockWaveform` is defined earlier in the same file:

```tsx
      { id: "d1m6b", authorId: "u2", time: _ago(88), text: "", status: "read", voice: { duration: 13, waveform: makeMockWaveform(6142), transcript: "И ещё: после прогрева проверь компрессию рукой — если поршень легко проходит верхнюю точку, значит гильза подсела, пора менять." } },
```

- [ ] **Step 2:** Typecheck — `cd frontend && npx tsc --noEmit` clean.

---

### Task 3: Backend-track documentation

**Files:** `frontend/docs/backend-endpoints-needed.md`.

- [ ] **Step 1:** Append a new section documenting STT:

```markdown
## 25. Транскрибация голосовых сообщений (speech-to-text)

Landing advertises "Голосовые сообщения с транскрибацией" (Pro). The frontend
ships only the reveal UI (a "Показать текст" toggle on voice bubbles) plus an
honest "Расшифровка недоступна" state; it does NOT do client-side recognition.

`POST /media/{uuid}/transcribe` (or `GET /media/{uuid}/transcript`)
- Auth: required (Pro-gated per the landing claim).
- Response 200: `{ "text": string, "lang"?: string }`. Async STT is acceptable —
  return 202 + a job id, or populate `transcript` on the voice message payload
  once ready.
- Frontend: `VoiceBubble.tsx` currently reads `voice.transcript`; once this
  endpoint exists, "Показать текст" on a transcript-less message would call it
  and render the returned text. STT provider (e.g. Whisper/Yandex SpeechKit)
  is a backend/infra decision — not proposed here.
```

- [ ] **Step 2:** Commit (single sub-stage commit after live verification).

---

### Task 4: Live verification

- [ ] At 375px in the messenger, open dialog d1 (Сергей ДВС): the seeded voice message shows "Показать текст"; clicking reveals the transcript; clicking again hides it (label toggles).
- [ ] Record a live voice note (no transcript): its "Показать текст" reveals the honest "Расшифровка недоступна…" note, not invented text.
- [ ] Both outgoing (`isMe`) and incoming bubbles render the toggle. Desktop spot-check. No new console errors.
