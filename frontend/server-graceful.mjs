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
