import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { H, card, inputStyle, primaryBtn } from "@/components/admin/adminShared";
import { askConfirm } from "@/lib/ui/ask";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";
import { useCurrentUser } from "@/lib/session";
import { fetchAdminCategories, fetchAdminUsers, type AdminUserRow } from "@/lib/api/admin";
import {
  fetchRolesOverview,
  setStaffCategories,
  updateCategoryAdminLimit,
  updateStaff,
  type DirectionRef,
  type Privileges,
  type RolesOverview,
  type StaffMember,
  type StaffRole,
} from "@/lib/api/admin-roles";

/**
 * «Роли и доступ» — Владелец решает, кто сотрудник, какие у него льготы и
 * за какие направления он отвечает (решение 19.09).
 *
 * Роль выставляет льготы по умолчанию; после назначения любое значение
 * правится отдельно — так собирается, например, администратор направления
 * с квотой без ограничения.
 */

const STAFF_ROLES: StaffRole[] = ["owner", "moderator", "category_admin"];
const ALL_ROLES: StaffRole[] = ["user", "category_admin", "moderator", "owner"];

interface Direction extends DirectionRef {
  depth: number;
}

const sectionTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: "12px",
};

const muted: React.CSSProperties = { fontSize: "12px", color: "var(--foreground-50)" };

