import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { uploadMedia } from "@/lib/api/media";
import { eventErrors, type ClubEvent, type EventInput } from "@/lib/api/events";
import { fromLocalInput, toLocalInput } from "@/components/events/event-format";
import { toast } from "@/lib/toast";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;
const COVER_WIDTH = 1280;
const COVER_HEIGHT = 720;

/**
 * Форма мероприятия — одна для сообщества, админки и правки.
 *
 * Обязательные поля помечены звёздочкой и проверяются до отправки; всё, что
 * сервер вернул в 422, раскладывается под своими полями теми же словами, что
 * написаны в `ClubEventRules`. Чего формы нет среди полей (лимит, права), —
 * одной строкой над кнопкой.
 */
export function EventFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  submit,
  onSaved,
  allowDraft = true,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ClubEvent | null;
  title: string;
  submit: (input: EventInput) => Promise<ClubEvent>;
  onSaved: (event: ClubEvent) => void;
  allowDraft?: boolean;
  /** Дополнительные поля над кнопкой (в админке — сообщество). */
  extra?: ReactNode;
}) {
  const editing = Boolean(initial);
  const past = initial?.displayStatus === "past";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [cover, setCover] = useState<{ uuid: string; url: string } | null>(null);
  const [draft, setDraft] = useState(false);
  const [editorSrc, setEditorSrc] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setWhen(toLocalInput(initial?.startsAt));
    setPlace(initial?.locationName ?? "");
    setLat(initial?.latitude != null ? String(initial.latitude) : "");
    setLng(initial?.longitude != null ? String(initial.longitude) : "");
    setCover(
      initial?.coverUuid && initial.coverUrl
        ? { uuid: initial.coverUuid, url: initial.coverUrl }
        : null,
    );
    setDraft(initial?.status === "draft");
    setErrors({});
    setFormError("");
  }, [open, initial]);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const applyCover = async (blob: Blob) => {
    setEditorSrc(null);
    setUploading(true);
    try {
      const file = new File([blob], "event-cover.jpg", { type: blob.type || "image/jpeg" });
      const media = await uploadMedia(file, "cover");
      setCover({ uuid: media.uuid, url: media.url ?? URL.createObjectURL(blob) });
      clearError("cover_media_uuid");
    } catch {
      toast.error("Не удалось загрузить обложку");
    } finally {
      setUploading(false);
    }
  };

  const validate = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (name.trim().length < 3) out.title = "Название — не короче 3 символов.";
    if (!past) {
      if (!when) out.starts_at = "Укажите дату и время начала.";
      else {
        const iso = fromLocalInput(when);
        if (!iso) out.starts_at = "Дата и время указаны неверно.";
        else if (new Date(iso).getTime() <= Date.now())
          out.starts_at = "Начало должно быть в будущем.";
      }
    }
    const latN = Number(lat.trim().replace(",", "."));
    const lngN = Number(lng.trim().replace(",", "."));
    const hasLat = lat.trim() !== "";
    const hasLng = lng.trim() !== "";
    if (hasLat !== hasLng) {
      out[hasLat ? "longitude" : "latitude"] = "Укажите обе координаты или ни одной.";
    }
    if (hasLat && (Number.isNaN(latN) || Math.abs(latN) > 90)) {
      out.latitude = "Широта — от −90 до 90.";
    }
    if (hasLng && (Number.isNaN(lngN) || Math.abs(lngN) > 180)) {
      out.longitude = "Долгота — от −180 до 180.";
    }
    return out;
  };

  const onSubmit = async () => {
    const local = validate();
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length > 0) return;

    const startsAt = fromLocalInput(when) ?? undefined;
    const input: EventInput = {
      title: name.trim(),
      description: description.trim() || null,
      locationName: place.trim() || null,
      latitude: lat.trim() ? Number(lat.trim().replace(",", ".")) : null,
      longitude: lng.trim() ? Number(lng.trim().replace(",", ".")) : null,
      coverMediaUuid: cover?.uuid ?? null,
    };
    // Время отправляем, только если его поменяли: прошедшее не переносят,
    // а неизменённое не должно упираться в «начало в будущем».
    if (!editing || (!past && toLocalInput(initial?.startsAt) !== when)) input.startsAt = startsAt;
    if (allowDraft && (!editing || initial?.status !== "cancelled")) {
      input.status = draft ? "draft" : "published";
    }

    setSaving(true);
    try {
      const saved = await submit(input);
      onSaved(saved);
      onOpenChange(false);
      toast.success(
        editing ? "Изменения сохранены" : draft ? "Черновик сохранён" : "Мероприятие опубликовано",
      );
    } catch (error) {
      const parsed = eventErrors(error);
      setErrors(parsed.fields);
      const known = [
        "title",
        "description",
        "starts_at",
        "location_name",
        "latitude",
        "longitude",
        "cover_media_uuid",
      ];
      const loose = Object.entries(parsed.fields).filter(([key]) => !known.includes(key));
      setFormError(
        loose[0]?.[1] ?? (Object.keys(parsed.fields).length === 0 ? parsed.message : ""),
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Поля со звёздочкой <span style={{ color: "var(--error, #dc2626)" }}>*</span>{" "}
              обязательны.
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-2 flex flex-col gap-3.5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <Field label="Обложка" hint="16:9, до 1280×720" error={errors.cover_media_uuid}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) setEditorSrc(file);
                }}
              />
              {cover ? (
                <div
                  className="relative aspect-video w-full overflow-hidden rounded-[12px] border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <img src={cover.url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute bottom-[8px] right-[8px] flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy}
                    >
                      Заменить
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setCover(null)}
                      disabled={busy}
                      aria-label="Убрать обложку"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="grid aspect-video w-full place-items-center rounded-[12px] border border-dashed text-[13px]"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--foreground-50)",
                    background: "var(--background-surface)",
                  }}
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <ImagePlus size={22} aria-hidden />
                    {uploading ? "Загружаем…" : "Добавить обложку"}
                  </span>
                </button>
              )}
            </Field>

            <Field
              id="ev-title"
              label="Название"
              required
              error={errors.title}
              counter={`${name.length}/${TITLE_MAX}`}
            >
              <input
                id="ev-title"
                value={name}
                maxLength={TITLE_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("title");
                }}
                aria-invalid={Boolean(errors.title)}
                aria-required
                className={inputClass}
                style={inputStyle(errors.title)}
              />
            </Field>

            <Field
              id="ev-when"
              label="Дата и время начала (МСК)"
              required={!past}
              error={errors.starts_at}
              hint={past ? "Мероприятие прошло — время не меняется" : undefined}
            >
              <input
                id="ev-when"
                type="datetime-local"
                value={when}
                disabled={past}
                onChange={(e) => {
                  setWhen(e.target.value);
                  clearError("starts_at");
                }}
                aria-invalid={Boolean(errors.starts_at)}
                aria-required={!past}
                className={inputClass}
                style={inputStyle(errors.starts_at)}
              />
            </Field>

            <Field
              id="ev-place"
              label="Место"
              error={errors.location_name}
              hint="Адрес или название площадки"
            >
              <input
                id="ev-place"
                value={place}
                maxLength={255}
                onChange={(e) => {
                  setPlace(e.target.value);
                  clearError("location_name");
                }}
                className={inputClass}
                style={inputStyle(errors.location_name)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field id="ev-lat" label="Широта" error={errors.latitude}>
                <input
                  id="ev-lat"
                  inputMode="decimal"
                  value={lat}
                  placeholder="45.0355"
                  onChange={(e) => {
                    setLat(e.target.value);
                    clearError("latitude");
                  }}
                  className={inputClass}
                  style={inputStyle(errors.latitude)}
                />
              </Field>
              <Field id="ev-lng" label="Долгота" error={errors.longitude}>
                <input
                  id="ev-lng"
                  inputMode="decimal"
                  value={lng}
                  placeholder="38.9753"
                  onChange={(e) => {
                    setLng(e.target.value);
                    clearError("longitude");
                  }}
                  className={inputClass}
                  style={inputStyle(errors.longitude)}
                />
              </Field>
            </div>
            <p className="-mt-2 text-[12px]" style={{ color: "var(--foreground-50)" }}>
              С координатами на странице мероприятия появится карта.
            </p>

            <Field
              id="ev-desc"
              label="Описание"
              error={errors.description}
              counter={`${description.length}/${DESCRIPTION_MAX}`}
            >
              <textarea
                id="ev-desc"
                value={description}
                maxLength={DESCRIPTION_MAX}
                rows={5}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearError("description");
                }}
                className="min-h-[120px] rounded-[10px] border px-3 py-2 text-[14px]"
                style={inputStyle(errors.description)}
              />
            </Field>

            {extra}

            {allowDraft &&
              initial?.status !== "cancelled" &&
              (!editing || initial?.status === "draft") && (
                <label
                  className="flex items-center gap-2 text-[14px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <input
                    type="checkbox"
                    checked={draft}
                    onChange={(e) => setDraft(e.target.checked)}
                  />
                  Сохранить черновиком — участники не увидят и не получат уведомление
                </label>
              )}

            {formError && (
              <p role="alert" className="text-[13px]" style={{ color: "var(--error, #dc2626)" }}>
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={busy}>
                {saving
                  ? "Сохраняем…"
                  : editing
                    ? "Сохранить"
                    : draft
                      ? "Сохранить черновик"
                      : "Опубликовать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <PhotoEditorDialog
        open={editorSrc != null}
        src={editorSrc}
        title="Обложка мероприятия"
        aspect={COVER_WIDTH / COVER_HEIGHT}
        lockAspect
        lockShape
        outputWidth={COVER_WIDTH}
        outputHeight={COVER_HEIGHT}
        onCancel={() => setEditorSrc(null)}
        onSave={(blob) => void applyCover(blob)}
      />
    </>
  );
}

const inputClass = "h-11 w-full rounded-[10px] border px-3 text-[14px] disabled:opacity-60";

function inputStyle(error?: string) {
  return {
    background: "var(--background-surface)",
    borderColor: error ? "var(--error, #dc2626)" : "var(--border)",
    color: "var(--foreground)",
  };
}

function Field({
  label,
  required,
  error,
  hint,
  counter,
  id,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <label htmlFor={id} className="font-medium" style={{ color: "var(--foreground)" }}>
          {label}
          {required && (
            <span aria-hidden style={{ color: "var(--error, #dc2626)" }}>
              {" "}
              *
            </span>
          )}
        </label>
        {counter && (
          <span className="text-[12px] tabular-nums" style={{ color: "var(--foreground-50)" }}>
            {counter}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <span role="alert" className="text-[12px]" style={{ color: "var(--error, #dc2626)" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
