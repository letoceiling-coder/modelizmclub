<?php

return [
    // Public wss endpoint the browser connects to (nginx → 127.0.0.1:7880).
    'url' => env('LIVEKIT_URL', ''),
    'api_key' => env('LIVEKIT_API_KEY', ''),
    'api_secret' => env('LIVEKIT_API_SECRET', ''),
    // Access-token lifetime in seconds.
    'token_ttl' => (int) env('LIVEKIT_TOKEN_TTL', 6 * 3600),
];
