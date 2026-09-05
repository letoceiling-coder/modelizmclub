import { useTranslation } from "react-i18next";
import { MapPin, Users, FileText, Link2, Send, Phone } from "lucide-react";
import type { Community } from "@/lib/mock";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-[var(--r-pill)] px-[10px] py-[3px] text-[12px] font-medium"
      style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
    >
      {children}
    </span>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-[10px] text-[14px]"
      style={{ color: "var(--foreground-70)" }}
    >
      <Icon size={18} className="mt-[1px] shrink-0" style={{ color: "var(--foreground-50)" }} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/**
 * «Подробная информация» — то, чему не место в шапке.
 *
 * Шапка держит 180 px и показывает описание двумя строками; всё остальное,
 * что сообщество о себе рассказывает — правила, направления, город,
 * контакты, — живёт здесь. Окно на десктопе, шторка на телефоне.
 *
 * Показываются только поля, которые сервер действительно прислал: пустых
 * строк с прочерками в окне нет. Владелец и дата создания появятся, когда
 * их начнёт отдавать ресурс сообщества.
 */
export function CommunityDetailsDialog({
  community,
  open,
  onOpenChange,
}: {
  community: Community;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const topics = community.topics ?? [];
  const contacts = community.contacts;

  const body = (
    <div className="space-y-[16px] px-[16px] pb-[16px]">
      {community.fullDescription || community.description ? (
        <p
          className="whitespace-pre-line text-[15px] leading-[1.45]"
          style={{ color: "var(--foreground)" }}
        >
          {community.fullDescription || community.description}
        </p>
      ) : null}

      {(topics.length > 0 || community.category) && (
        <div className="flex flex-wrap gap-[6px]">
          {community.category && <Chip>{community.category}</Chip>}
          {topics.map((topic) => (
            <Chip key={topic.id}>{topic.name}</Chip>
          ))}
          {community.customCategory && <Chip>{community.customCategory}</Chip>}
        </div>
      )}

      <div className="space-y-[10px]">
        <Row icon={Users}>
          {t("pages.communityDetail.members", { count: community.members })}
          {(community.postsCount ?? 0) > 0 && (
            <> · {t("pages.communityDetail.postsCount", { count: community.postsCount })}</>
          )}
        </Row>
        {community.city?.name && <Row icon={MapPin}>{community.city.name}</Row>}
        {contacts?.website && (
          <Row icon={Link2}>
            <a
              href={contacts.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all hover:underline"
              style={{ color: "var(--accent)" }}
            >
              {contacts.website}
            </a>
          </Row>
        )}
        {contacts?.telegram && (
          <Row icon={Send}>
            <span className="break-all">{contacts.telegram}</span>
          </Row>
        )}
        {contacts?.phone && (
          <Row icon={Phone}>
            <span className="break-all">{contacts.phone}</span>
          </Row>
        )}
      </div>

      {community.rules && (
        <div>
          <div
            className="mb-[6px] flex items-center gap-[8px] text-[15px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            <FileText size={18} style={{ color: "var(--foreground-50)" }} />
            {t("pages.communityDetail.rulesTitle")}
          </div>
          <p
            className="whitespace-pre-line text-[14px] leading-[1.45]"
            style={{ color: "var(--foreground-70)" }}
          >
            {community.rules}
          </p>
        </div>
      )}
    </div>
  );

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh]">
          <div className="flex max-h-[85dvh] flex-col">
            <div className="px-[16px] pb-[8px] pt-[12px]">
              <DrawerTitle className="text-[20px] font-semibold">
                {t("pages.communityDetail.detailsTitle")}
              </DrawerTitle>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[480px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-[16px] p-0 pt-[16px]">
        <div className="px-[16px] pb-[8px]">
          <DialogTitle className="text-[20px] font-semibold">
            {t("pages.communityDetail.detailsTitle")}
          </DialogTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
