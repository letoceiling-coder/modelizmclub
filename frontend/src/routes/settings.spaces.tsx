import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Users2, Plus, ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";
import { useChannels, isChannelOwner } from "@/lib/channels";
import { useOwnedCommunities } from "@/lib/api/communities";
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { useStore, selectors } from "@/lib/store";
import { isFullyVerified, verificationMessage } from "@/lib/auth/verification";
import type { EntityKind } from "@/lib/api/entity-requests";

export const Route = createFileRoute("/settings/spaces")({
  head: () => ({ meta: [{ title: "Мой канал и сообщество — МоДелизМ" }] }),
  component: SettingsSpacesPage,
});

function SettingsSpacesPage() {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const { channels } = useChannels();
  const myChannel = channels.find((c) => isChannelOwner(c, me.id));
  const { communities: ownedCommunities } = useOwnedCommunities();
  const myCommunity = ownedCommunities[0];
  const [requestKind, setRequestKind] = useState<EntityKind | null>(null);

  const openRequest = (kind: EntityKind) => {
    if (!isFullyVerified(me)) {
      toast.error(verificationMessage(me));
      navigate({ to: "/settings/account" });
      return;
    }
    setRequestKind(kind);
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <VerificationBanner />
      <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        Мой канал и сообщество
      </h1>

      {/* Канал */}
      <SpaceCard
        icon={<Radio size={20} />}
        title="Канал"
        subtitle={myChannel ? myChannel.name : "У вас пока нет канала"}
        action={
          myChannel ? (
            <Link
              to="/channel/$id"
              params={{ id: myChannel.slug }}
              className={secondaryActionClass}
              style={secondaryActionStyle}
            >
              Мой канал <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openRequest("channel")}
              className={primaryActionClass}
              style={primaryActionStyle}
            >
              <Plus size={16} /> Создать канал
            </button>
          )
        }
      />

      {/* Сообщество */}
      <SpaceCard
        icon={<Users2 size={20} />}
        title="Сообщество"
        subtitle={myCommunity ? myCommunity.name : "Создайте своё сообщество по городу или узкой теме"}
        action={
          myCommunity ? (
            <Link
              to="/communities/$id"
              params={{ id: myCommunity.id }}
              className={secondaryActionClass}
              style={secondaryActionStyle}
            >
              Моё сообщество <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openRequest("community")}
              className={primaryActionClass}
              style={primaryActionStyle}
            >
              <Plus size={16} /> Создать сообщество
            </button>
          )
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

const primaryActionClass =
  "inline-flex h-10 w-full min-w-[220px] items-center justify-center gap-1.5 rounded-[10px] px-4 text-[14px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90 sm:w-[220px]";

const secondaryActionClass =
  "inline-flex h-10 w-full min-w-[220px] items-center justify-center gap-1.5 rounded-[10px] border px-4 text-[14px] font-semibold whitespace-nowrap transition-colors hover:bg-[var(--background-surface)] sm:w-[220px]";

const primaryActionStyle = { background: "var(--accent)", color: "var(--accent-foreground)" } as const;
const secondaryActionStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const;

function SpaceCard({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 rounded-[14px] border p-4 sm:grid-cols-[44px_minmax(0,1fr)_220px] sm:items-start sm:gap-x-4"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full sm:mt-[1px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 sm:col-start-2 sm:row-start-1">
        <div className="text-[15px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
          {title}
        </div>
        <div className="mt-1 text-[13px] leading-snug" style={{ color: "var(--foreground-50)" }}>
          {subtitle}
        </div>
      </div>
      <div className="sm:col-start-3 sm:row-start-1 sm:mt-[1px]">{action}</div>
    </div>
  );
}
