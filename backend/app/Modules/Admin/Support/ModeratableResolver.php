<?php

namespace Modules\Admin\Support;

use App\Models\ChannelApplication;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\Listing;
use App\Models\Post;
use App\Models\Video;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModeratableResolver
{
    /** @var array<string, class-string<Model>> */
    private const MAP = [
        'posts' => Post::class,
        'post' => Post::class,
        'channel_posts' => ChannelPost::class,
        'channel_post' => ChannelPost::class,
        'communities' => Community::class,
        'community' => Community::class,
        'videos' => Video::class,
        'video' => Video::class,
        'listings' => Listing::class,
        'listing' => Listing::class,
    ];

    /**
     * Заявки на сообщество и канал — в очереди с 17.09. У них нет uuid, и в
     * разделе «Заявки» они с первого дня адресуются номером заявки
     * (`communities/applications/{id}`). Здесь тот же номер — `moderatable_id`
     * строки очереди, а не её собственный `id`.
     *
     * @var array<string, class-string<Model>>
     */
    private const APPLICATIONS = [
        'community_applications' => CommunityApplication::class,
        'channel_applications' => ChannelApplication::class,
    ];

    public function resolve(string $type, string $id): Model
    {
        $applicationClass = self::APPLICATIONS[strtolower($type)] ?? null;
        if ($applicationClass !== null) {
            $record = ctype_digit($id) ? $applicationClass::query()->find((int) $id) : null;
            if (! $record) {
                throw new NotFoundHttpException('Заявка не найдена.');
            }

            return $record;
        }

        $modelClass = self::MAP[strtolower($type)] ?? null;

        if (! $modelClass) {
            throw new NotFoundHttpException('Неизвестный тип модерации.');
        }

        /*
         * Все типы ищутся по uuid — ветка «иначе по ключу» была недостижима:
         * в её условии перечислены ровно те же типы, что и в карте выше.
         *
         * А без проверки формата это ещё и пятисотка. В очереди у задачи свой
         * числовой id, и передать его сюда — первое, что делает человек,
         * читающий вывод очереди: `moderation/listings/97/approve`. PostgreSQL
         * получал `where uuid = 97`, отвечал «invalid input syntax for type
         * uuid», и админка показывала «Server Error» вместо «не найдено».
         * Проверено на проде 08.09.
         */
        if (! preg_match('/^[0-9a-fA-F-]{36}$/', $id)) {
            throw new NotFoundHttpException(
                'Объект модерации адресуется по uuid, а не по номеру задачи в очереди.',
            );
        }

        $record = $modelClass::query()->where('uuid', $id)->first();

        if (! $record) {
            throw new NotFoundHttpException('Объект модерации не найден.');
        }

        return $record;
    }
}
