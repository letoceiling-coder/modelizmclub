import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CdekPickupPoint } from "@/lib/api/cdek";
import { pvzBounds, pvzFeatures } from "@/lib/delivery/pvz-features";
import { loadYandexMaps, type YMap, type YObjectManager } from "@/lib/delivery/yandex-maps";
import { ignoreFailure, reportReadFailure } from "@/lib/errors/handle";

interface Props {
  points: CdekPickupPoint[];
  selectedId: string | null;
  onSelect: (point: CdekPickupPoint) => void;
  /** Карта не получилась — вызывающему пора показать список. */
  onUnavailable: () => void;
  className?: string;
}

const ОБЫЧНАЯ = "islands#blueDeliveryCircleIcon";
const ВЫБРАННАЯ = "islands#redDeliveryCircleIcon";

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
export function PickupPointsMap({ points, selectedId, onSelect, onUnavailable, className }: Props) {
  const боксRef = useRef<HTMLDivElement>(null);
  const картаRef = useRef<YMap | null>(null);
  const менеджерRef = useRef<YObjectManager | null>(null);
  const [состояние, setСостояние] = useState<"грузится" | "готова" | "отказ">("грузится");
  const [попытка, setПопытка] = useState(0);

  /*
   * Колбэки держим ссылками: карта строится один раз, а новые приходят на
   * каждый рендер мастера. Без ссылки метка звала бы обработчик от того
   * рендера, при котором карта построилась.
   */
  const свежие = useRef({ onSelect, onUnavailable });
  useEffect(() => {
    свежие.current = { onSelect, onUnavailable };
  });

  const точки = pvzFeatures(points);
  const ключПунктов = точки
    .map((t) => t.id)
    .sort()
    .join(",");

  /*
   * Жизненный цикл карты — один раз на открытие.
   *
   * Отдельно от данных намеренно. Пока это был один эффект, карта
   * пересоздавалась на каждую нажатую букву в поиске: список приходит
   * отфильтрованным и пересортированным, а `destroy()` → `new Map()` теряет
   * масштаб и положение, которые человек только что выставил руками.
   */
  useEffect(() => {
    const бокс = боксRef.current;
    if (!бокс) return;

    let живо = true;
    setСостояние("грузится");

    loadYandexMaps()
      .then((ymaps) => {
        if (!живо || !ymaps) return;

        const карта = new ymaps.Map(
          бокс,
          { center: [55.76, 37.64], zoom: 10, controls: ["zoomControl"] },
          { suppressMapOpenBlock: true },
        );
        const менеджер = new ymaps.ObjectManager({
          clusterize: true,
          gridSize: 64,
          clusterDisableClickZoom: false,
        });
        менеджер.objects.options.set({ preset: ОБЫЧНАЯ });
        менеджер.clusters.options.set({ preset: "islands#blueClusterIcons" });
        менеджер.objects.events.add("click", (e) => {
          const id = String(e.get("objectId"));
          const пункт = points.find((p) => p.id === id);
          if (пункт) свежие.current.onSelect(пункт);
        });
        карта.geoObjects.add(менеджер);

        картаRef.current = карта;
        менеджерRef.current = менеджер;
        setСостояние("готова");
      })
      .catch((e) => {
        /*
         * Записываем, а не только показываем: узнать, что у людей не грузится
         * карта, иначе будет неоткуда — причина стирается вместе с ошибкой.
         */
        reportReadFailure(e, "карта пунктов выдачи");
        if (!живо) return;
        setСостояние("отказ");
        свежие.current.onUnavailable();
      });

    return () => {
      живо = false;
      картаRef.current?.destroy();
      картаRef.current = null;
      менеджерRef.current = null;
    };
    // `points` внутри — только для поиска по идентификатору из метки; состав
    // точек меняет соседний эффект, карту пересоздавать для этого не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [попытка]);

  /** Состав точек: обновляем содержимое, а не карту. */
  useEffect(() => {
    const менеджер = менеджерRef.current;
    if (!менеджер || состояние !== "готова") return;

    менеджер.removeAll();
    менеджер.add({ type: "FeatureCollection", features: точки });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ключПунктов, состояние]);

  /** Выбранная метка отличается цветом — иначе выбор на карте не виден. */
  useEffect(() => {
    const менеджер = менеджерRef.current;
    if (!менеджер || состояние !== "готова") return;

    for (const t of точки) {
      менеджер.objects.setObjectOptions(t.id, {
        preset: t.id === selectedId ? ВЫБРАННАЯ : ОБЫЧНАЯ,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ключПунктов, состояние]);

  /**
   * Контейнер получил размер — подогнать карту и пересчитать рамку.
   *
   * Карта, построенная в скрытом узле, имеет нулевой размер: на телефоне
   * переключатель стартует на списке, и без этого человек, нажавший «На
   * карте», видел серый прямоугольник без тайлов и без меток. Рамка там же:
   * на нулевой области она считается по нулю.
   *
   * Наблюдатель за размером, а не медиазапрос. Медиазапрос различает сервер
   * и браузер, и по правилу проекта первый кадр от него зависеть не может;
   * наблюдатель же покрывает разом и переключатель, и поворот экрана, и
   * открытие шторки — всё, от чего контейнер меняет размер.
   */
  useEffect(() => {
    const бокс = боксRef.current;
    if (!бокс || состояние !== "готова" || typeof ResizeObserver === "undefined") return;

    const подогнать = () => {
      const карта = картаRef.current;
      if (!карта || бокс.clientWidth === 0) return;

      карта.container.fitToViewport();
      const рамка = pvzBounds(points);
      if (рамка) {
        void карта
          .setBounds(рамка, { checkZoomRange: true, zoomMargin: 24 })
          .catch(ignoreFailure("рамка карты: останется город по умолчанию"));
      }
    };

    подогнать();
    const наблюдатель = new ResizeObserver(подогнать);
    наблюдатель.observe(бокс);

    return () => наблюдатель.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [состояние, ключПунктов]);

  if (состояние === "отказ") {
    return (
      <p className={className} style={{ color: "var(--foreground-50)" }}>
        <span className="text-[13px]">Карта не загрузилась. </span>
        <button
          type="button"
          className="text-[13px] font-semibold"
          style={{ color: "var(--accent)" }}
          onClick={() => setПопытка((n) => n + 1)}
        >
          Повторить
        </button>
      </p>
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <div
        ref={боксRef}
        className="h-[260px] w-full overflow-hidden rounded-[var(--r-card)]"
        aria-label={`Карта пунктов выдачи: ${точки.length}`}
      />
      {состояние === "грузится" && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-[var(--r-card)] text-[13px]"
          style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        >
          <Loader2 size={14} className="animate-spin" /> Карта загружается…
        </div>
      )}
    </div>
  );
}