export function AdminRolesSection() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<RolesOverview | null>(null);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchRolesOverview()
      .then(setOverview)
      .catch((e) => {
        reportReadFailure(e, "роли и доступ");
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
    fetchAdminCategories("post")
      .then((list) => setDirections(orderTree(list)))
      .catch((e) => reportReadFailure(e, "направления для назначения"));
  }, [load]);

  if (failed) {
    return (
      <div>
        <H>{t("pages.adminRoles.title")}</H>
        <div style={{ ...card, padding: "16px" }}>
          <p style={muted}>{t("pages.adminRoles.loadFailed")}</p>
          <button type="button" style={{ ...primaryBtn, marginTop: "12px" }} onClick={load}>
            {t("pages.adminRoles.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div>
        <H>{t("pages.adminRoles.title")}</H>
        <p style={muted}>{t("pages.adminRoles.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "20px" }}>
      <div>
        <H>{t("pages.adminRoles.title")}</H>
        <p style={{ ...muted, fontSize: "13px", maxWidth: "720px" }}>
          {t("pages.adminRoles.intro")}
        </p>
      </div>

      <AddStaffCard overview={overview} onChanged={load} />

      <div className="flex flex-col" style={{ gap: "12px" }}>
        {overview.staff.map((member) => (
          <StaffCard
            key={member.uuid}
            member={member}
            directions={directions}
            maxPerCategory={overview.maxPerCategory}
            onChanged={load}
          />
        ))}
      </div>

      <LimitCard value={overview.maxPerCategory} onChanged={load} />
      <RoleMatrix overview={overview} />
    </div>
  );
}

/** Направления деревом: родитель, за ним его подкатегории со сдвигом. */
function orderTree(
  list: Array<{ id: number; parentId: number | null; name: string; slug: string }>,
): Direction[] {
  const byParent = new Map<number | null, typeof list>();
  for (const c of list) {
    const key = c.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const out: Direction[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ id: c.id, name: c.name, slug: c.slug, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as StaffRole)}
      style={{ ...inputStyle, padding: "0 12px" }}
    >
      {ALL_ROLES.map((role) => (
        <option key={role} value={role}>
          {t(`pages.adminRoles.role.${role}`)}
        </option>
      ))}
    </select>
  );
}

async function confirmRoleChange(
  t: (key: string, opts?: Record<string, unknown>) => string,
  name: string,
  role: StaffRole,
): Promise<boolean> {
  return askConfirm({
    title: t("pages.adminRoles.confirmRoleTitle", {
      name,
      role: t(`pages.adminRoles.role.${role}`),
    }),
    description: t("pages.adminRoles.confirmRoleHint"),
    confirmLabel: t("pages.adminRoles.confirmRoleOk"),
  });
}

function AddStaffCard({ overview, onChanged }: { overview: RolesOverview; onChanged: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetchAdminUsers({ q, perPage: 10 })
        .then((list) => {
          if (alive) setResults(list);
        })
        .catch((e) => reportReadFailure(e, "поиск пользователя для назначения"))
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const staffUuids = useMemo(() => new Set(overview.staff.map((s) => s.uuid)), [overview.staff]);

  const assign = async (user: AdminUserRow, role: StaffRole) => {
    if (!(await confirmRoleChange(t, user.name, role))) return;
    try {
      await updateStaff(user.uuid, { role });
      toast.success(t("pages.adminRoles.assigned", { name: user.name }));
      setQuery("");
      onChanged();
    } catch (e) {
      reportActionFailure(e, t("pages.adminRoles.saveFailed"));
    }
  };

  return (
    <div style={{ ...card, padding: "16px" }}>
      <div style={sectionTitle}>{t("pages.adminRoles.addTitle")}</div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("pages.adminRoles.searchPlaceholder")}
        style={{ ...inputStyle, width: "100%", maxWidth: "420px" }}
      />
      {searching && <p style={{ ...muted, marginTop: "8px" }}>{t("pages.adminRoles.searching")}</p>}
      {results.length > 0 && (
        <div className="flex flex-col" style={{ gap: "8px", marginTop: "12px" }}>
          {results.map((user) => (
            <div key={user.uuid} className="flex flex-wrap items-center" style={{ gap: "10px" }}>
              <span style={{ fontSize: "13px", color: "var(--foreground)", minWidth: "180px" }}>
                {user.name}
                <span style={{ ...muted, marginLeft: "8px" }}>{user.email}</span>
              </span>
              {staffUuids.has(user.uuid) ? (
                <span style={muted}>{t("pages.adminRoles.alreadyStaff")}</span>
              ) : (
                STAFF_ROLES.filter((r) => r !== "owner").map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => void assign(user, role)}
                    style={{ ...inputStyle, height: "32px", cursor: "pointer" }}
                  >
                    {t(`pages.adminRoles.makeRole.${role}`)}
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffCard({
  member,
  directions,
  maxPerCategory,
  onChanged,
}: {
  member: StaffMember;
  directions: Direction[];
  maxPerCategory: number;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const isSelf = me.id === member.uuid;
  const [draft, setDraft] = useState<Privileges>(member);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      subscriptionExempt: member.subscriptionExempt,
      freeListingsQuota: member.freeListingsQuota,
      freeListingsUnlimited: member.freeListingsUnlimited,
    });
  }, [member.subscriptionExempt, member.freeListingsQuota, member.freeListingsUnlimited]);

  const dirty =
    draft.subscriptionExempt !== member.subscriptionExempt ||
    draft.freeListingsQuota !== member.freeListingsQuota ||
    draft.freeListingsUnlimited !== member.freeListingsUnlimited;

  const run = async (action: () => Promise<void>, done: string) => {
    setSaving(true);
    try {
      await action();
      toast.success(done);
      onChanged();
    } catch (e) {
      reportActionFailure(e, t("pages.adminRoles.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (role: StaffRole) => {
    if (role === member.role || !(await confirmRoleChange(t, member.name, role))) return;
    await run(() => updateStaff(member.uuid, { role }), t("pages.adminRoles.saved"));
  };

  const assigned = new Set(member.categories.map((c) => c.id));
  const setCategories = (ids: number[]) =>
    run(() => setStaffCategories(member.uuid, ids), t("pages.adminRoles.saved"));

  return (
    <div style={{ ...card, padding: "16px" }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: "12px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>
            {member.name}
          </div>
          <div style={muted}>{member.email}</div>
        </div>
        <RoleSelect
          value={member.role}
          disabled={saving || isSelf}
          onChange={(role) => void changeRole(role)}
        />
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: "16px", marginTop: "14px" }}>
        <label className="flex items-center" style={{ gap: "8px", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={draft.subscriptionExempt}
            onChange={(e) => setDraft((d) => ({ ...d, subscriptionExempt: e.target.checked }))}
          />
          {t("pages.adminRoles.subscriptionExempt")}
        </label>
        <label className="flex items-center" style={{ gap: "8px", fontSize: "13px" }}>
          {t("pages.adminRoles.quota")}
          <input
            type="number"
            min={0}
            max={100000}
            value={draft.freeListingsQuota}
            disabled={draft.freeListingsUnlimited}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                freeListingsQuota: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              }))
            }
            style={{ ...inputStyle, width: "90px", height: "34px" }}
          />
        </label>
        <label className="flex items-center" style={{ gap: "8px", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={draft.freeListingsUnlimited}
            onChange={(e) => setDraft((d) => ({ ...d, freeListingsUnlimited: e.target.checked }))}
          />
          {t("pages.adminRoles.unlimited")}
        </label>
        <button
          type="button"
          disabled={!dirty || saving}
          style={{ ...primaryBtn, opacity: !dirty || saving ? 0.5 : 1 }}
          onClick={() =>
            void run(() => updateStaff(member.uuid, draft), t("pages.adminRoles.saved"))
          }
        >
          {t("pages.adminRoles.save")}
        </button>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: "12px", marginTop: "10px" }}>
        <span style={muted}>
          {t("pages.adminRoles.used", { count: member.freeListingsUsed })} ·{" "}
          {t("pages.adminRoles.credits", { count: member.listingCredits })}
        </span>
        {member.freeListingsUsed > 0 && (
          <button
            type="button"
            disabled={saving}
            style={{ ...muted, textDecoration: "underline", cursor: "pointer", background: "none" }}
            onClick={() =>
              void run(
                () => updateStaff(member.uuid, { freeListingsUsed: 0 }),
                t("pages.adminRoles.usedReset"),
              )
            }
          >
            {t("pages.adminRoles.resetUsed")}
          </button>
        )}
      </div>

      {member.role === "category_admin" && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
            {t("pages.adminRoles.directions", { max: maxPerCategory })}
          </div>
          <div className="flex flex-wrap" style={{ gap: "8px" }}>
            {member.categories.length === 0 && (
              <span style={muted}>{t("pages.adminRoles.noDirections")}</span>
            )}
            {member.categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center"
                style={{
                  gap: "6px",
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "var(--r-tag)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {c.name}
                <button
                  type="button"
                  aria-label={t("pages.adminRoles.removeDirection", { name: c.name })}
                  disabled={saving}
                  onClick={() => void setCategories([...assigned].filter((id) => id !== c.id))}
                  style={{ display: "inline-grid", placeItems: "center" }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <select
            value=""
            disabled={saving || directions.length === 0}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) void setCategories([...assigned, id]);
            }}
            style={{
              ...inputStyle,
              marginTop: "10px",
              padding: "0 12px",
              maxWidth: "420px",
              width: "100%",
            }}
          >
            <option value="">{t("pages.adminRoles.addDirection")}</option>
            {directions
              .filter((d) => !assigned.has(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {"  ".repeat(d.depth)}
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

function LimitCard({ value, onChanged }: { value: number; onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(String(value)), [value]);

  const parsed = /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : NaN;
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100;

  const save = async () => {
    setSaving(true);
    try {
      await updateCategoryAdminLimit(parsed);
      toast.success(t("pages.adminRoles.saved"));
      onChanged();
    } catch (e) {
      reportActionFailure(e, t("pages.adminRoles.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...card, padding: "16px" }}>
      <div style={sectionTitle}>{t("pages.adminRoles.limitTitle")}</div>
      <p style={{ ...muted, marginBottom: "10px" }}>{t("pages.adminRoles.limitHint")}</p>
      <div className="flex flex-wrap items-center" style={{ gap: "10px" }}>
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ ...inputStyle, width: "90px" }}
        />
        <button
          type="button"
          disabled={!valid || saving || parsed === value}
          style={{ ...primaryBtn, opacity: !valid || saving || parsed === value ? 0.5 : 1 }}
          onClick={() => void save()}
        >
          {t("pages.adminRoles.save")}
        </button>
      </div>
    </div>
  );
}

function RoleMatrix({ overview }: { overview: RolesOverview }) {
  const { t } = useTranslation();
  const columns = overview.roles.filter((r) => r.role !== "user");
  const sections = Object.keys(overview.sectionLevels);

  const privilege = (p: Privileges) => [
    p.subscriptionExempt
      ? t("pages.adminRoles.matrixExempt")
      : t("pages.adminRoles.matrixNotExempt"),
    p.freeListingsUnlimited
      ? t("pages.adminRoles.matrixUnlimited")
      : t("pages.adminRoles.matrixQuota", { count: p.freeListingsQuota }),
  ];

  return (
    <div style={{ ...card, padding: "16px" }}>
      <div style={sectionTitle}>{t("pages.adminRoles.matrixTitle")}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ fontSize: "13px", minWidth: "520px", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", ...muted }}>
                {t("pages.adminRoles.matrixSection")}
              </th>
              {columns.map((c) => (
                <th key={c.role} style={{ textAlign: "center", padding: "6px 8px", ...muted }}>
                  {t(`pages.adminRoles.role.${c.role}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "6px 8px" }}>{t("pages.adminRoles.matrixDefaults")}</td>
              {columns.map((c) => (
                <td key={c.role} style={{ textAlign: "center", padding: "6px 8px", ...muted }}>
                  {privilege(c.defaults).join(" · ")}
                </td>
              ))}
            </tr>
            {sections.map((id) => (
              <tr key={id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>{t(`pages.adminShell.nav.${id}`)}</td>
                {columns.map((c) => (
                  <td key={c.role} style={{ textAlign: "center", padding: "6px 8px" }}>
                    {c.sections.includes(id) ? (
                      <Check size={14} style={{ color: "var(--success)", display: "inline" }} />
                    ) : (
                      <span style={muted}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, marginTop: "10px" }}>{t("pages.adminRoles.matrixScopeHint")}</p>
    </div>
  );
}
