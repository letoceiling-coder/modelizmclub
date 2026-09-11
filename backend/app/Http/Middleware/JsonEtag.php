<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * ETag на JSON-ответы API и 304 вместо тела на повторный запрос.
 *
 * До 11.09 ни один ответ API не нёс ETag. Браузер, получивший
 * `Cache-Control: no-cache, private` (так Laravel отвечает по умолчанию) или
 * истёкший `max-age=15` у bootstrap, перезапрашивал ответ целиком, даже когда
 * тот не изменился. С ETag он переспрашивает с `If-None-Match` и получает 304
 * без тела.
 *
 * Сильный ETag из md5 тела. nginx при сжатии ослабляет его до `W/"…"`, и
 * браузер присылает назад уже слабую форму — Symfony `isNotModified`
 * сравнивает без `W/` (RFC 7232, 3.2), так что 304 всё равно срабатывает.
 * Проверено тестом на обе формы.
 *
 * Почему не штатный `cache.headers:etag`. Он не смотрит на статус и может
 * превратить в 304 редирект или ошибку с совпавшим телом. Здесь — только
 * 200 и только JSON: у стримов (медиа-прокси) тела в памяти нет, у
 * редиректов OAuth ETag не имеет смысла.
 *
 * Подключён ко всей группе api, а не к списку публичных маршрутов: ответ
 * с авторизацией от этого не становится общим — ETag вычисляется из тела,
 * и совпадёт только у одинаковых тел. Общих кешей для JSON перед API нет,
 * fastcgi_cache в nginx держит только медиа.
 */
class JsonEtag
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $request->isMethodCacheable()
            || $response->getStatusCode() !== 200
            || $response instanceof StreamedResponse
            || $response instanceof BinaryFileResponse
            || ! str_contains((string) $response->headers->get('Content-Type'), 'json')
            || $response->headers->has('ETag')) {
            return $response;
        }

        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return $response;
        }

        $response->setEtag(md5($content));
        $response->isNotModified($request);

        return $response;
    }
}
