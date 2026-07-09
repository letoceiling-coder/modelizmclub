import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Full-screen image viewer. Portaled to document.body (same pattern used by
 * MessageActionsMenu/DialogContextMenu) so it isn't clipped by any animated
 * ancestor's stacking context. Click backdrop, tap the close button, or
 * press Escape to dismiss.
 */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute grid place-items-center rounded-full transition-colors"
        style={{
          top: "max(16px, env(safe-area-inset-top))",
          right: "max(16px, env(safe-area-inset-right))",
          width: 40,
          height: 40,
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
        }}
      >
        <X size={20} />
      </button>
      {/* stopPropagation so tapping the image itself doesn't close (only backdrop/button do) */}
      <img
        src={src}
        alt={alt ?? ""}
        className="max-h-full max-w-full object-contain"
        style={{ borderRadius: 4 }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
