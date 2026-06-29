import { ImagePlus, Smile, MapPin } from "lucide-react";
import { useStore, selectors } from "@/lib/store";

export type PostIntent = "photo" | "emoji" | "place";

interface Props {
  onOpen: (intent?: PostIntent) => void;
}

export function CreatePostTrigger({ onOpen }: Props) {
  const me = useStore(selectors.currentUser);
  return (
    <div
      className="rounded-[14px] border p-[14px]"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-[12px]">
        <img src={me.avatar} alt="" className="h-[40px] w-[40px] rounded-full" />
        <button
          onClick={() => onOpen()}
          className="flex-1 rounded-[10px] border px-[14px] py-[10px] text-left text-[14px] transition-colors"
          style={{
            background: "var(--background-surface)",
            borderColor: "var(--border)",
            color: "var(--foreground-50)",
          }}
        >
          Что нового, {me.name.split(" ")[0]}?
        </button>
      </div>
      <div
        className="mt-[10px] flex items-center gap-[4px] border-t pt-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        <ActionBtn icon={<ImagePlus className="h-[16px] w-[16px]" />} label="Фото" onClick={() => onOpen("photo")} />
        <ActionBtn icon={<Smile className="h-[16px] w-[16px]" />} label="Эмоции" onClick={() => onOpen("emoji")} />
        <ActionBtn icon={<MapPin className="h-[16px] w-[16px]" />} label="Место" onClick={() => onOpen("place")} />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex flex-1 items-center justify-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground-70)" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
