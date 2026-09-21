<?php

namespace Modules\Chat\Http\Resources;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Http\Resources\Concerns\HasCanFlags;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Chat\Services\ChatService;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Conversation */
class ConversationResource extends JsonResource
{
    use HasCanFlags;

    public function toArray(Request $request): array
    {
        $user = $request->user();
        $participants = $this->whenLoaded('participants', fn () => $this->participants);
        $lastMessage = match (true) {
            $this->relationLoaded('latestMessage') => $this->latestMessage,
            $this->relationLoaded('messages') => $this->messages->first(),
            default => null,
        };

        $myParticipant = $participants
            ? $this->participants->first(fn ($p) => $user && $p->user_id === $user->id)
            : null;

        $title = $this->title;
        /*
         * Собеседник ушёл из личной переписки.
         *
         * Подписку на канал беседы даёт только `left_at IS NULL`, и живых
         * сообщений ушедший не получает. До 21.09 отправитель об этом не знал
         * ничего: письмо помечалось «отправлено» и оставалось таким навсегда.
         * На проде такое сообщение нашлось ровно одно — но отличить «не
         * прочитал» от «не услышит» было нельзя, а это разные вещи.
         */
        $peerLeft = false;
        if ($this->type === ConversationType::Direct && $user && $participants) {
            $other = $this->participants
                ->first(fn ($p) => $p->user_id !== $user->id);
            $title = $other?->user?->profile?->display_name ?? $other?->user?->name ?? 'Диалог';
            // Второй стороны может не быть вовсе: до нынешнего кода такие
            // беседы заводились — девять штук на проде. Для отправителя это
            // то же самое, что ушедший собеседник.
            $peerLeft = $other === null || $other->left_at !== null;
        }

        $lastReadMessageId = $myParticipant?->last_read_message_id !== null
            ? (int) $myParticipant->last_read_message_id
            : null;

        return [
            'uuid' => $this->uuid,
            'can' => $this->canFlags($request->user(), ['view', 'send', 'delete', 'pin']),
            'type' => $this->type->value,
            'title' => $title,
            'peer_left' => $peerLeft,
            'listing_id' => $this->listing_id,
            'listing' => $this->whenLoaded('listing', fn () => $this->listing
                ? new ListingCompactResource($this->listing)
                : null),
            'deal' => $this->whenLoaded('safeDeal', fn () => [
                'uuid' => $this->safeDeal->uuid,
                'status' => $this->safeDeal->status->value,
                'status_label' => $this->safeDeal->status->label(),
            ]),
            // Обычная сделка — продажа, отмеченная продавцом в этом чате.
            'ordinary_deal' => $this->whenLoaded('activeOrdinaryDeal', fn () => $this->activeOrdinaryDeal ? [
                'uuid' => $this->activeOrdinaryDeal->uuid,
                'status' => $this->activeOrdinaryDeal->status->value,
                'status_label' => $this->activeOrdinaryDeal->status->label(),
                'role' => $user && (int) $this->activeOrdinaryDeal->buyer_id === (int) $user->id ? 'buyer' : 'seller',
            ] : null),
            // Можно ли человеку отметить продажу лота, о котором этот чат.
            'can_mark_sold' => $this->canMarkSold($user),
            'is_pinned' => $myParticipant?->pinned_at !== null,
            'pinned_at' => $myParticipant?->pinned_at?->toIso8601String(),
            'pinned_message' => $this->whenLoaded('pinnedMessage', function () use ($user) {
                if (! $this->pinnedMessage || ! $user) {
                    return $this->pinnedMessage ? new MessageResource($this->pinnedMessage) : null;
                }

                return app(ChatService::class)->isMessageHiddenForUser($this->pinnedMessage, $user)
                    ? null
                    : new MessageResource($this->pinnedMessage);
            }),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            // Курсор «докуда дочитано»: id — для сервера, uuid — для клиента,
            // который открывает диалог на первом непрочитанном сообщении.
            'last_read_message_id' => $lastReadMessageId,
            'last_read_message_uuid' => $lastReadMessageId === null
                ? null
                : $this->resolveLastReadMessageUuid($lastReadMessageId),
            'participants' => $participants
                ? $this->participants->map(fn ($p) => [
                    'user' => new UserCompactResource($p->user),
                    'role' => $p->role,
                    'pinned_at' => $p->pinned_at?->toIso8601String(),
                ])
                : [],
            'last_message' => $lastMessage && $user && ! app(ChatService::class)->isMessageHiddenForUser($lastMessage, $user)
                ? new MessageResource($lastMessage)
                : null,
            'unread_count' => $user
                ? (int) ($this->unread_count ?? app(ChatService::class)->unreadCountFor(
                    $this->resource,
                    $user,
                    $myParticipant?->last_read_message_id,
                ))
                : 0,
            'room' => $this->when(
                $this->type === ConversationType::Room && $this->post_category_id !== null,
                fn () => [
                    'category_id' => (int) $this->post_category_id,
                    'slug' => $this->roomCategorySlug(),
                ],
            ),
            'community' => $this->when(
                $this->type === ConversationType::Community && $this->relationLoaded('community'),
                fn () => $this->community ? [
                    'slug' => $this->community->slug,
                    'name' => $this->community->name,
                    'avatar' => $this->community->avatar?->url,
                ] : null,
            ),
        ];
    }

    /**
     * uuid последнего прочитанного сообщения. В списке диалогов приходит
     * подзапросом (my_last_read_message_uuid), в одиночном ресурсе — точечным
     * запросом: одна строка на диалог, не на сообщение.
     */
    private function resolveLastReadMessageUuid(int $messageId): ?string
    {
        $preloaded = $this->resource->getAttribute('my_last_read_message_uuid');
        if (is_string($preloaded) && $preloaded !== '') {
            return $preloaded;
        }

        $uuid = Message::query()->whereKey($messageId)->value('uuid');

        return is_string($uuid) ? $uuid : null;
    }

    /**
     * Слуг категории комнаты — им она и адресуется: `/categories/{slug}`.
     *
     * Здесь стоял подъём по цепочке `parent_id` до корня: старый адрес был
     * двухсегментным, и, чтобы сослаться на комнату, надо было назвать её
     * родителя. До пяти запросов на каждую беседу в списке — ради сегмента,
     * который ничего не добавлял. Узел называет себя сам.
     */
    private function roomCategorySlug(): ?string
    {
        $slug = PostCategory::query()->whereKey($this->post_category_id)->value('slug');

        return is_string($slug) ? $slug : null;
    }

    private function canMarkSold(?User $user): bool
    {
        if (! $user || $this->type !== ConversationType::Direct || ! $this->relationLoaded('listing') || ! $this->listing) {
            return false;
        }
        if ($this->relationLoaded('activeOrdinaryDeal') && $this->activeOrdinaryDeal) {
            return false;
        }

        return (int) $this->listing->user_id === (int) $user->id
            && $this->listing->status === ListingStatus::Published
            && $this->listing->reserved_at === null;
    }
}
