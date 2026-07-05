import { AnimatePresence, motion } from "framer-motion";
import { X, RotateCcw } from "lucide-react";
import { type AdCondition } from "@/lib/mock";
import { useListingCategories } from "@/lib/hooks/useCategories";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import { CitySelect } from "@/components/ads/CitySelect";

const STATUSES = ["Продаю", "Куплю", "Обменяю"] as const;
const CONDITIONS: AdCondition[] = ["Новое", "Б/у — отлично", "Б/у — хорошо", "Под восстановление"];
const DELIVERIES = ["СДЭК", "Почта России", "Яндекс Доставка", "Ozon", "Wildberries"];

export interface FiltersState {
  category: string;            // "Все" | category name
  subcategory: string;         // "Все" | subcat name
  status: string;              // "Все" | "Продаю" | "Куплю" | "Обменяю"
  city: string;                // free text
  cityId?: number;
  conditions: AdCondition[];
  deliveries: string[];
  priceMin: number;
  priceMax: number;
  withPhotoOnly: boolean;
}

export const DEFAULT_FILTERS: FiltersState = {
  category: "Все",
  subcategory: "Все",
  status: "Все",
  city: "",
  cityId: undefined,
  conditions: [],
  deliveries: [],
  priceMin: 0,
  priceMax: 100000,
  withPhotoOnly: false,
};

interface Props {
  value: FiltersState;
  onChange: (v: FiltersState) => void;
  onReset: () => void;
}

function Body({ value, onChange, onReset }: Props) {
  const categories = useListingCategories();
  const cat = categories.find((c) => c.name === value.category);
  const set = <K extends keyof FiltersState>(k: K, v: FiltersState[K]) => onChange({ ...value, [k]: v });
  const toggle = <K extends "conditions" | "deliveries">(k: K, item: string) => {
    const arr = value[k] as string[];
    set(k, (arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]) as FiltersState[K]);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {cat && (
        <Group title="Подкатегория">
          <Select
            value={value.subcategory}
            onChange={(v) => set("subcategory", v)}
            options={["Все", ...cat.subcategories.map((s) => s.name)]}
          />
        </Group>
      )}

      <Group title="Статус">
        <div className="grid grid-cols-3 gap-[6px]">
          {(["Все", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("status", s)}
              className="text-[12px] font-medium transition-colors"
              style={{
                background: value.status === s ? "var(--accent-soft)" : "var(--background-elevated)",
                color: value.status === s ? "var(--accent)" : "var(--foreground-70)",
                border: `1px solid ${value.status === s ? "var(--border-accent)" : "var(--border)"}`,
                borderRadius: "var(--r-tag)",
                height: 36,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Цена, ₽">
        <div className="flex items-center gap-[8px]">
          <NumInput value={value.priceMin} onChange={(v) => set("priceMin", v)} placeholder="от" />
          <span style={{ color: "var(--foreground-50)" }}>—</span>
          <NumInput value={value.priceMax} onChange={(v) => set("priceMax", v)} placeholder="до" />
        </div>
        <input
          type="range" min={0} max={100000} step={500}
          value={value.priceMax}
          onChange={(e) => set("priceMax", +e.target.value)}
          className="w-full"
          style={{ accentColor: "var(--accent)" }}
        />
      </Group>

      <Group title="Город">
        <CitySelect
          value={value.city}
          cityId={value.cityId}
          onChange={(name, id) => onChange({ ...value, city: name, cityId: id })}
          placeholder="Любой город"
        />
      </Group>

      <Group title="Состояние">
        <div className="flex flex-wrap gap-[6px]">
          {CONDITIONS.map((c) => (
            <Checkbox key={c} checked={value.conditions.includes(c)} onChange={() => toggle("conditions", c)} label={c} />
          ))}
        </div>
      </Group>

      <Group title="Доставка">
        <div className="flex flex-wrap gap-[6px]">
          {DELIVERIES.map((d) => (
            <Checkbox key={d} checked={value.deliveries.includes(d)} onChange={() => toggle("deliveries", d)} label={d} />
          ))}
        </div>
      </Group>

      <Checkbox checked={value.withPhotoOnly} onChange={(v) => set("withPhotoOnly", v)} label="Только с фото" />

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center justify-center gap-[6px] text-[13px] font-medium"
        style={{
          color: "var(--foreground-70)",
          background: "var(--background-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-button)",
          height: 40,
        }}
      >
        <RotateCcw size={14} /> Сбросить фильтры
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{title}</div>
      {children}
    </div>
  );
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer text-[13px] outline-none"
      style={{
        background: "var(--background-elevated)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-input)",
        height: 40,
        padding: "0 12px",
      }}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function NumInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder: string }) {
  return (
    <input
      type="number"
      min={0}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(+e.target.value || 0)}
      className="w-full text-[13px] outline-none"
      style={{
        background: "var(--background-elevated)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-input)",
        height: 40,
        padding: "0 10px",
      }}
    />
  );
}

export function AdFiltersSheet({ open, onClose, ...props }: Props & { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.5)" }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-hidden"
            style={{
              background: "var(--background-elevated)",
              borderRadius: "var(--r-modal) var(--r-modal) 0 0",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[12px]">
              <div className="mx-auto h-[4px] w-[40px]" style={{ background: "var(--foreground-15)", borderRadius: "var(--r-pill)" }} />
            </div>
            <div className="flex items-center justify-between px-[20px] pb-[12px]">
              <h3 className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>Фильтры</h3>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-[36px] w-[36px] place-items-center" style={{ color: "var(--foreground-70)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(88vh-64px)] overflow-y-auto px-[20px] pb-[24px]">
              <Body {...props} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function AdFiltersPanel(props: Props) {
  return (
    <aside className="hidden xl:block w-[280px] shrink-0">
      <div
        className="sticky top-0 overflow-y-auto pr-[4px]"
        style={{ maxHeight: "calc(100vh - var(--desktop-topbar-h) - 32px)", scrollbarWidth: "thin" }}
      >
        <h3 className="mb-[12px] font-display text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
          Фильтры
        </h3>
        <Body {...props} />
      </div>
    </aside>
  );
}
