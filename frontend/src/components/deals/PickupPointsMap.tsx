import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CdekPickupPoint } from "@/lib/api/cdek";
import { pvzBounds, pvzFeatures } from "@/lib/delivery/pvz-features";
import { isYandexMapsConfigured, loadYandexMaps, type YMap } from "@/lib/delivery/yandex-maps";
import { ignoreFailure } from "@/lib/errors/handle";

interface Props {
  points: CdekPickupPoint[];
  selectedId: string | null;
  onSelect: (point: CdekPickupPoint) => void;
  className?: string;
}

/**
 * Карта пунктов выдачи.
 *
 * До 22.09 здесь стоял кадр OpenStreetMap, который показывал **уже
 * выбранный** пункт. То есть карта появлялась после того, как выбор сделан
 * по списку, и помочь с выбором не могла ничем — а покупатель выбирает ПВЗ
 * именно по месту: рядом с домом, по дороге с работы.
 *
 * Точки кладутся в `ObjectManager` с кластеризацией: в Москве их 439, и
 * четыреста отдельных меток на карте — это не карта, а сплошное пятно.
 *
 * Скрипт грузится здесь, а не выше по дереву: карта нужна одному экрану из
 * сорока, и платить за неё загрузкой приложения незачем.
 */
export function PickupPointsMap({ points, selectedId, onSelect, className }: Props) {
  const боксRef = useRef<HTMLDivElement>(null);
  const картаRef = useRef<YMap | null>(null);
  const [состояние, setСостояние] = useState<"грузится" | "готова" | "отказ">("грузится");

  /*
   * Обработчик выбора держим ссылкой: карта создаётся один раз, а колбэк
   * приходит новый на каждый рендер мастера. Без ссылки метка звала бы
   * обработчик от того рендера, при котором карта построилась.
   */
  const выбрать = useRef(onSelect);
  useEffect(() => {
    выбрать.current = onSelect;
  });

  const точки = pvzFeatures(points);
  const ключПунктов = точки.map((t) => t.id).join(",");

  useEffect(() => {
    const бокс = боксRef.current;
    if (!бокс || точки.length === 0) return;

    let живо = true;
    setСостояние("грузится");

    loadYandexMaps()
      .then((ymaps) => {
        if (!живо || !ymaps) return;

        const рамка = pvzBounds(points);
        const карта = new ymaps.Map(
          бокс,
          { center: рамка ? рамка[0] : [55.76, 37.64], zoom: 10, controls: ["zoomControl"] },
          { suppressMapOpenBlock: true },
        );
        картаRef.current = карта;

        const менеджер = new ymaps.ObjectManager({
          clusterize: true,
          gridSize: 64,
          clusterDisableClickZoom: false,
        });
        менеджер.objects.options.set({ preset: "islands#blueDeliveryCircleIcon" });
        менеджер.clusters.options.set({ preset: "islands#blueClusterIcons" });
        менеджер.objects.events.add("click", (e) => {
          const id = String(e.get("objectId"));
          const пункт = points.find((p) => p.id === id);
          if (пункт) выбрать.current(пункт);
        });
        менеджер.add({ type: "FeatureCollection", features: точки });
        карта.geoObjects.add(менеджер);

        if (рамка) {
          void карта
            .setBounds(рамка, { checkZoomRange: true, zoomMargin: 24 })
            .catch(ignoreFailure("рамка карты: покажем городом по умолчанию"));
        }

        setСостояние("готова");
      })
      .catch(() => {
        if (живо) setСостояние("отказ");
      });

    return () => {
      живо = false;
      картаRef.current?.destroy();
      картаRef.current = null;
    };
    // `точки` пересобирается на каждый рендер — сравниваем по составу.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ключПунктов]);

  /*
   * Карта не показывается вовсе, когда показывать нечего: ключа нет, точек с
   * координатами нет или скрипт не загрузился. Пустой прямоугольник на месте
   * карты ничего не сообщает, а место занимает — и на телефоне это место
   * отнято у списка.
   */
  if (!isYandexMapsConfigured() || точки.length === 0) return null;

  if (состояние === "отказ") {
    return (
      <p className={className} style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
        Карта не загрузилась — выберите пункт из списка ниже.
      </p>
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <div
        ref={боксRef}
        className="h-[260px] w-full overflow-hidden rounded-[var(--r-card)]"
        aria-label={`Карта пунктов выдачи: ${точки.length}`}
        role="application"
      />
      {состояние === "грузится" && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-[8px] rounded-[var(--r-card)] text-[13px]"
          style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        >
          <Loader2 size={14} className="animate-spin" /> Карта загружается…
        </div>
      )}
      {selectedId && (
        <p className="mt-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Метку можно выбрать прямо на карте.
        </p>
      )}
    </div>
  );
}
