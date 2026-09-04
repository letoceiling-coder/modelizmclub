<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Display variants (вариант A: очередь + GD WebP)
    |--------------------------------------------------------------------------
    |
    | Original stays on S3. A queued job writes thumb/card/medium/large.
    | Upload HTTP returns ready+original URL immediately.
    |
    */
    'variants' => [
        'enabled' => (bool) env('MEDIA_VARIANTS_ENABLED', true),
        'q_start' => (int) env('MEDIA_VARIANTS_Q_START', 84),
        'q_min' => (int) env('MEDIA_VARIANTS_Q_MIN', 76),
        'q_step' => (int) env('MEDIA_VARIANTS_Q_STEP', 4),
        'max_megapixels' => (int) env('MEDIA_VARIANTS_MAX_MEGAPIXELS', 40),
        'sizes' => [
            'thumb' => 320,
            'card' => 640,
            'medium' => 1080,
            'large' => 1600,
        ],
        'budgets' => [
            'thumb' => ['avif' => 28 * 1024, 'webp' => 40 * 1024, 'jpeg' => 55 * 1024],
            'card' => ['avif' => 56 * 1024, 'webp' => 80 * 1024, 'jpeg' => 110 * 1024],
            'medium' => ['avif' => 126 * 1024, 'webp' => 180 * 1024, 'jpeg' => 250 * 1024],
            'large' => ['avif' => 245 * 1024, 'webp' => 350 * 1024, 'jpeg' => 480 * 1024],
        ],

        /*
        | AVIF is encoded in a single pass (no quality ladder): GD's libavif
        | encoder costs seconds per frame, so retrying it four times per size
        | would dominate the queue worker. `speed` is libavif's effort knob —
        | 0 is slowest/smallest, 10 fastest/largest, 6 is the GD default.
        | Requires PHP built with AVIF support; silently skipped otherwise.
        */
        'avif' => [
            'enabled' => (bool) env('MEDIA_VARIANTS_AVIF', true),
            'quality' => (int) env('MEDIA_VARIANTS_AVIF_QUALITY', 58),
            'speed' => (int) env('MEDIA_VARIANTS_AVIF_SPEED', 7),
        ],
        'skip_purposes' => ['icon', 'post_video', 'review_video', 'voice'],
    ],

    'transcription' => [
        // Provider selection. Defaults to the stub unless a real provider is
        // explicitly chosen. Keeping MEDIA_TRANSCRIPTION_STUB for backward compat:
        // when it's false and no provider is set, we fall back to "yandex".
        'provider' => env(
            'MEDIA_TRANSCRIPTION_PROVIDER',
            env('MEDIA_TRANSCRIPTION_STUB', true) ? 'stub' : 'yandex',
        ),

        'stub' => (bool) env('MEDIA_TRANSCRIPTION_STUB', true),
        'stub_text' => env('MEDIA_TRANSCRIPTION_STUB_TEXT', 'Тестовая расшифровка голосового сообщения.'),
        'stub_lang' => env('MEDIA_TRANSCRIPTION_STUB_LANG', 'ru'),

        // Yandex SpeechKit (short audio, synchronous recognition). Voice notes
        // longer than the 30s API limit are transcoded to OggOpus and split into
        // <=segment_seconds chunks with ffmpeg, then recognized sequentially.
        'yandex' => [
            'api_key' => env('YANDEX_SPEECHKIT_API_KEY'),
            'folder_id' => env('YANDEX_SPEECHKIT_FOLDER_ID'),
            'lang' => env('YANDEX_SPEECHKIT_LANG', 'ru-RU'),
            'topic' => env('YANDEX_SPEECHKIT_TOPIC', 'general'),
            'endpoint' => env('YANDEX_SPEECHKIT_STT_URL', 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'),
        ],

        // Path to the ffmpeg binary used to normalize/segment audio for STT.
        'ffmpeg' => env('FFMPEG_BINARY', 'ffmpeg'),
        // Chunk length in seconds. Must stay under the SpeechKit sync limit (30s).
        'segment_seconds' => (int) env('MEDIA_TRANSCRIPTION_SEGMENT_SECONDS', 25),
    ],
];
