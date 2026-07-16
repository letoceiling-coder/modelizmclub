<?php

return [
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
