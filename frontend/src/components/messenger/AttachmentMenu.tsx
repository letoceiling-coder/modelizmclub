import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Image as ImageIcon, Video, File as FileIcon } from "lucide-react";
import { toast } from "@/lib/toast";

export type AttachmentKind = "image" | "video" | "file";

interface Props {
  onPick: (file: File, kind: AttachmentKind) => void;
}

const MAX_BYTES = 20 * 1024 * 1024;

export function AttachmentMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<AttachmentKind>("file");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPicker = (kind: AttachmentKind) => {
    setOpen(false);
    pendingKind.current = kind;
    const accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "*/*";
    if (inputRef.current) {
      inputRef.current.accept = accept;
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Файл слишком большой", { description: "Максимум 20 МБ в демо-режиме" });
      return;
    }
    onPick(file, pendingKind.current);
  };

  return (
    <div className="relative" ref={ref}>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[40px] sm:w-[40px]"
        style={{ color: "var(--foreground-50)" }}
        aria-label="Прикрепить"
        aria-expanded={open}
      >
        <Paperclip size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-0 z-[60] mb-[8px] w-[180px] overflow-hidden rounded-[12px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <MenuItem icon={ImageIcon} label="Фото" onClick={() => openPicker("image")} />
            <MenuItem icon={Video} label="Видео" onClick={() => openPicker("video")} />
            <MenuItem icon={FileIcon} label="Файл" onClick={() => openPicker("file")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ImageIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
      {label}
    </button>
  );
}
