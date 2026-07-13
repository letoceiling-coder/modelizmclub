# Known issues — infrastructure / deploy scripts

Non-code problems found while working on the app, recorded here instead of
silently working around them each time, so they get fixed once at the
source.

## `deploy-neeklo-frontend.sh` does not `git pull`

**Found:** 2026-07-13, while deploying a hotfix for a production crash on `/feed`.

`deploy/scripts/deploy-neeklo-frontend.sh` builds and restarts the frontend
from whatever is *currently checked out* on the server — it never runs
`git pull`. Only `deploy/scripts/deploy-neeklo.sh` (the backend script) pulls.

Consequence: running the frontend-only deploy script after pushing new
frontend commits silently rebuilds the **old** code. The build succeeds,
the service restarts, everything reports "OK" — but the live site doesn't
change. This is easy to miss because there is no error; the deployed
JS chunk hashes just don't change.

**What happened concretely:** a hotfix commit was pushed, the frontend
deploy script was run, it reported success, but the site kept crashing
with the exact same error and the exact same JS chunk hash as before the
fix. Only checking `git log -1` on the server (and comparing asset
filenames) revealed the script had built stale code.

**Suggested fix:** add a `git pull origin <branch>` step to
`deploy-neeklo-frontend.sh` (mirroring what `deploy-neeklo.sh` already
does), or document clearly that the backend script must always run first
even for frontend-only changes.

**Workaround until fixed:** always run `git -C /var/www/modelizmclub-neeklo
pull origin neeklo` manually before invoking
`deploy-neeklo-frontend.sh`, and verify by diffing `git log -1` before/after
or checking that the built asset hash for a known-changed file actually
changed.
