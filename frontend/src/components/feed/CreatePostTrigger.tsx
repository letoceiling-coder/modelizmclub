import { ImagePlus } from "lucide-react";
import { useStore, selectors } from "@/lib/store";

export type PostIntent = "photo" | "emoji" | "place";

interface Props {
  onOpen: (intent?: PostIntent) => void;
}

export function CreatePostTrigger({ onOpen }: Props) {
  const me = useStore(selectors.currentUser);
  return (
    <div
      className="rounded-[var(--r-card)] border p-[12px]"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-[12px]">
        <img src={me.avatar} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full" />
        <button
          onClick={() => onOpen()}
          className="min-w-0 flex-1 rounded-[var(--r-pill)] border px-[16px] py-[10px] text-left text-[14px] transition-colors hover:bg-[var(--background-surface-hover)]"
          style={{
            background: "var(--background-surface)",
            borderColor: "var(--border)",
            color: "var(--foreground-50)",
          }}
        >
          Что нового, {me.name.split(" ")[0]}?
        </button>
        <button
          onClick={() => onOpen("photo")}
          aria-label="Добавить фото"
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <ImagePlus className="h-[20px] w-[20px]" />
        </button>
      </div>
    </div>
  );
}
