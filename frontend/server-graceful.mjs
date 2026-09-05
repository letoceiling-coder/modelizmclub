/**
 * A deadline for shutdown, loaded ahead of the Nitro server with `node --import`.
 *
 * srvx (the HTTP layer under Nitro) already handles SIGTERM: it stops accepting
 * connections, waits SERVER_SHUTDOWN_TIMEOUT seconds for the in-flight ones and
 * then destroys what is left. What nothing handles is the event loop staying
 * open afterwards — any library timer armed during SSR keeps the process alive
 * long after the socket is closed. That is what made a deploy hang until
 * systemd sent SIGKILL 90 seconds later, with nginx answering 502 the whole
 * time because the listening socket was already gone.
 *
 * So this adds the one guarantee the stack does not give: the process exits.
 * The deadline starts on the signal and is unref'd, so a server that shuts down
 * on its own is never delayed by it.
 */
const DEADLINE_MS = Number.parseInt(process.env.SHUTDOWN_DEADLINE_MS ?? "", 10) || 10_000;

let armed = false;

function armDeadline(signal) {
  if (armed) return;
  armed = true;

  const timer = setTimeout(() => {
    process.stderr.write(
      `[graceful] still alive ${DEADLINE_MS}ms after ${signal} — exiting; ` +
        `active: ${process.getActiveResourcesInfo?.().join(",") ?? "unknown"}\n`,
    );
    process.exit(0);
  }, DEADLINE_MS);

  timer.unref();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => armDeadline(signal));
}

/**
 * Приём слушающего сокета от systemd (socket activation).
 *
 * Плавная остановка убрала девяностосекундный простой, но не убрала разрыв:
 * `systemctl restart` — это стоп и старт, и между «старый процесс закрыл
 * сокет» и «новый забиндил порт» на 3000 не слушает никто. nginx получает
 * ECONNREFUSED и отвечает 502 сразу, без повтора. Замерено на проде 05.09
 * при двух переключениях релиза: окна 0,72 и 0,75 с, по четыре ответа 502.
 *
 * Когда сокет держит systemd, он переживает перезапуск сервиса: ядро
 * складывает входящие соединения в очередь, и запрос ждёт лишнюю долю
 * секунды вместо отказа. Nitro и srvx такой возможности не дают — srvx
 * зовёт `server.listen({ port, host })`, — поэтому подменяем аргумент здесь,
 * до загрузки сервера, и только когда systemd действительно передал дескриптор.
 *
 * LISTEN_PID проверяется потому, что переменные наследуются дочерними
 * процессами: без проверки чужой процесс принял бы дескриптор за свой.
 */
import net from "node:net";

const LISTEN_FD = 3;
const fdsPassed = Number.parseInt(process.env.LISTEN_FDS ?? "", 10) || 0;
const fdsForUs = Number.parseInt(process.env.LISTEN_PID ?? "", 10) === process.pid;

if (fdsPassed > 0 && fdsForUs) {
  const originalListen = net.Server.prototype.listen;
  let adopted = false;

  net.Server.prototype.listen = function listenWithInheritedFd(...args) {
    const first = args[0];
    const wantsPort =
      !adopted && typeof first === "object" && first !== null && first.port !== undefined;

    if (!wantsPort) return originalListen.apply(this, args);

    adopted = true;
    const { port, host, ...rest } = first;
    process.stderr.write(
      `[graceful] сокет от systemd: слушаем fd ${LISTEN_FD} вместо ${host ?? ""}:${port}\n`,
    );
    return originalListen.call(this, { ...rest, fd: LISTEN_FD }, ...args.slice(1));
  };
}
