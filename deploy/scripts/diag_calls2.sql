\pset pager off
\echo === call tag messages ===
SELECT tag, message, count(*) AS n
FROM client_logs
WHERE tag = 'calls'
GROUP BY 1, 2
ORDER BY n DESC
LIMIT 50;

\echo === recent call_logs ===
SELECT id, status, media, started_at, ended_at, caller_id, callee_id
FROM call_logs
ORDER BY started_at DESC
LIMIT 15;

\echo === call debug logs last 7 days ===
SELECT created_at, platform, message, context
FROM client_logs
WHERE tag = 'calls'
ORDER BY created_at DESC
LIMIT 30;
