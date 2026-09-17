<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\Response;

/**
 * Сообщение об ошибке API — по-русски.
 *
 * Замер прода 17.09: наружу уходили тексты фреймворка — «Unauthenticated.»
 * на каждом закрытом маршруте, «This action is unauthorized.» на отказах
 * политик (39 вызовов authorize), «The route … could not be found.»,
 * «The DELETE method is not supported…», а `abort(403)` без текста отдавал
 * пустое сообщение. Переводы — в lang/ru.json, рядом с lang/ru/validation.php.
 *
 * Наши собственные сообщения уже русские и проходят как есть: перевод
 * ищется по английскому ключу, русский текст ключом не бывает.
 */
final class ApiErrorMessage
{
    public static function translate(?string $message, int $status): string
    {
        $message = trim((string) $message);

        // Тексты с подставленными деталями маршрута или модели — к общему ключу.
        $key = match (true) {
            $message === '' => Response::$statusTexts[$status] ?? 'Server Error',
            (bool) preg_match('/^The route .* could not be found\.$/', $message) => 'Not Found',
            (bool) preg_match('/^No query results for model/', $message) => 'Not Found',
            (bool) preg_match('/^The \w+ method is not supported for route/', $message) => 'Method Not Allowed',
            default => $message,
        };

        return __($key);
    }
}
