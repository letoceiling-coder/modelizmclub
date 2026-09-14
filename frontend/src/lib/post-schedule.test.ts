import { describe, expect, it } from "vitest";
import { scheduleInputsFromIso } from "./post-schedule";

describe("scheduleInputsFromIso — дата и время из одного пояса", () => {
  // Запись на 01:30 МСК = 22:30 UTC предыдущего дня. Раньше диалог переноса
  // брал дату из UTC (предыдущий день), а время — по часам браузера, и
  // сохранение «как есть» уводило запись на сутки назад.
  it("не отдаёт предыдущий день для ночной записи", () => {
    expect(scheduleInputsFromIso("2026-09-15T22:30:00Z", "Europe/Moscow")).toEqual({
      date: "2026-09-16",
      time: "01:30",
    });
  });

  it("считает в выбранном поясе, а не в поясе браузера", () => {
    expect(scheduleInputsFromIso("2026-09-15T22:30:00Z", "Asia/Vladivostok")).toEqual({
      date: "2026-09-16",
      time: "08:30",
    });
    expect(scheduleInputsFromIso("2026-09-15T22:30:00Z", "Europe/Kaliningrad")).toEqual({
      date: "2026-09-16",
      time: "00:30",
    });
  });
});
