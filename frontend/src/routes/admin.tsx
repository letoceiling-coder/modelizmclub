import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Home, LayoutDashboard, ShieldCheck, Users, Image as ImageIcon, Settings,
  Check, X, Trash2, Plus,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROUTE_SEARCH } from "@/lib/route-search";
import {
  fetchAdminDashboard, type AdminStats,
  fetchModerationQueue, approveModeration, rejectModeration, type ModerationItem,
  fetchAdminUsers, updateAdminUser, type AdminUser,
  fetchAdminBanners, createBanner, updateBanner, deleteBanner, type AdminBanner,
  fetchAdminSettings, updateAdminSettings, type SystemSettingRow,
} from "@/lib/api/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: tStatic("admin.metaTitle") }] }),
  component: AdminPage,
});

type TabKey = "dashboard" | "moderation" | "users" | "banners" | "settings";

function AdminPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>("dashboard");

  const role = user?.role;
  const isStaff = role === "admin" || role === "moderator";
  const isAdmin = role === "admin";

  if (loading) {
    return <Shell><div className="py-24 text-center" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div></Shell>;
  }

  if (!isStaff) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("admin.noAccess")}</p>
          <Link to="/feed" search={ROUTE_SEARCH.feed} className="mt-4 inline-block font-semibold" style={{ color: "var(--accent)" }}>{t("admin.backToSite")}</Link>
        </div>
      </Shell>
    );
  }

  const allTabs: { key: TabKey; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
    { key: "dashboard", label: t("admin.tabDashboard"), icon: LayoutDashboard, adminOnly: true },
    { key: "moderation", label: t("admin.tabModeration"), icon: ShieldCheck },
    { key: "users", label: t("admin.tabUsers"), icon: Users, adminOnly: true },
    { key: "banners", label: t("admin.tabBanners"), icon: ImageIcon, adminOnly: true },
    { key: "settings", label: t("admin.tabSettings"), icon: Settings, adminOnly: true },
  ];
  const tabs = allTabs.filter((x) => !x.adminOnly || isAdmin);

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-[1080px] gap-6 px-4 py-6">
        <nav className="flex w-[200px] shrink-0 flex-col gap-1">
          {tabs.map((x) => {
            const active = tab === x.key;
            return (
              <button key={x.key} onClick={() => setTab(x.key)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-medium" style={{ background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--foreground-70)" }}>
                <x.icon size={16} /> {x.label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">
          {tab === "dashboard" && isAdmin && <DashboardTab />}
          {tab === "moderation" && <ModerationTab />}
          {tab === "users" && isAdmin && <UsersTab />}
          {tab === "banners" && isAdmin && <BannersTab />}
          {tab === "settings" && isAdmin && <SettingsTab />}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4" style={{ height: 48, borderColor: "var(--border)", background: "var(--background-elevated)" }}>
        <div className="flex items-center gap-3">
          <Logo size={28} showText={false} />
          <span className="text-[13px] font-semibold">{t("nav.admin")}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/feed" search={ROUTE_SEARCH.feed} className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-70)" }}>
            <Home size={14} />{t("admin.backToSite")}
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function DashboardTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetchAdminDashboard().then(setStats).catch(() => setError(true));
  }, []);

  if (error) return <Empty text={t("common.error")} />;
  if (!stats) return <Empty text={t("common.loading")} />;

  const cards: { label: string; value: number }[] = [
    { label: t("admin.statUsers"), value: stats.users_total },
    { label: t("admin.statPosts"), value: stats.posts_total },
    { label: t("admin.statCommunities"), value: stats.communities_total },
    { label: t("admin.statModeration"), value: stats.moderation_pending },
    { label: t("admin.statReports"), value: stats.reports_pending },
    { label: t("admin.statBanners"), value: stats.banners_active },
  ];

  return (
    <section>
      <h1 className="mb-4 font-display text-[24px] font-bold">{t("admin.tabDashboard")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
            <div className="text-[28px] font-bold font-display">{c.value.toLocaleString("ru")}</div>
            <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{c.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModerationTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void fetchModerationQueue("pending").then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const decide = async (item: ModerationItem, approve: boolean) => {
    const uuid = item.moderatable?.uuid;
    if (!uuid) return toast.error(t("common.error"));
    const type = item.moderatable_type === "Community" ? "communities" : "posts";
    try {
      if (approve) await approveModeration(type, uuid);
      else await rejectModeration(type, uuid);
      toast.success(approve ? t("admin.approved") : t("admin.rejected"));
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <section>
      <h1 className="mb-4 font-display text-[24px] font-bold">{t("admin.tabModeration")}</h1>
      {loading ? <Empty text={t("common.loading")} /> : items.length === 0 ? <Empty text={t("admin.moderationEmpty")} /> : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
              <div className="min-w-0">
                <span className="rounded px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{item.moderatable_type}</span>
                <div className="mt-1 text-[14px] font-semibold">{item.moderatable?.title ?? item.moderatable?.name ?? `#${item.moderatable_id}`}</div>
                {item.moderatable?.body && <p className="mt-1 line-clamp-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>{item.moderatable.body}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => void decide(item, true)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--success, #16a34a)", color: "#fff" }}><Check size={14} /> {t("admin.approve")}</button>
                <button onClick={() => void decide(item, false)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-medium" style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}><X size={14} /> {t("admin.reject")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const ROLES = ["user", "subscriber", "moderator", "admin"];
const STATUSES = ["active", "blocked", "pending_verification"];

function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void fetchAdminUsers().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const change = async (u: AdminUser, data: Partial<{ role: string; status: string }>) => {
    try {
      await updateAdminUser(u.uuid, data);
      setUsers((prev) => prev.map((x) => (x.uuid === u.uuid ? { ...x, ...data } : x)));
      toast.success(t("admin.saved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <section>
      <h1 className="mb-4 font-display text-[24px] font-bold">{t("admin.tabUsers")}</h1>
      {loading ? <Empty text={t("common.loading")} /> : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}>
                <th className="p-3 text-left">{t("admin.colUser")}</th>
                <th className="p-3 text-left">{t("admin.colRole")}</th>
                <th className="p-3 text-left">{t("admin.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="p-3">
                    <div className="font-medium">{u.profile?.display_name ?? u.name ?? u.email}</div>
                    <div style={{ color: "var(--foreground-50)" }}>{u.email}</div>
                  </td>
                  <td className="p-3">
                    <Select value={u.role} options={ROLES} onChange={(v) => void change(u, { role: v })} />
                  </td>
                  <td className="p-3">
                    <Select value={u.status} options={STATUSES} onChange={(v) => void change(u, { status: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BannersTab() {
  const { t } = useTranslation();
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [placement, setPlacement] = useState("feed");
  const [linkUrl, setLinkUrl] = useState("");

  const load = () => {
    setLoading(true);
    void fetchAdminBanners().then(setBanners).catch(() => setBanners([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async () => {
    if (!title.trim()) return toast.error(t("admin.bannerTitleRequired"));
    try {
      await createBanner({ title: title.trim(), placement, link_url: linkUrl.trim() || undefined, is_active: true });
      setTitle(""); setLinkUrl("");
      toast.success(t("admin.saved"));
      load();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const toggle = async (b: AdminBanner) => {
    try {
      await updateBanner(b.id, { placement: b.placement, title: b.title, is_active: !b.is_active });
      setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !x.is_active } : x)));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const remove = async (b: AdminBanner) => {
    try {
      await deleteBanner(b.id);
      setBanners((prev) => prev.filter((x) => x.id !== b.id));
      toast.success(t("admin.deleted"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <section>
      <h1 className="mb-4 font-display text-[24px] font-bold">{t("admin.tabBanners")}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.bannerTitle")} className="flex-1 rounded-lg border bg-background px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--border)", color: "var(--foreground)" }} />
        <Select value={placement} options={["feed", "sidebar", "listing"]} onChange={setPlacement} />
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="flex-1 rounded-lg border bg-background px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--border)", color: "var(--foreground)" }} />
        <button onClick={() => void add()} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold" style={{ background: "var(--accent)", color: "#fff" }}><Plus size={14} /> {t("admin.addBanner")}</button>
      </div>

      {loading ? <Empty text={t("common.loading")} /> : banners.length === 0 ? <Empty text={t("admin.bannersEmpty")} /> : (
        <div className="flex flex-col gap-2">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{b.title}</div>
                <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{b.placement}{b.link_url ? ` · ${b.link_url}` : ""}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => void toggle(b)} className="rounded-lg border px-3 py-1.5 text-[12px] font-medium" style={{ borderColor: "var(--border)", color: b.is_active ? "var(--accent)" : "var(--foreground-50)" }}>
                  {b.is_active ? t("admin.active") : t("admin.inactive")}
                </button>
                <button onClick={() => void remove(b)} className="grid h-8 w-8 place-items-center rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--foreground-50)" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SystemSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchAdminSettings().then((data) => {
      setRows(data);
      const d: Record<string, string> = {};
      for (const r of data) d[r.key] = JSON.stringify(r.value);
      setDrafts(d);
    }).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  const save = async (row: SystemSettingRow) => {
    let value: unknown;
    try {
      value = JSON.parse(drafts[row.key]);
    } catch {
      return toast.error(t("admin.settingInvalidJson"));
    }
    try {
      await updateAdminSettings([{ key: row.key, value, group: row.group }]);
      toast.success(t("admin.saved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <section>
      <h1 className="mb-4 font-display text-[24px] font-bold">{t("admin.tabSettings")}</h1>
      {loading ? <Empty text={t("common.loading")} /> : rows.length === 0 ? <Empty text={t("admin.settingsEmpty")} /> : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.key} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold">{r.key}</div>
                  <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{r.group}</div>
                </div>
                <button onClick={() => void save(r)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>{t("common.save")}</button>
              </div>
              <textarea
                value={drafts[r.key] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 font-mono text-[12px] outline-none"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-16 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{text}</div>;
}
