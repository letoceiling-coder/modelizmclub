import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { fetchDashboard } from "@/lib/api/admin";
import { H, card } from "@/components/admin/adminShared";

export function AnalyticsSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((d) => active && setData(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const chartKeys = [
    "dauMau",
    "revenue",
    "listings",
    "topCategories",
    "subscription",
    "geo",
  ] as const;
  const kpiStats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statUsers") },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statPosts") },
    { v: String(data?.moderationPending ?? 0), l: t("pages.adminDashboard.statModeration") },
    { v: String(data?.reportsPending ?? 0), l: t("pages.adminDashboard.statReports") },
    { v: (data?.plansActive ?? 0).toLocaleString("ru"), l: t("pages.adminAnalytics.statPlans") },
    {
      v: (data?.promocodesActive ?? 0).toLocaleString("ru"),
      l: t("pages.adminAnalytics.statPromocodes"),
    },
  ];

  return (
    <div>
      <H>{t("pages.adminAnalytics.title")}</H>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        style={{ gap: "12px", marginBottom: "20px" }}
      >
        {kpiStats.map((s, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
            style={{ ...card, padding: "14px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "22px",
                color: "var(--foreground)",
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--foreground-50)",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
                marginTop: "4px",
              }}
            >
              {s.l}
            </div>
          </motion.div>
        ))}
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
        {chartKeys.map((key, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            style={{ ...card, padding: "20px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "15px",
                color: "var(--foreground)",
              }}
            >
              {t(`pages.adminAnalytics.charts.${key}`)}
            </div>
            <div
              style={{
                height: "180px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <BarChart3 size={32} style={{ color: "var(--foreground-15)" }} />
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--foreground-30)",
                  textAlign: "center",
                  maxWidth: "240px",
                }}
              >
                {t("pages.adminAnalytics.chartPlaceholder")}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
