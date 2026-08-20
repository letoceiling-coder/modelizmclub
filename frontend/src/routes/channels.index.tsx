import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { Radio, Users, Check, BadgeCheck, Store, Briefcase, Sparkles, Settings2, BarChart2, MoreVertical, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";

import {

  useChannels, setChannelSubscription, isChannelOwner,

  formatCount,
  type Channel, type ChannelKind,
} from "@/lib/channels";

import { useStore, selectors } from "@/lib/store";

import { toast } from "@/lib/toast";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

import { Button } from "@/components/ui/button";

import { SearchInput } from "@/components/ui/search-input";

import { EmptyState } from "@/components/ui/empty-state";

import { DeleteChannelDialog } from "@/components/channels/DeleteChannelDialog";
import { ChannelsPageSkeleton } from "@/components/channels/ChannelCardSkeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



import i18n from "@/lib/i18n";



export const Route = createFileRoute("/channels/")({

  head: () => ({ meta: [{ title: i18n.t("pages.channels.metaTitle") }, { name: "description", content: i18n.t("pages.channels.metaDescription") }] }),

  component: ChannelsPage,

});



const KIND_ICON: Record<ChannelKind, typeof BadgeCheck> = {

  official: BadgeCheck,

  brand: Briefcase,

  shop: Store,

  author: Sparkles,

  expert: Sparkles,

};



const SECTION_LIMIT = 6;

function channelKindLabel(kind: ChannelKind, tr: (key: string) => string): string {
  const map: Record<ChannelKind, string> = {
    official: "pages.channels.kindOfficial",
    brand: "pages.channels.kindBrand",
    shop: "pages.channels.kindShop",
    author: "pages.channels.kindAuthor",
    expert: "pages.channels.kindExpert",
  };
  return tr(map[kind] ?? "pages.channels.kindDefault");
}

function channelOwnerRoleLabel(kind: ChannelKind, tr: (key: string) => string): string {
  return kind === "author" ? tr("pages.shared.author") : tr("pages.shared.owner");
}



function ChannelSection({

  title,

  subtitle,

  items,

  mine,

  onChanged,

}: {

  title: string;

  subtitle?: string;

  items: Channel[];

  mine?: boolean;

  onChanged: () => void;

}) {

  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, SECTION_LIMIT);

  const canExpand = items.length > SECTION_LIMIT;



  return (

    <section className="space-y-[14px]">

      <div className="flex items-end justify-between gap-[12px]">

        <div className="min-w-0">

          <h2 className="flex items-center gap-[8px] font-display text-[18px] font-bold sm:text-[20px]" style={{ color: "var(--foreground)" }}>

            {title}

            <span

              className="inline-flex h-[22px] min-w-[22px] items-center justify-center px-[7px] text-[12px] font-bold"

              style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}

            >

              {items.length}

            </span>

          </h2>

          {subtitle && (

            <p className="mt-[2px] text-[13px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</p>

          )}

        </div>

        {canExpand && (

          <button

            type="button"

            onClick={() => setExpanded((v) => !v)}

            className="shrink-0 whitespace-nowrap text-[13px] font-semibold transition-colors hover:opacity-80"

            style={{ color: "var(--accent)" }}

          >

            {expanded ? t("pages.shared.collapse") : t("pages.shared.showAll")}

          </button>

        )}

      </div>

      <ul
        className={
          expanded
            ? "grid list-none gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            : "grid list-none gap-3 sm:grid-cols-2"
        }
      >
        {visible.map((c) =>
          mine ? (
            <MyChannelCard key={c.id} channel={c} onChanged={onChanged} />
          ) : (
            <ChannelCard key={c.id} channel={c} subscribed={Boolean(c.isSubscribed)} onChanged={onChanged} />
          ),
        )}
      </ul>

    </section>

  );

}



