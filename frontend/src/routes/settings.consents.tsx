import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Button } from "@/components/ui/button";
import { deleteMyAccount, exportMyData, fetchMyConsents, revokeConsent, type ConsentRecord } from "@/lib/api/legal";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setToken } from "@/lib/api/client";
import { useNavigate } from "@tanstack/react-router";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/settings/consents")({
  head: () => ({ meta: [{ title: `Мои согласия — ${i18n.t("common.appName")}` }] }),
  component: ConsentsSettingsPage,
});

const TYPE_LABELS: Record<string, string> = {
  terms: "Пользовательское соглашение",
  privacy: "Обработка персональных данных",
  ads: "Рекламные материалы",
  cookies: "Cookie",
};

function ConsentsSettingsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: consents = [], isLoading } = useQuery({
    queryKey: ["my-consents"],
    queryFn: fetchMyConsents,
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function onRevoke(type: string) {
    if (!window.confirm("Отозвать это согласие?")) return;
    setBusy(type);
    try {
      await revokeConsent(type);
      await qc.invalidateQueries({ queryKey: ["my-consents"] });
      toast.success("Согласие отозвано");
    } catch (e) {
      toast.error(formatApiErrorMessage(e, "Не удалось отозвать"));
    } finally {
      setBusy(null);
    }
  }

  async function onExport() {
    setBusy("export");
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelizm-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Файл с данными загружен");
    } catch (e) {
      toast.error(formatApiErrorMessage(e, "Не удалось экспортировать данные"));
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteAccount() {
    if (!window.confirm("Удалить аккаунт и все данные без возможности восстановления?")) return;
    if (!window.confirm("Это действие необратимо. Подтвердите ещё раз.")) return;
    setBusy("delete");
    try {
      await deleteMyAccount();
      setToken(null);
      toast.success("Аккаунт удалён");
      nav({ to: "/" });
    } catch (e) {
      toast.error(formatApiErrorMessage(e, "Не удалось удалить аккаунт"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsSectionShell title="Мои согласия" backTo="/settings/dashboard">
      <p className="mb-4 text-sm text-muted-foreground">
        Управление согласиями в соответствии с 152-ФЗ.{" "}
        <Link to="/legal/privacy" className="text-primary underline">
          Политика конфиденциальности
        </Link>
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : consents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Записей о согласиях пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {consents.map((c: ConsentRecord) => (
            <li key={c.type} className="rounded-lg border p-4">
              <div className="font-medium">{TYPE_LABELS[c.type] ?? c.type}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Версия: {c.doc_version} · {c.status === "granted" ? "Дано" : "Отозвано"}
                {c.created_at ? ` · ${new Date(c.created_at).toLocaleString("ru-RU")}` : ""}
              </div>
              {c.status === "granted" && (c.type === "ads" || c.type === "cookies") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={busy === c.type}
                  onClick={() => onRevoke(c.type)}
                >
                  Отозвать согласие
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={busy === "export"} onClick={onExport}>
          Экспорт моих данных
        </Button>
        <Button type="button" variant="destructive" disabled={busy === "delete"} onClick={onDeleteAccount}>
          Удалить аккаунт
        </Button>
      </div>
    </SettingsSectionShell>
  );
}
