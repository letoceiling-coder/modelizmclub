#!/usr/bin/env bash
# Каков CI у коммита, который собираются выкатывать.
#
#   check-ci-status.sh            # HEAD текущей ветки
#   check-ci-status.sh <sha>      # конкретный коммит
#
# Ответов три, и они разные по смыслу:
#
#   0  зелёный    — выкатывать можно
#   1  красный    — выкатка при красном CI требует отдельного согласия
#   2  неизвестно — прогон идёт, ещё не начинался, или спросить не удалось.
#                   НЕ ТО ЖЕ, ЧТО ЗЕЛЁНЫЙ.
#
# Третий ответ и есть причина, по которой это скрипт, а не строчка в
# документе. Однострочка, которую я 10.09 записал в CLAUDE.md, падала с
# трассировкой Python, когда GitHub отвечал «rate limit exceeded»: без
# токена дают 60 запросов в час, и кончаются они быстрее, чем кажется.
# Трассировка выглядит как поломка инструмента, а не как «проверить
# нельзя», и подталкивает выкатить не проверив — ровно наоборот тому, ради
# чего проверка заводилась.
#
# GH_TOKEN, если он есть в окружении, поднимает лимит и открывает закрытые
# репозитории. Без него всё работает, пока лимит не исчерпан.
set -uo pipefail

REPO="${CI_REPO:-letoceiling-coder/modelizmclub}"
SHA="${1:-$(git rev-parse HEAD 2>/dev/null)}"

if [[ -z "${SHA}" ]]; then
  echo "CI: не удалось определить коммит" >&2
  exit 2
fi

URL="https://api.github.com/repos/${REPO}/actions/runs?head_sha=${SHA}"

# Без массива: под `set -u` пустой массив в bash 3.2 (он же на маках) — это
# «unbound variable», и curl не запускается вовсе. Ошибка при этом уходит в
# ветку «нет ответа», то есть отвечает честно, но по неверной причине.
if [[ -n "${GH_TOKEN:-}" ]]; then
  CI_BODY="$(curl -s --max-time 20 -H "Authorization: Bearer ${GH_TOKEN}" "${URL}" 2>/dev/null)"
else
  CI_BODY="$(curl -s --max-time 20 "${URL}" 2>/dev/null)"
fi
export CI_BODY SHA

python3 <<'PY'
import json
import os
import sys

sha = os.environ["SHA"]
raw = os.environ.get("CI_BODY", "")


def unknown(*lines: str) -> None:
    for line in lines:
        print(line, file=sys.stderr)
    print("    Это не «зелёный».", file=sys.stderr)
    sys.exit(2)


if not raw.strip():
    unknown("CI: спросить не удалось — нет ответа от api.github.com")

try:
    data = json.loads(raw)
except ValueError:
    unknown(f"CI: ответ не разобран — {raw[:120]}")

# Отказ приходит объектом с message, а не списком прогонов.
if "workflow_runs" not in data:
    unknown(
        f"CI: спросить не удалось — {data.get('message', 'неизвестная ошибка')}",
        "    Без токена GitHub даёт 60 запросов в час. Задайте GH_TOKEN или подождите.",
    )

runs = data["workflow_runs"]
if not runs:
    unknown(
        f"CI: прогонов для {sha[:8]} нет — ещё не начинался.",
        "    Подождите, а не выкатывайте.",
    )

run = runs[0]
if run["status"] != "completed":
    unknown(f"CI: {sha[:8]} — идёт ({run['status']}). Дождитесь конца.")

if run["conclusion"] == "success":
    print(f"CI: {sha[:8]} — зелёный")
    sys.exit(0)

print(f"CI: {sha[:8]} — {run['conclusion']}", file=sys.stderr)
print(f"    {run['html_url']}", file=sys.stderr)
print("    Выкатка при красном CI требует отдельного согласия заказчика.", file=sys.stderr)
sys.exit(1)
PY
