<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Отказ отложенной публикации — в лог, а не в пустоту.
 *
 * Команды posts:publish-scheduled и videos:publish-scheduled идут каждую
 * минуту. До 14.09 отказ записи глотался молча, а отказ видео обрывал весь
 * прогон. Запись, которая не может выйти (автор потерял право публиковать,
 * сломанная строка), повторяла отказ раз в минуту бесконечно, и узнать об
 * этом было нельзя.
 *
 * Одна и та же строка пишется в лог не чаще раза в час: иначе один залипший
 * пост дал бы 1440 одинаковых строк в сутки и спрятал бы остальное.
 */
final class ScheduledPublishFailures
{
    public const THROTTLE_SECONDS = 3600;

    public static function report(string $kind, int $id, ?Throwable $error, string $reason = ''): void
    {
        if (! Cache::add("scheduled-publish-failed:{$kind}:{$id}", true, self::THROTTLE_SECONDS)) {
            return;
        }

        $context = ['kind' => $kind, 'id' => $id];
        if ($error !== null) {
            $context['exception'] = $error::class;
            $context['message'] = $error->getMessage();
            if (method_exists($error, 'errors')) {
                $context['errors'] = $error->errors();
            }
        }
        if ($reason !== '') {
            $context['reason'] = $reason;
        }

        Log::warning("Отложенная публикация не удалась: {$kind} #{$id}", $context);
    }
}
