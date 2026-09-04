import { Suspense, lazy } from "react";

import type {
  CropInteractionMode,
  PhotoEditorDialogProps,
} from "@/components/media/PhotoEditorDialogImpl";

export type { CropInteractionMode, PhotoEditorDialogProps };

/**
 * The editor pulls in Cropper.js and its stylesheet (~95 KB raw) and is only
 * ever shown after a deliberate "edit photo" click, so it is kept out of the
 * entry chunk. Thirteen call sites import this module directly — keeping the
 * split here, rather than at each of them, means none of them has to know.
 */
const PhotoEditorDialogImpl = lazy(() =>
  import("@/components/media/PhotoEditorDialogImpl").then((m) => ({
    default: m.PhotoEditorDialog,
  })),
);

export function PhotoEditorDialog(props: PhotoEditorDialogProps) {
  // Same visibility rule as the implementation: explicit `open`, or a
  // non-null source in the legacy ImageCropDialog-compatible mode. Nothing is
  // fetched until the dialog is actually opened.
  const isOpen = props.open ?? (props.src ?? props.file) != null;

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <PhotoEditorDialogImpl {...props} />
    </Suspense>
  );
}
