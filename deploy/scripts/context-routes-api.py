#!/usr/bin/env python3
"""Пересобрать docs/context/21-routes-api.md из `php artisan route:list --json`.

Документ до 13.09 писался руками по снимку 03.09 и за десять дней разошёлся
с продом на 11 маршрутов, а его выводы про авторизацию («одна policy на
проект») перестали быть верными. Руками такое расходится снова, поэтому
таблица и все числа в шапке теперь собираются этим скриптом.

    ssh root@сервер 'cd /var/www/modelizmclub/backend && \
      sudo -u www-data php artisan route:list --json' > /tmp/routes.json
    python3 deploy/scripts/context-routes-api.py /tmp/routes.json \
      --commit "$(ssh root@сервер 'cd /var/www/modelizmclub && git log -1 --format=%h')"

Список маршрутов берётся с прода, а не из рабочего дерева: документ отвечает
на вопрос «что сейчас принимает боевой API». Числа про авторизацию считаются
по `backend/app` рабочего дерева — выкатывайте документ с того же коммита,
что стоит на проде (он пишется в шапку).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "backend" / "app"
OUT = ROOT / "docs" / "context" / "21-routes-api.md"

# Служебные слои есть у каждого маршрута и ничего не говорят о доступе.
NOISE = {"api", "SubstituteBindings", "EnsureFrontendRequestsAreStateful", "web"}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def short_middleware(raw: str) -> str:
    name, _, params = raw.partition(":")
    name = name.rsplit("\\", 1)[-1]
    if name == "Authenticate":
        name, params = "auth", params or "sanctum"
    return f"{name}:{params}" if params else name


def controller(action: str) -> str:
    if not action or action == "Closure":
        return "замыкание"
    cls, _, method = action.partition("@")
    cls = cls.rsplit("\\", 1)[-1]
    return cls if method in ("", "__invoke") else f"{cls}@{method}"


def grep_count(pattern: str, files_only: bool = False) -> int:
    rx = re.compile(pattern)
    total = 0
    for path in APP.rglob("*.php"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        hits = len(rx.findall(text))
        total += (1 if hits else 0) if files_only else hits
    return total


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("routes", help="JSON от `php artisan route:list --json`")
    ap.add_argument("--commit", required=True, help="коммит, стоящий на проде")
    ap.add_argument("--date", default=dt.date.today().strftime("%d.%m.%Y"))
    args = ap.parse_args()

    raw = json.loads(Path(args.routes).read_text(encoding="utf-8"))
    rows = []
    api_routes = 0
    for r in raw:
        if not r["uri"].startswith("api/"):
            continue
        api_routes += 1
        mw = r["middleware"] if isinstance(r["middleware"], list) else [r["middleware"]]
        mw = [short_middleware(m) for m in mw if m]
        mw = [m for m in mw if m.split(":")[0] not in NOISE]
        for method in r["method"].split("|"):
            if method == "HEAD":
                continue
            rows.append(
                {
                    "method": method,
                    "uri": "/" + r["uri"],
                    "controller": controller(r.get("action") or ""),
                    "mw": mw,
                    "write": method in WRITE_METHODS,
                }
            )
    rows.sort(key=lambda x: (x["uri"], x["method"]))

    mw_counter = Counter(m for row in rows for m in set(row["mw"]))
    writes = sum(1 for x in rows if x["write"])
    authed = sum(1 for x in rows if "auth:sanctum" in x["mw"])
    public_writes = [x for x in rows if x["write"] and "auth:sanctum" not in x["mw"]]

    policies = sorted(
        str(p.relative_to(ROOT)) for p in APP.rglob("*Policy.php") if "/Policies/" in str(p)
    )
    facts = [
        ("Policy-классов (`*/Policies/*Policy.php`)", len(policies)),
        ("Регистраций `Gate::policy`", grep_count(r"Gate::policy\(")),
        ("Вызовов `Gate::` всего", grep_count(r"Gate::")),
        ("`->can(` / `->cannot(`", grep_count(r"->(?:can|cannot)\(")),
        ("`authorize(` в контроллерах", grep_count(r"\$this->authorize\(")),
        ("`abort_if` / `abort_unless`", grep_count(r"\babort_(?:if|unless)\(")),
    ]

    head = subprocess.run(
        ["git", "-C", str(ROOT), "log", "-1", "--format=%h"], capture_output=True, text=True
    ).stdout.strip()

    out = []
    out.append("# 21 — Маршруты API\n")
    out.append(
        f"> **Снимок {args.date}, прод на `{args.commit}`.** Собран скриптом\n"
        "> `deploy/scripts/context-routes-api.py` из `php artisan route:list --json`\n"
        "> боевого сервера — пересобирайте им же, руками не правьте.\n"
        f"> Числа про авторизацию посчитаны по `backend/app` на `{head}`.\n"
    )
    out.append(
        f"Маршрутов под префиксом `/api` — **{api_routes}** (так считает `route:list`).\n"
        f"В таблице **{len(rows)}** строк: маршрут с несколькими методами (`PUT|PATCH`, `GET|POST`)\n"
        f"разложен по методу на строку, HEAD не показан. Изменяющих строк — **{writes}**,\n"
        f"под `auth:sanctum` — **{authed}**.\n"
    )
    out.append("## Как устроена авторизация — читать до таблицы\n")
    out.append(
        "Доступ к маршруту решает middleware: вход (`auth:sanctum`), подтверждённый номер\n"
        "(`EnsureFullyVerified`), подписка (`RequiresSubscription`), роль (`EnsureUserRole`).\n"
        "Право на конкретный объект — владелец, участник — проверяется внутри: в policy,\n"
        "в контроллере или в сервисе. По таблице маршрутов это не видно.\n"
    )
    out.append("| Middleware | Маршрутов |\n|---|---:|")
    for name, n in sorted(mw_counter.items(), key=lambda x: (-x[1], x[0])):
        out.append(f"| `{name}` | {n} |")
    out.append("")
    out.append("| Проверки объекта в `backend/app` | Найдено |\n|---|---:|")
    for label, n in facts:
        out.append(f"| {label} | {n} |")
    out.append("")
    if policies:
        out.append("Policy-классы: " + ", ".join(f"`{p}`" for p in policies) + ".\n")
    out.append(
        f"Изменяющих строк без `auth:sanctum` — **{len(public_writes)}**. Все маршруты группы `api`\n"
        "дополнительно проходят общий лимит частоты; отдельный лимит и проверка подписи\n"
        "вебхука, если они есть, — в столбце «Middleware» и в контроллере.\n"
    )
    out.append("| Метод | URI | Контроллер | Middleware |\n|---|---|---|---|")
    for x in public_writes:
        out.append(f"| {x['method']} | `{x['uri']}` | `{x['controller']}` | {','.join(x['mw']) or '—'} |")
    out.append("")
    out.append("## Полный список\n")
    out.append("Изменяющие маршруты помечены ✎.\n")
    out.append("| | Метод | URI | Контроллер | Middleware |\n|---|---|---|---|---|")
    for x in rows:
        mark = "✎" if x["write"] else ""
        mw = ",".join(x["mw"]) or "—"
        out.append(f"| {mark} | {x['method']} | `{x['uri']}` | `{x['controller']}` | {mw} |")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} маршрутов, изменяющих {writes}")


if __name__ == "__main__":
    main()
