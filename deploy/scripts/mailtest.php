<?php

use Illuminate\Support\Facades\Mail;

$to = getenv('MAIL_TEST_TO') ?: 'dsc-23@yandex.ru';

try {
    Mail::raw('Тестовое письмо от ModelizmClub. SMTP работает.', function ($m) use ($to) {
        $m->to($to)->subject('SMTP тест — ModelizmClub');
    });
    echo "MAIL_SENT_OK to {$to}\n";
} catch (\Throwable $e) {
    echo 'MAIL_ERROR: ' . $e->getMessage() . "\n";
}
