\pset pager off
\echo === volume ===
SELECT count(*) AS total,
       count(*) FILTER (WHERE level='error') AS errors,
       min(created_at) AS first,
       max(created_at) AS last
FROM client_logs;

\echo === devices ===
SELECT platform, os, browser, device, count(*) AS n
FROM client_logs
GROUP BY 1,2,3,4
ORDER BY n DESC
LIMIT 30;

\echo === call status transitions ===
SELECT message, count(*) AS n
FROM client_logs
WHERE tag='calls' AND message LIKE 'status %'
GROUP BY 1
ORDER BY n DESC
LIMIT 40;

\echo === ice pairs (connect/fail) ===
SELECT message, platform, context->>'localType' AS local_type,
       context->>'remoteType' AS remote_type,
       context->>'ice' AS ice, context->>'conn' AS conn,
       count(*) AS n
FROM client_logs
WHERE message LIKE 'ice pair%'
GROUP BY 1,2,3,4,5,6
ORDER BY n DESC
LIMIT 40;

\echo === errors ===
SELECT created_at, platform, os, browser, message, context
FROM client_logs
WHERE level='error'
ORDER BY created_at DESC
LIMIT 40;
