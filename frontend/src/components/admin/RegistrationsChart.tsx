import { useMemo } from "react";
import { разметка } from "@/lib/chart/scale";

/**
 * Регистрации по дням — столбики с числами, шкалой и подсказкой.
 *
 * ЧТО БЫЛО. Семь столбиков по зашитому в код массиву `[40, 65, 55, 80, 70,
 * 90, 60]` с подписями «пн…вс». Ни одного настоящего числа: график не
 * показывал ничего и никогда не менялся, а выглядел правдоподобно — и
 * заметить подмену по виду было нельзя.
 *
 * ПОЧЕМУ ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА. Тридцать столбиков, у каждого число
 * сверху и дата снизу. Подписи «28.09» занимают около тридцати пикселей, и
 * втиснуть их в ширину карточки, поделённую на тридцать, нельзя — они
 * налезут друг на друга. Поэтому у столбика фиксированная ширина, а узкий
 * экран прокручивается вбок. Это не уступка: альтернатива — выбросить часть
 * дат, а заказчик просил дату под каждым.
 *
 * ЧИСЛО НАД СТОЛБИКОМ, А НЕ ВНУТРИ. Внутри оно не помещается у низких
 * столбиков и обрезается у нулевых, а ноль просили показывать нулём.
 *
 * ПРО ПОДПИСЬ У КАЖДОГО. Общее правило разметки данных — подписывать
 * выборочно и отдавать остальное оси с подсказкой: число у каждой точки
 * обычно превращается в кашу. Здесь подписи стоят у всех, потому что об
 * этом просили прямо, и цена решения прикрыта фиксированной шириной
 * столбика: числа не сталкиваются ни на каком экране.
 */
export function RegistrationsChart({
  data,
  loading,
}: {
  data: Array<{ date: string; count: number }>;
  loading?: boolean;
}) {
  const { максимум, деления } = useMemo(() => разметка(data), [data]);

  if (loading && data.length === 0) {
    return (
      <div className="py-8 text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Загружаю…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Пока нет данных о регистрациях.
      </div>
    );
  }

  /*
   * Поле делится на две полосы: сверху место под числа, ниже — само поле
   * значений. Столбики и деления обязаны считать проценты от **одной**
   * высоты, иначе шкала и столбики разъезжаются: деление «20» оказывается
   * не там, где верх столбика в двадцать. Поэтому и сетка, и столбики
   * лежат в одном блоке `relative h-full`, а полоса чисел вынесена
   * отступом сверху — и тот же отступ стоит у шкалы слева.
   */
  const высотаПоля = 180;
  const полосаЧисел = 18;

  return (
    <div className="mt-4 flex" style={{ gap: "8px" }}>
      {/* Шкала вне прокрутки: она обязана оставаться на месте, когда
          столбики уезжают вбок. */}
      <div
        className="relative shrink-0"
        style={{ height: `${высотаПоля}px`, paddingTop: `${полосаЧисел}px`, width: "36px" }}
        aria-hidden="true"
      >
        <div className="relative h-full">
          {деления.map((значение) => (
            <span
              key={значение}
              className="absolute right-0 text-[10px] tabular-nums"
              style={{
                bottom: `${(значение / максимум) * 100}%`,
                color: "var(--foreground-50)",
                transform: "translateY(50%)",
              }}
            >
              {значение}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1" style={{ overflowX: "auto" }}>
        <div style={{ height: `${высотаПоля}px`, paddingTop: `${полосаЧисел}px` }}>
          <div className="relative h-full">
            {/*
              Сетка — сплошные волосяные линии на один тон от подложки.
              Пунктир читается как «прогноз» или «порог», а это просто сетка.
            */}
            {деления.map((значение) => (
              <div
                key={значение}
                className="pointer-events-none absolute inset-x-0"
                style={{
                  bottom: `${(значение / максимум) * 100}%`,
                  borderTop: "1px solid var(--border)",
                  opacity: значение === 0 ? 1 : 0.6,
                }}
              />
            ))}

            <div className="absolute inset-0 flex items-end" style={{ gap: "2px" }}>
              {data.map((точка) => (
                <Столбик key={точка.date} точка={точка} максимум={максимум} />
              ))}
            </div>
          </div>
        </div>

        {/*
          Даты — в потоке под полем, а не внутри него. Держать подписи в
          блоке фиксированной высоты значило бы либо отъесть место у
          столбиков, либо получить крошечную прокрутку внутри карточки.
        */}
        <div className="flex" style={{ gap: "2px", marginTop: "6px" }}>
          {data.map((точка) => (
            <span
              key={точка.date}
              className="shrink-0 text-center text-[10px] tabular-nums"
              style={{ color: "var(--foreground-50)", width: `${ШИРИНА}px` }}
            >
              {деньМесяц(точка.date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ширина столбика вместе с его подписью. От неё зависит, влезают ли даты. */
const ШИРИНА = 30;

function Столбик({
  точка,
  максимум,
}: {
  точка: { date: string; count: number };
  максимум: number;
}) {
  const доля = максимум > 0 ? точка.count / максимум : 0;

  /* Нулевой день — полоска на оси: два пикселя, чтобы он был виден. */
  const высота = точка.count === 0 ? "2px" : `max(3px, ${доля * 100}%)`;

  return (
    <div
      className="group relative shrink-0"
      style={{ height: "100%", width: `${ШИРИНА}px` }}
      title={`${полнаяДата(точка.date)} — ${точка.count}`}
    >
      {/*
        Число висит **над** столбиком, а не занимает место в колонке: иначе
        оно отъедало бы у столбиков высоту, и шкала перестала бы совпадать
        с ними. Внутрь столбика его класть нельзя — у низких и нулевых оно
        не помещается и обрезается.
      */}
      <span
        className="absolute left-0 right-0 text-center text-[10px] tabular-nums"
        style={{
          bottom: `calc(${точка.count === 0 ? "0px" : `${доля * 100}%`} + 3px)`,
          color: точка.count === 0 ? "var(--foreground-50)" : "var(--foreground)",
        }}
      >
        {точка.count}
      </span>
      <div
        className="absolute bottom-0"
        style={{
          height: высота,
          insetInline: "2px",
          background: точка.count === 0 ? "var(--border)" : "var(--accent-fill)",
          borderRadius: "4px 4px 0 0",
        }}
      />
      {/*
        Подсказка при наведении: полная дата и точное число. Своя, а не
        только `title`, — системная всплывает с задержкой и не умеет
        показывать две строки.
      */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[11px] group-hover:block"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          marginBottom: "4px",
        }}
      >
        {полнаяДата(точка.date)} · {точка.count}
      </div>
    </div>
  );
}

/** «28.09» — под столбиком. */
function деньМесяц(iso: string): string {
  const [, месяц, день] = iso.split("-");

  return `${день}.${месяц}`;
}

/** «28.09.2026» — в подсказке, где места хватает. */
function полнаяДата(iso: string): string {
  const [год, месяц, день] = iso.split("-");

  return `${день}.${месяц}.${год}`;
}
