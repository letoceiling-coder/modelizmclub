import { X, Film } from "lucide-react";

interface Props {
  fileUrl: string | null;         // blob preview URL, or null
  onPick: (file: File) => void;
  onClear: () => void;
  accept: string;                 // "video/*" or "image/*"
  label: string;
}

export function VideoUploadField({ fileUrl, onPick, onClear, accept, label }: Props) {
  return (
    <div className="space-y-[8px]">
      {fileUrl ? (
        <div className="relative overflow-hidden" style={{ borderRadius: "var(--r-card)", border: "1px solid var(--border)" }}>
          {accept.startsWith("video") ? (
            <video src={fileUrl} controls preload="metadata" className="w-full" style={{ maxHeight: 240, background: "#000" }} />
          ) : (
            <img src={fileUrl} alt="" className="w-full object-cover" style={{ maxHeight: 240 }} />
          )}
          <button type="button" onClick={onClear} aria-label="Убрать" className="absolute right-[8px] top-[8px] grid h-[28px] w-[28px] place-items-center rounded-full" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="grid cursor-pointer place-items-center gap-[8px] py-[28px] text-center" style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--r-card)", color: "var(--foreground-50)" }}>
          <Film size={22} />
          <span className="text-[13px]">{label}</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
