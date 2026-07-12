<?php

return [
    'transcription' => [
        'stub' => (bool) env('MEDIA_TRANSCRIPTION_STUB', true),
        'stub_text' => env('MEDIA_TRANSCRIPTION_STUB_TEXT', 'Тестовая расшифровка голосового сообщения.'),
        'stub_lang' => env('MEDIA_TRANSCRIPTION_STUB_LANG', 'ru'),
    ],
];
