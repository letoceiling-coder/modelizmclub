\pset pager off
SELECT created_at, message, platform, context
FROM client_logs
WHERE message LIKE 'ice pair%'
ORDER BY created_at DESC;
