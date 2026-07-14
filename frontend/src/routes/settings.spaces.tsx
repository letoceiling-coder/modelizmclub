import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Users2, Plus, ChevronRight } from "lucide-react";
import { useChannels } from "@/lib/channels";
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
import type { EntityKind } from "@/lib/api/entity-requests";

export const Route = createFileRoute("/settings/spaces")({
  head: () => ({ meta: [{ title: "Мой канал и сообщество — МоДелизМ" }] }),
  component: SettingsSpacesPage,
});

function SettingsSpacesPage() {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const [requestKind, setRequestKind] = useState<EntityKind | null>(null);

  return (
    <div className="flex flex-col gap-[16px]">
      <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        Мой канал и сообщество
      </h1>

      {/* Канал */}
      <Card
        icon={<Radio size={20} />}
        title="Канал"
        subtitle={myChannel ? myChannel.name : "У вас пока нет канала"}
        action={
          myChannel ? (
            <Link
              to="/channel/$id"
              params={{ id: myChannel.slug }}
              className="inline-flex h-10 items-center gap-1 rounded-[10px] border px-4 text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface)]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Мой канал <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setRequestKind("channel")}
              className="inline-flex h-10 items-center gap-1 rounded-[10px] px-4 text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              <Plus size={16} /> Создать канал
            </button>
          )
        }
      />

      {/* Сообщество — владение сообществом фронт определить не может
          (нет роли owner; см. backend-endpoints-needed.md §27). До появления
          бэка всегда показываем ветку «Создать». */}
      <Card
        icon={<Users2 size={20} />}
        title="Сообщество"
        subtitle="Создайте своё сообщество по городу или узкой теме"
        action={
          <button
            type="button"
            onClick={() => setRequestKind("community")}
            className="inline-flex h-10 items-center gap-1 rounded-[10px] px-4 text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            <Plus size={16} /> Создать сообщество
          </button>
        }
      />

      {requestKind && (
        <EntityRequestForm
          kind={requestKind}
          onClose={() => setRequestKind(null)}
          onSubmitted={() => setRequestKind(null)}
        />
      )}
    </div>
  );
}

function Card({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] border p-4 sm:flex-row sm:items-center"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
        <div className="truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
