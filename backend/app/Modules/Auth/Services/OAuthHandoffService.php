<?php

namespace Modules\Auth\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Разовый код вместо токена в адресной строке.
 *
 * До 03.10 вход через провайдера возвращался так:
 * `/login?oauth_token=<живой токен Sanctum>`. Токен при этом не истекает
 * вовсе (`config/sanctum.php`, `expiration => null`), а адрес уезжает
 * дальше, чем кажется:
 *
 * — в журнал nginx. `access_log` выключен только для `/assets/` и
 *   `/csp-report`, основной `location /` пишется целой строкой запроса. То
 *   есть каждый вход через провайдера оставлял непросроченный bearer-токен в
 *   логах, которые ротируются, складываются в бэкапы и читаются шире, чем
 *   база.
 * — возможно, в Яндекс.Метрику. `Analytics.tsx` отправляет `location.href`
 *   целиком, а эффект привязан к пути, не к адресу; успеет ли
 *   `completeOAuthLogin` вычистить параметры раньше загрузки счётчика —
 *   гонка, и локально она не воспроизводится.
 *
 * Теперь в адресе едет код: случайные 64 знака, живёт две минуты и гасится
 * первым же обменом. В логах он остаётся, но к моменту, когда их кто-то
 * прочтёт, он уже ничего не открывает. Токен ходит только в теле ответа на
 * `POST /auth/oauth/exchange`.
 *
 * Почему не сразу cookie: приложение авторизуется заголовком `Authorization`
 * (токен лежит в localStorage, см. `frontend/src/lib/api/client.ts`), и
 * переход на cookie-сессию — отдельная работа, а не правка этого обмена.
 */
class OAuthHandoffService
{
    /**
     * Две минуты.
     *
     * Код живёт ровно от редиректа провайдера до первого запроса страницы
     * `/login`. Секунд хватило бы, но между ними бывает медленная сеть и
     * холодный бандл, а минута запаса ничего не стоит: код одноразовый.
     */
    private const TTL_SECONDS = 120;

    /** Выдать код под готовый токен. */
    public function issue(string $token): string
    {
        $code = Str::random(64);

        Cache::put($this->key($code), $token, self::TTL_SECONDS);

        return $code;
    }

    /**
     * Обменять код на токен. Второй раз тот же код не сработает.
     *
     * `Cache::pull` читает и удаляет одной операцией — именно поэтому
     * одноразовость не зависит от того, успели ли два запроса прийти
     * одновременно.
     */
    public function claim(string $code): ?string
    {
        if ($code === '') {
            return null;
        }

        $token = Cache::pull($this->key($code));

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function key(string $code): string
    {
        // Хешируем: иначе код лежал бы в ключах кеша открытым текстом, а
        // Redis просматривается шире, чем база.
        return 'oauth_handoff:'.hash('sha256', $code);
    }
}
