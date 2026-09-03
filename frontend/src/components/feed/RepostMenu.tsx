import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Repeat2, Share2, MessageSquare, Link2, Check, ArrowLeft } from "lucide-react";
import { toast } from "@/lib/toast";
import { actions } from "@/lib/store";
import { userById } from "@/lib/mock";
import { sendPostShareMessage } from "@/lib/api/chat";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import { SHARE_TARGETS, openShareTarget } from "@/lib/share-targets";
import { useDialogs } from "@/lib/messenger";

interface Props {
  postId: string;
  reposted: boolean;
  count: number;
  onRepost: () => void;
  disabled?: boolean;
}

type View = "main" | "chats" | "share";

export function RepostMenu({ postId, reposted, count, onRepost, disabled = false }: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dialogs } = useDialogs();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView("main");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "main") setView("main");
        else setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  const url = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const close = () => {
    setOpen(false);
    setView("main");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success(t("components.repostMenu.linkCopied"));
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("components.repostMenu.copyFailed"));
    }
  };

  // The toast lives in the caller: a guest's repost is intercepted by the
  // auth guard, so announcing success here would lie.
  const repostToFeed = () => {
    onRepost();
    close();
  };

  const shareTo = (href: string) => {
    openShareTarget(href);
    close();
  };

  const openChats = () => {
    if (guest) {
      guest.guardAction("messenger.send", () => setView("chats"));
      return;
    }
    setView("chats");
  };

  const sendToChat = async (dialogId: string, partnerName: string) => {
    close();
    try {
      const message = await sendPostShareMessage(dialogId, postId);
      actions.addMessage(dialogId, message);
      toast.success(t("components.repostMenu.sentTo", { name: partnerName }));
    } catch {
      // Fall back to a plain link if the post card couldn't be attached
      // (e.g. the post is no longer published) — the chat still opens.
      actions.queuePendingMessage(dialogId, `🔗 ${t("components.repostMenu.postTitle")}: ${url()}`);
      toast.error(t("components.repostMenu.sendFailed"));
    }
    navigate({ to: "/messenger", search: { chat: dialogId } });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-[6px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-45"
        style={{
          color: reposted ? "var(--accent)" : "var(--foreground-70)",
          background: open ? "var(--background-surface)" : "transparent",
        }}
        aria-label={t("components.repostMenu.ariaLabel")}
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <Repeat2 className="h-[16px] w-[16px]" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-0 z-[60] mb-[8px] w-[260px] overflow-hidden rounded-[12px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            {view === "main" && (
              <>
                <Item onClick={repostToFeed} icon={Repeat2} label={reposted ? t("components.repostMenu.undoRepost") : t("components.repostMenu.repostToFeed")} accent />
                <Item onClick={openChats} icon={MessageSquare} label={t("components.repostMenu.sendToMessages")} />
                <div className="border-t" style={{ borderColor: "var(--border)" }} />
                <Item onClick={() => setView("share")} icon={Share2} label={t("components.repostMenu.share")} />
              </>
            )}
            {view === "share" && (
              <div>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="flex w-full items-center gap-[8px] border-b px-[14px] py-[10px] text-[13px] font-semibold"
                  style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
                >
                  <ArrowLeft className="h-[14px] w-[14px]" /> {t("components.repostMenu.share")}
                </button>
                {SHARE_TARGETS.map((target) => (
                  <Item
                    key={target.id}
                    onClick={() => shareTo(target.href(url()))}
                    icon={Share2}
                    label={target.label}
                  />
                ))}
                <Item
                  onClick={copyLink}
                  icon={copied ? Check : Link2}
                  label={copied ? t("components.repostMenu.copied") : t("components.repostMenu.copyLink")}
                  accent={copied}
                />
              </div>
            )}
            {view === "chats" && (
              <div>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="flex w-full items-center gap-[8px] border-b px-[14px] py-[10px] text-[13px] font-semibold"
                  style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
                >
                  <ArrowLeft className="h-[14px] w-[14px]" /> {t("components.repostMenu.whereToSend")}
                </button>
                <div className="max-h-[280px] overflow-y-auto">
                  {dialogs.length === 0 ? (
                    <div className="px-[14px] py-[16px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {t("components.repostMenu.noDialogs")}
                    </div>
                  ) : (
                    dialogs.map((d) => {
                      const u = userById(d.userId);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => sendToChat(d.id, u.name)}
                          className="flex w-full items-center gap-[10px] px-[14px] py-[8px] text-left transition-colors hover:bg-[var(--background-surface)]"
                        >
                          <img src={u.avatar} width={28} height={28} loading="lazy" decoding="async" alt="" className="h-[28px] w-[28px] rounded-full object-cover" />
                          <span className="text-[13px]" style={{ color: "var(--foreground)" }}>{u.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Repeat2;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" style={{ color: accent ? "var(--accent)" : "var(--foreground-70)" }} />
      {label}
    </button>
  );
}
