import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) {
      return;
    }

    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) {
      return;
    }

    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api?.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
});
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

/*
 * Стрелки листания.
 *
 * Позиция задаётся здесь и только здесь. Раньше базовый класс уводил их за
 * пределы карусели (`-left-12`), а место вызова возвращало обратно
 * (`left-[8px]`); при склейке терялись и сдвиг, и вертикальное
 * центрирование — обе стрелки оказывались друг на друге у левого края и у
 * нижнего края видео. Замер на 1440: обе на x 348 и 364 при центре видео 345
 * и центре стрелок 494.
 *
 * Прижаты к краям с отступом 12 и центрированы по вертикали относительно
 * содержимого карусели — то есть самого видео: кроме него в корне ничего
 * нет, а сами кнопки в поток не попадают.
 *
 * Круг 40 с полупрозрачной подложкой, значок 20. На узком экране 32: там
 * листают свайпом, и стрелка — подсказка, что слайд не один, а не основной
 * способ. Хит-зона в обоих случаях 44 — её даёт псевдоэлемент, не трогая
 * рисунок.
 *
 * Тупиковая стрелка не рисуется вовсе. Кнопка, которая никуда не ведёт,
 * — это обещание, которого нет; `disabled` оставляет её на экране серой,
 * а места у края видео и так мало.
 */
/*
 * Хит-зона задаётся здесь псевдоэлементом напрямую, а не через TAP_TARGET_44:
 * тот начинается с `relative`, а склейка классов считает `relative` и
 * `absolute` одной группой и оставляет последний. Кнопка переставала быть
 * absolute, падала в поток и уезжала под видео — ровно то, что чинится.
 */
const ARROW_BASE =
  "absolute top-1/2 z-[2] grid -translate-y-1/2 place-items-center rounded-full " +
  "h-[32px] w-[32px] sm:h-[40px] sm:w-[40px] " +
  "text-white transition-opacity hover:opacity-90 " +
  "after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 " +
  "after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

const ARROW_STYLE: React.CSSProperties = {
  background: "rgba(9,11,20,0.55)",
  backdropFilter: "blur(2px)",
};

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    if (!canScrollPrev) return null;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          ARROW_BASE,
          orientation === "horizontal" ? "left-[12px]" : "left-1/2 top-[12px] rotate-90",
          className,
        )}
        style={ARROW_STYLE}
        onClick={scrollPrev}
        {...props}
      >
        <ChevronLeft className="h-[20px] w-[20px]" />
        <span className="sr-only">Предыдущий слайд</span>
      </button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    if (!canScrollNext) return null;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          ARROW_BASE,
          orientation === "horizontal" ? "right-[12px]" : "left-1/2 bottom-[12px] rotate-90",
          className,
        )}
        style={ARROW_STYLE}
        onClick={scrollNext}
        {...props}
      >
        <ChevronRight className="h-[20px] w-[20px]" />
        <span className="sr-only">Следующий слайд</span>
      </button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};
