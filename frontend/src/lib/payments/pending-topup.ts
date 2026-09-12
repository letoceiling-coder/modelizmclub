/**
 * Платёж, начатый в этой вкладке, — чтобы на возврате было что спросить.
 *
 * Собственный возвратный адрес сервера (`WalletTopupController`) —
 * `/settings/wallet?payment=success`, без идентификатора платежа: адрес
 * строится до того, как платёж создан. До 12.09 страница кошелька принимала
 * этот адрес за доказательство и показывала «Баланс пополнен», ни о чём
 * сервер не спросив, — то есть на обычном пути успех объявлялся всегда,
 * включая случай, когда банк платёж отклонил.
 *
 * `sessionStorage`, а не `localStorage`: запись нужна ровно на время похода
 * в банк и обратно в этой же вкладке. Забирается один раз — повторный возврат
 * на тот же адрес не должен молча пересинхронизировать старый платёж.
 */
const KEY = "mc_pending_topup";

export function rememberTopup(paymentUuid: string): void {
  if (!paymentUuid) return;
  try {
    sessionStorage.setItem(KEY, paymentUuid);
  } catch {
    // Приватный режим: останется путь «спросить нечего» — он честный.
  }
}

/** Возвращает запомненный платёж и сразу забывает его. */
export function takeRememberedTopup(): string | null {
  try {
    const uuid = sessionStorage.getItem(KEY);
    if (uuid) sessionStorage.removeItem(KEY);
    return uuid;
  } catch {
    return null;
  }
}
