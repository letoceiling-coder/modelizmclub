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

            /*
            | Запасной кодировщик — `avifenc` из libavif-bin. Нужен, потому что
            | Ubuntu-шный libgd3 собран без libavif и `imageavif` в PHP нет.
            | `auto` берёт встроенный, если он есть, иначе бинарник; `avifenc`
            | — всегда бинарник. Один поток: воркер медиа фоновый.
            */
            'prefer' => env('MEDIA_VARIANTS_AVIF_ENCODER', 'auto'),
            'avifenc' => env('MEDIA_AVIFENC', 'avifenc'),
            'threads' => (int) env('MEDIA_AVIFENC_THREADS', 1),
            'timeout' => (int) env('MEDIA_AVIFENC_TIMEOUT', 60),
        ],
        'skip_purposes' => ['icon', 'post_video', 'review_video', 'voice'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Видео: постер и облегчённая копия для ленты
    |--------------------------------------------------------------------------
    |
    | Оригинал остаётся на месте и отдаётся в полноэкранном режиме. Очередь
    | снимает с него кадр-постер и собирает копию 720p: лента открывает
    | четырнадцатимегабайтный исходник только ради первого кадра.
    |
    | Пайплайн тот же, что у картинок (очередь + задача + процессор), но
    | кодирует ffmpeg, а не GD, поэтому и очередь отдельная: транскодирование
    | минутного ролика занимает десятки секунд, а воркер `default` живёт с
    | таймаутом 120 с и обслуживает почту и уведомления.
    |
    */
    'video' => [
        'enabled' => (bool) env('MEDIA_VIDEO_ENABLED', true),
        'queue' => env('MEDIA_VIDEO_QUEUE', 'media'),
        'ffmpeg' => env('MEDIA_FFMPEG', 'ffmpeg'),
        'ffprobe' => env('MEDIA_FFPROBE', 'ffprobe'),
        /* Сколько секунд ffmpeg может работать над одним файлом. */
        'timeout' => (int) env('MEDIA_VIDEO_TIMEOUT', 1500),
        /* Дальше этого размера исходник не берём в работу вовсе. */
        'max_source_bytes' => (int) env('MEDIA_VIDEO_MAX_SOURCE_BYTES', 512 * 1024 * 1024),
        'poster' => [
            /* Кадр берём не с нуля: первые кадры часто чёрные. */
            'at_seconds' => (float) env('MEDIA_VIDEO_POSTER_AT', 1.0),
            'max_width' => (int) env('MEDIA_VIDEO_POSTER_WIDTH', 1280),
            /* Требование к первому экрану: постер до 100 КБ. */
            'budget_bytes' => (int) env('MEDIA_VIDEO_POSTER_BUDGET', 100 * 1024),
            'q_start' => (int) env('MEDIA_VIDEO_POSTER_Q_START', 80),
            'q_min' => (int) env('MEDIA_VIDEO_POSTER_Q_MIN', 50),
            'q_step' => (int) env('MEDIA_VIDEO_POSTER_Q_STEP', 10),
        ],
        'rendition' => [
            'name' => '720p',
            'height' => (int) env('MEDIA_VIDEO_HEIGHT', 720),
            'crf' => (int) env('MEDIA_VIDEO_CRF', 26),
            'preset' => env('MEDIA_VIDEO_PRESET', 'veryfast'),
            'audio_kbps' => (int) env('MEDIA_VIDEO_AUDIO_KBPS', 96),
            /*
            | Копия имеет смысл, только если она заметно легче исходника.
            | Ролик, снятый телефоном в 720p и уже сжатый, перекодировать
            | незачем — отдадим оригинал и сэкономим место.
            */
            'min_saving_ratio' => (float) env('MEDIA_VIDEO_MIN_SAVING', 0.8),
        ],
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
