import { Suspense, lazy, useEffect, useState } from "react";

/*
 * Экраны звонка монтируются после гидрации.
 *
 * Они висят в корне и нужны в любой момент — но до первого кадра не нужны
 * никому. Пока они отрисовывались на сервере (даже через `React.lazy`, даже
 * внутри `Suspense`), Vite клал в HTML `modulepreload` на их чанк: 80 КБ
 * качались с высоким приоритетом на каждой ленте и отбирали полосу у
 * LCP-картинки. Отложенное монтирование убирает их из графа серверной
 * отрисовки — предзагрузки нет, а поведение прежнее: к моменту, когда звонок
 * может прийти, чанк уже загружен.
 *
 * Первый кадр клиента при этом совпадает с серверным: до `useEffect` здесь
 * тоже `null`.
 */
const CallScreen = lazy(() =>
  import("@/components/calls/CallScreen").then((m) => ({ default: m.CallScreen })),
);
const GroupCallScreen = lazy(() =>
  import("@/components/calls/GroupCallScreen").then((m) => ({ default: m.GroupCallScreen })),
);
const GroupCallInviteDialog = lazy(() =>
  import("@/components/calls/GroupCallInviteDialog").then((m) => ({
    default: m.GroupCallInviteDialog,
  })),
);

export function CallHost() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <CallScreen />
      <GroupCallScreen />
      <GroupCallInviteDialog />
    </Suspense>
  );
}
