<?php

namespace Modules\Listing\Services;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Enums\OrdinaryDealStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Listing;
use App\Models\Message;
use App\Models\OrdinaryDeal;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Modules\Chat\Services\ChatService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Обычная сделка: продавец отмечает в переписке, что продал лот собеседнику.
 *
 * Отметка ставится только там, где о лоте действительно говорили: в личном
 * чате двух людей, куда объявление попало карточкой или с которого чат был
 * начат. Иначе продавец мог бы записать в покупатели кого угодно.
 * Покупатель такую запись может отклонить, продавец — снять; в обоих
 * случаях лот возвращается в продажу.
 */
class OrdinaryDealService
{
    public function __construct(private readonly ChatService $chat) {}

    public function markSold(User $seller, string $conversationUuid, ?string $listingUuid = null): OrdinaryDeal
    {
        $conversation = Conversation::query()->where('uuid', $conversationUuid)->first();
        if (! $conversation || ! $this->isActiveParticipant($conversation, $seller)) {
            throw new NotFoundHttpException('Диалог не найден.');
        }
        if ($conversation->type !== ConversationType::Direct) {
            throw ValidationException::withMessages(['conversation' => ['Отметить продажу можно только в личной переписке.']]);
        }

        $listing = $listingUuid
            ? Listing::query()->where('uuid', $listingUuid)->first()
            : ($conversation->listing_id ? Listing::query()->find($conversation->listing_id) : null);
        if (! $listing) {
            throw ValidationException::withMessages(['listing' => ['В этой переписке нет объявления.']]);
        }
        if ((int) $listing->user_id !== (int) $seller->id) {
            throw ValidationException::withMessages(['listing' => ['Отметить продажу может только автор объявления.']]);
        }
        if (! $this->listingDiscussedIn($conversation, $listing)) {
            throw ValidationException::withMessages(['listing' => ['Об этом объявлении в переписке не говорили.']]);
        }
        if ($listing->status !== ListingStatus::Published) {
            throw ValidationException::withMessages(['listing' => ['Отметить продажу можно только у опубликованного объявления.']]);
        }
        if ($listing->reserved_at !== null) {
            throw ValidationException::withMessages(['listing' => ['Объявление забронировано безопасной сделкой.']]);
        }

        $buyer = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $seller->id)
            ->whereNull('left_at')
            ->with('user')
            ->first()?->user;
        if (! $buyer) {
            throw ValidationException::withMessages(['conversation' => ['Собеседник покинул переписку.']]);
        }

        $deal = DB::transaction(function () use ($listing, $seller, $buyer, $conversation): OrdinaryDeal {
            $locked = Listing::query()->whereKey($listing->id)->lockForUpdate()->first();
            if ($locked->status !== ListingStatus::Published
                || OrdinaryDeal::query()->where('listing_id', $locked->id)->where('status', OrdinaryDealStatus::Active)->exists()) {
                throw ValidationException::withMessages(['listing' => ['Объявление уже отмечено проданным.']]);
            }

            $deal = OrdinaryDeal::query()->create([
                'listing_id' => $locked->id,
                'seller_id' => $seller->id,
                'buyer_id' => $buyer->id,
                'conversation_id' => $conversation->id,
                'amount_kopecks' => (int) $locked->price_cents,
                'status' => OrdinaryDealStatus::Active,
            ]);

            $locked->forceFill(['status' => ListingStatus::Sold, 'sold_at' => now()])->save();

            return $deal;
        });

        $this->narrate($conversation, "Продавец отметил: «{$listing->title}» продано.");
        $this->notify($buyer, 'Продавец отметил продажу', "«{$listing->title}» — в разделе «Сделки». Если вы не покупали, отклоните отметку.", '/deals?type=ordinary&role=buyer');

