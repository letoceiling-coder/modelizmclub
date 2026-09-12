import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Button } from "@/components/ui/button";
import {
  deleteMyAccount,
  exportMyData,
  fetchMyConsents,
  revokeConsent,
  type ConsentRecord,
} from "@/lib/api/legal";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setToken } from "@/lib/api/client";
import { useNavigate } from "@tanstack/react-router";

import i18n from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";
import { askConfirm } from "@/lib/ui/ask";

export const Route = createFileRoute("/settings/consents")({
  head: () => ({ meta: [{ title: `Мои согласия — ${i18n.t("common.appName")}` }] }),
  component: ConsentsSettingsPage,
});

const TYPE_LABELS: Record<string, string> = {
  terms: "pages.settings.consentsTypeTerms",
  privacy: "pages.settings.consentsTypePrivacy",
  ads: "pages.settings.consentsTypeAds",
  cookies: "Cookie",
};

function ConsentsSettingsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: consents = [], isLoading } = useQuery({
    queryKey: ["my-consents"],
    queryFn: fetchMyConsents,
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function onRevoke(type: string) {
    if (!(await askConfirm({ title: t("pages.settings.consentsRevokeConfirm") }))) return;
    setBusy(type);
    try {
      await revokeConsent(type);
      await qc.invalidateQueries({ queryKey: ["my-consents"] });
      toast.success(t("pages.settings.consentsRevoked_toast"));
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.settings.consentsRevokeFailed")));
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
      /*
       * Ссылку надо внести в документ и отозвать адрес не сразу.
       *
       * Firefox не открывает `a.click()` у элемента, которого нет в дереве, а
       * `revokeObjectURL` сразу после щелчка успевает отобрать адрес раньше,
       * чем браузер начнёт скачивание: файл молча не сохранялся, при этом
       * тост обещал, что сохранился (аудит 12.09).
       */
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Адрес живёт до конца текущей задачи — скачивание к этому моменту начато.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(t("pages.settings.consentsExportDone"));
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.settings.consentsExportFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteAccount() {
    if (!(await askConfirm({ title: t("pages.settings.consentsDeleteConfirm") }))) return;
    if (!(await askConfirm({ title: t("pages.settings.consentsDeleteConfirmAgain") }))) return;
    setBusy("delete");
    try {
      await deleteMyAccount();
      setToken(null);
      toast.success(t("pages.settings.consentsDeleteDone"));
      nav({ to: "/" });
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.settings.consentsDeleteFailed")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsSectionShell title={t("pages.settings.consentsTitle")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("pages.settings.consentsIntro")}{" "}
        <Link to="/legal/$slug" params={{ slug: "privacy" }} className="text-primary underline">
          {t("pages.settings.consentsPrivacyLink")}
        </Link>
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("pages.settings.consentsLoading")}</p>
      ) : consents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pages.settings.consentsEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {consents.map((c: ConsentRecord) => (
            <li key={c.type} className="rounded-lg border p-4">
              <div className="font-medium">
                {TYPE_LABELS[c.type] ? t(TYPE_LABELS[c.type]) : c.type}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("pages.settings.consentsVersion")}: {c.doc_version} ·{" "}
                {c.status === "granted"
                  ? t("pages.settings.consentsGranted")
                  : t("pages.settings.consentsRevoked")}
                {c.created_at ? ` · ${formatDate(c.created_at, "absolute")}` : ""}
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
                  {t("pages.settings.consentsRevokeBtn")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={busy === "export"} onClick={onExport}>
          {t("pages.settings.consentsExportBtn")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={busy === "delete"}
          onClick={onDeleteAccount}
        >
          {t("pages.settings.consentsDeleteBtn")}
        </Button>
      </div>
    </SettingsSectionShell>
  );
}
