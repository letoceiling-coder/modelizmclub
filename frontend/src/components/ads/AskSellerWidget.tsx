import { useState } from "react";
import { Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QUICK_QUESTIONS = [
  "Где и когда можно посмотреть?",
  "Актуально ли объявление?",
  "Торг уместен?",
  "Возможна доставка?",
];

/** Compact "ask a quick question" widget — sends straight into the existing
 *  messenger/dialog with the seller (via onAsk), not a separate Q&A system. */
export function AskSellerWidget({ onAsk }: { onAsk: (text: string) => void }) {
  const [text, setText] = useState("");

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setText("");
  };

  return (
    <Card
      className="flex flex-col gap-[10px] p-[14px]"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
        Спросите у продавца
      </h3>
      <div className="flex flex-wrap gap-[6px]">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setText(q)}
            className="text-[11.5px] font-medium transition-colors"
            style={{
              padding: "6px 10px",
              borderRadius: "var(--r-tag)",
              background: "var(--background-surface)",
              color: "var(--foreground-70)",
              border: "1px solid var(--border)",
            }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex gap-[8px]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ваш вопрос…"
          className="h-[36px] flex-1 min-w-0 text-[13px] outline-none"
          style={{
            background: "var(--background-surface)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            padding: "0 10px",
          }}
        />
        <Button size="sm" onClick={send} disabled={!text.trim()} className="h-[36px] shrink-0 rounded-[var(--r-button)] px-[12px]" aria-label="Отправить вопрос">
          <Send size={14} />
        </Button>
      </div>
    </Card>
  );
}