        return $deal->load(['listing.mediaItems.media', 'seller.profile.avatar', 'buyer.profile.avatar', 'conversation']);
    }

    public function decline(User $buyer, string $dealUuid): OrdinaryDeal
    {
        $deal = $this->findActive($dealUuid);
        if ((int) $deal->buyer_id !== (int) $buyer->id) {
            throw new NotFoundHttpException('Сделка не найдена.');
        }

        $this->close($deal, OrdinaryDealStatus::Declined, 'declined_at');
        $this->narrate($deal->conversation, "Покупатель не подтвердил покупку «{$deal->listing?->title}». Объявление снова в продаже.");
        $this->notify($deal->seller, 'Покупатель не подтвердил покупку', "«{$deal->listing?->title}» снова в продаже.", '/deals?type=ordinary&role=seller');

        return $deal->refresh();
    }

    public function cancel(User $seller, string $dealUuid): OrdinaryDeal
    {
        $deal = $this->findActive($dealUuid);
        if ((int) $deal->seller_id !== (int) $seller->id) {
            throw new NotFoundHttpException('Сделка не найдена.');
        }

        $this->close($deal, OrdinaryDealStatus::Cancelled, 'cancelled_at');
        $this->narrate($deal->conversation, "Продавец снял отметку о продаже «{$deal->listing?->title}». Объявление снова в продаже.");

        return $deal->refresh();
    }

    /** @return array<string, mixed> */
    public function toArray(OrdinaryDeal $deal, User $viewer): array
    {
        $isBuyer = (int) $deal->buyer_id === (int) $viewer->id;
        $counterpart = $isBuyer ? $deal->seller : $deal->buyer;
        $active = $deal->status === OrdinaryDealStatus::Active;
        $media = $deal->listing?->mediaItems?->first()?->media;
        $variants = $media?->publicVariantUrls() ?? [];

        return [
            'type' => 'ordinary',
            'uuid' => $deal->uuid,
            'role' => $isBuyer ? 'buyer' : 'seller',
            'status' => $deal->status->value,
            'status_label' => $deal->status->label(),
            'listing_uuid' => $deal->listing?->uuid,
            'listing_title' => $deal->listing?->title,
            // Та же цепочка вариантов, что у карточки объявления в чате.
            'listing_image' => $variants['thumb']['webp'] ?? $variants['thumb']['jpeg'] ?? $media?->url,
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'counterpart' => $counterpart ? [
                'id' => (int) $counterpart->id,
                'name' => $counterpart->profile?->display_name ?? $counterpart->name,
            ] : null,
            'conversation_uuid' => $deal->conversation?->uuid,
            'created_at' => $deal->created_at?->toIso8601String(),
            'can' => [
                'decline' => $active && $isBuyer,
                'cancel' => $active && ! $isBuyer,
            ],
        ];
    }

    private function findActive(string $uuid): OrdinaryDeal
    {
        $deal = OrdinaryDeal::query()->where('uuid', $uuid)->with(['listing', 'seller', 'buyer', 'conversation'])->first();
        if (! $deal) {
            throw new NotFoundHttpException('Сделка не найдена.');
        }
        if ($deal->status !== OrdinaryDealStatus::Active) {
            throw ValidationException::withMessages(['deal' => ['Отметка о продаже уже снята.']]);
        }

        return $deal;
    }

    private function close(OrdinaryDeal $deal, OrdinaryDealStatus $status, string $stampColumn): void
    {
        DB::transaction(function () use ($deal, $status, $stampColumn): void {
            $deal->forceFill(['status' => $status, $stampColumn => now()])->save();

            // Лот возвращается в продажу, только если его продажей была эта
            // отметка: объявление могли за это время снять или удалить.
            $listing = Listing::query()->whereKey($deal->listing_id)->lockForUpdate()->first();
            if ($listing && $listing->status === ListingStatus::Sold && $listing->reserved_at === null) {
                $listing->forceFill(['status' => ListingStatus::Published, 'sold_at' => null])->save();
            }
        });
    }

    private function listingDiscussedIn(Conversation $conversation, Listing $listing): bool
    {
        return (int) $conversation->listing_id === (int) $listing->id
            || Message::query()
                ->where('conversation_id', $conversation->id)
                ->where('listing_id', $listing->id)
                ->whereNull('deleted_at')
                ->exists();
    }

    private function isActiveParticipant(Conversation $conversation, User $user): bool
    {
        return ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }

    private function narrate(?Conversation $conversation, string $body): void
    {
        if (! $conversation) {
            return;
        }
        try {
            $this->chat->postSystemMessage($conversation, $body);
        } catch (\Throwable $e) {
            // Запись о сделке уже сохранена — строка в чате не должна её отменять.
            Log::warning('OrdinaryDeal: chat notice failed', ['conversation' => $conversation->uuid, 'exception' => $e->getMessage()]);
        }
    }

    private function notify(?User $user, string $title, string $body, string $link): void
    {
        if (! $user) {
            return;
        }
        InAppNotify::sendQuiet($user, new InAppNotification(type: 'deal', title: $title, body: $body, link: $link));
    }
}
