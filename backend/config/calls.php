<?php

return [
    // Public STUN servers (no auth). Always included.
    'stun' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'CALLS_STUN_URLS',
        'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
    ))))),

    // Self-hosted coturn (TURN). Ephemeral credentials are derived from the
    // shared static-auth-secret using coturn's "TURN REST API" scheme.
    'turn' => [
        // e.g. "turn:turn.modelizmclub.ru:3478" — comma-separated for multiple transports.
        'urls' => array_values(array_filter(array_map('trim', explode(',', (string) env('CALLS_TURN_URLS', ''))))),
        'secret' => env('CALLS_TURN_SECRET'),
        // Credential lifetime in seconds.
        'ttl' => (int) env('CALLS_TURN_TTL', 3600),
    ],
];
