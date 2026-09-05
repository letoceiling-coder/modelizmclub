import type { LucideIcon } from "lucide-react";
import { EntityBrandingForm } from "@/components/entity/EntityBrandingForm";
import { EntityBrandingEditors } from "@/components/entity/EntityBrandingEditors";
import { useEntityBranding } from "@/components/entity/useEntityBranding";
import { communityBrandingConfig } from "@/components/communities/communityBranding";
import type { Community } from "@/lib/mock";

interface Props {
  community: Community;
  Icon: LucideIcon;
  onUpdated: (community: Community) => void;
}

export function CommunityBrandingForm({ community, Icon, onUpdated }: Props) {
  const branding = useEntityBranding(communityBrandingConfig(community, onUpdated));

  return (
    <>
      <EntityBrandingForm
        branding={branding}
        labels={{
          avatarLabel: "Аватар",
          avatarButton: "Изменить аватар",
          avatarHint: "JPG, PNG, WEBP · до 5 МБ · 480×480",
          coverLabel: "Обложка",
          coverButton: "Изменить обложку",
          coverHint: "JPG, PNG, WEBP · до 10 МБ · 1400×400",
          uploading: "Загрузка…",
        }}
        coverBackground="linear-gradient(135deg, var(--accent), var(--accent-muted))"
        avatarFallback={
          <div
            className="grid h-full w-full place-items-center"
            style={{ background: "var(--accent-soft)" }}
          >
            <Icon size={28} style={{ color: "var(--accent)" }} />
          </div>
        }
        coverFallback={
          <div className="grid h-24 place-items-center opacity-40">
            <Icon size={40} color="#fff" />
          </div>
        }
      />

      <EntityBrandingEditors
        branding={branding}
        avatar={{ title: "Аватар сообщества", shape: "circle" }}
        cover={{ title: "Обложка сообщества" }}
      />
    </>
  );
}