function ChannelsPage() {

  const { t } = useTranslation();

  const { channels: all, loading, reload } = useChannels();

  const me = useStore(selectors.currentUser);

  const navigate = useNavigate();

  const [q, setQ] = useState("");



  const filtered = useMemo(() => {

    const query = q.trim().toLowerCase();

    if (!query) return all;

    return all.filter(

      (c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),

    );

  }, [all, q]);



  const mine = useMemo(

    () => filtered.filter((c) => isChannelOwner(c, me.id)).sort((a, b) => a.name.localeCompare(b.name, "ru")),

    [filtered, me.id],

  );

  const subscriptions = useMemo(

    () => filtered.filter((c) => c.isSubscribed && !isChannelOwner(c, me.id)),

    [filtered, me.id],

  );

  const catalog = useMemo(

    () => filtered.filter((c) => !isChannelOwner(c, me.id)),

    [filtered, me.id],

  );

  const popular = useMemo(

    () => [...catalog].sort((a, b) => b.subscribers - a.subscribers),

    [catalog],

  );

  const newest = useMemo(

    () => [...catalog].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),

    [catalog],

  );



  const nothing = filtered.length === 0;

  const hasQuery = q.trim().length > 0;



  return (

    <AppLayout rightColumn={false} footer>

      <div className="space-y-[24px]">

        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">

          <div className="min-w-0">

            <h1 className="font-display text-[26px] sm:text-[28px] font-bold truncate" style={{ color: "var(--foreground)" }}>

              {t("pages.channels.title")}

            </h1>

            <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: "var(--foreground-50)" }}>

              {t("pages.channels.subtitle")}

            </p>

          </div>

          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--accent-soft)" }}>

            <Radio size={20} style={{ color: "var(--accent)" }} />

          </div>

        </header>



        <SearchInput

          value={q}

          onChange={(e) => setQ(e.target.value)}

          onClear={() => setQ("")}

          placeholder={t("pages.channels.searchPlaceholder")}

        />



        {loading ? (
          <ChannelsPageSkeleton />
        ) : nothing ? (

          <EmptyState

            icon={Radio}

            title={hasQuery ? t("pages.shared.nothingFound") : t("pages.channels.emptyTitle")}

            description={hasQuery ? t("pages.channels.emptySearchDesc") : t("pages.channels.emptyDesc")}

            action={!hasQuery ? { label: t("pages.channels.createChannel"), onClick: () => navigate({ to: "/settings/spaces" }) } : undefined}

            variant="compact"

          />

        ) : (

          <div className="space-y-[28px]">

            <ChannelSection title={t("pages.channels.sectionMine")} subtitle={t("pages.channels.sectionMineSub")} items={mine} mine onChanged={reload} />

            <ChannelSection title={t("pages.channels.sectionSubscriptions")} subtitle={t("pages.channels.sectionSubscriptionsSub")} items={subscriptions} onChanged={reload} />

            <ChannelSection title={t("pages.channels.sectionPopular")} subtitle={t("pages.channels.sectionPopularSub")} items={popular} onChanged={reload} />

            <ChannelSection title={t("pages.channels.sectionNew")} subtitle={t("pages.channels.sectionNewSub")} items={newest} onChanged={reload} />

          </div>

        )}

      </div>

    </AppLayout>

  );

}



function MyChannelCard({ channel: c, onChanged }: { channel: Channel; onChanged: () => void }) {

  const { t } = useTranslation();

  const KindIcon = KIND_ICON[c.kind];

  const [deleteOpen, setDeleteOpen] = useState(false);

  return (

    <li>

      <div

        className="flex h-full flex-col gap-3 p-4"

        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)", display: "flex" }}

      >

        <div className="flex items-start gap-2">

          <Link

            to="/channel/$id"

            params={{ id: c.id }}

            className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 transition-colors hover:opacity-90"

          >

            <div

              className="grid h-12 w-12 shrink-0 place-items-center font-display text-[18px] font-bold text-white"

              style={{ background: c.avatarColor, borderRadius: 12 }}

            >

              {c.name.slice(0, 1)}

            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-1.5">

                <span className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>

                  {c.name}

                </span>

                {c.kind === "official" && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}

              </div>

              <p

                className="mt-1 text-[13px]"

                style={{ color: "var(--foreground-70)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}

              >

                {c.description}

              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">

                <span

                  className="inline-flex items-center gap-1 text-[11px] font-medium"

                  style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 7px", borderRadius: 6 }}

                >

                  {channelOwnerRoleLabel(c.kind, t)}

                </span>

                <span

                  className="inline-flex items-center gap-1 text-[11px] font-medium"

                  style={{ background: "var(--background-surface)", color: "var(--foreground-70)", padding: "3px 7px", borderRadius: 6 }}

                >

                  <KindIcon size={11} /> {channelKindLabel(c.kind, t)}

                </span>

                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>

                  <Users size={12} /> {formatCount(c.subscribers)}

                </span>

              </div>

            </div>

          </Link>

          <DropdownMenu>

            <DropdownMenuTrigger asChild>

              <button

                type="button"

                aria-label={t("pages.channels.ownerMenuAria")}

                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"

                style={{ color: "var(--foreground-70)" }}

              >

                <MoreVertical size={16} />

              </button>

            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-[180px]">

              <DropdownMenuItem asChild>

                <Link to="/channel/$id" params={{ id: c.id }} search={{ settings: true }} className="gap-2">

                  <Settings2 size={14} /> {t("pages.shared.settings")}

                </Link>

              </DropdownMenuItem>

              <DropdownMenuItem asChild>

                <Link to="/channel/$id" params={{ id: c.id }} search={{ tab: "about", section: "stats" }} className="gap-2">

                  <BarChart2 size={14} /> {t("pages.shared.statistics")}

                </Link>

              </DropdownMenuItem>

              <DropdownMenuItem

                className="gap-2 text-[rgb(185,28,28)] focus:text-[rgb(185,28,28)]"

                onSelect={() => setDeleteOpen(true)}

              >

                <Trash2 size={14} /> {t("components.channelManage.deleteChannel")}

              </DropdownMenuItem>

            </DropdownMenuContent>

          </DropdownMenu>

        </div>

        <DeleteChannelDialog

          slug={c.slug}

          name={c.name}

          onDeleted={onChanged}

          open={deleteOpen}

          onOpenChange={setDeleteOpen}

          hideTrigger

        />

      </div>

    </li>

  );

}



function ChannelCard({ channel: c, subscribed, onChanged }: { channel: Channel; subscribed: boolean; onChanged: () => void }) {

  const { t } = useTranslation();
  const { requirePremium } = useGuestAccess();

  const KindIcon = KIND_ICON[c.kind];

  const onToggle = (e: React.MouseEvent) => {

    e.preventDefault();

    e.stopPropagation();

    requirePremium(() => {
      void (async () => {
        try {
          await setChannelSubscription(c.slug, !subscribed);
          onChanged();
        } catch {
          toast.error(t("pages.channels.subscribeFailed"));
        }
      })();
    });

  };

  return (

    <li>

      <div

        className="flex h-full flex-col gap-3 p-4"

        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)", display: "flex" }}

      >

        <Link

          to="/channel/$id"

          params={{ id: c.id }}

          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 transition-colors hover:opacity-90"

        >

          <div

            className="grid h-12 w-12 shrink-0 place-items-center font-display text-[18px] font-bold text-white"

            style={{ background: c.avatarColor, borderRadius: 12 }}

          >

            {c.name.slice(0, 1)}

          </div>

          <div className="min-w-0">

            <div className="flex items-center gap-1.5">

              <span className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>

                {c.name}

              </span>

              {c.kind === "official" && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}

            </div>

            <p

              className="mt-1 text-[13px]"

              style={{ color: "var(--foreground-70)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}

            >

              {c.description}

            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">

              {subscribed && (

                <span

                  className="inline-flex items-center gap-1 text-[11px] font-medium"

                  style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 7px", borderRadius: 6 }}

                >

                  {t("pages.shared.subscribed")}

                </span>

              )}

              <span

                className="inline-flex items-center gap-1 text-[11px] font-medium"

                style={{ background: "var(--background-surface)", color: "var(--foreground-70)", padding: "3px 7px", borderRadius: 6 }}

              >

                <KindIcon size={11} /> {channelKindLabel(c.kind, t)}

              </span>

              <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>

                <Users size={12} /> {formatCount(c.subscribers)}

              </span>

            </div>

          </div>

        </Link>

        <div className="mt-auto flex items-center gap-2">

          <Button

            variant={subscribed ? "outline" : "default"}

            onClick={onToggle}

            className="w-full rounded-[10px]"

            size="sm"

          >

            {subscribed ? (<><Check size={14} /> {t("pages.shared.youSubscribed")}</>) : t("pages.shared.subscribe")}

          </Button>

        </div>

      </div>

    </li>

  );

}

