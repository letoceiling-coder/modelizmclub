<?php

namespace Modules\Billing\Services;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\SafeDeal;
use Illuminate\Support\Facades\Log;
use Modules\Chat\Services\ChatService;

/**
 * The chat that belongs to a safe deal.
 *
 * A deal chat is opened together with the deal itself (so buyer and seller can
 * talk before anyone has written a word) and narrates the deal's lifecycle
 * through authorless system messages. Membership alone grants access — no
 * subscription gate, because both sides already paid into the escrow.
 */
class SafeDealChatService
{
    public function __construct(private readonly ChatService $chat) {}

    /**
     * The deal's chat, created on first call. Idempotent: a deal keeps the one
     * conversation it was opened with for its whole life.
     */
    public function ensureConversation(SafeDeal $deal): ?Conversation
    {
        if ($deal->conversation_id !== null) {
            $existing = Conversation::query()->find($deal->conversation_id);
            if ($existing) {
                return $existing;
            }
        }

        $buyerId = (int) $deal->buyer_id;
        $sellerId = (int) $deal->seller_id;

        if ($buyerId <= 0 || $sellerId <= 0 || $buyerId === $sellerId) {
            return null;
        }

        $conversation = Conversation::create([
            'type' => ConversationType::Deal,
            'listing_id' => $deal->listing_id,
            'title' => $this->title($deal),
            'last_message_at' => now(),
            'settings' => ['deal_status' => $deal->status->value],
        ]);

        foreach ([$buyerId, $sellerId] as $userId) {
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $userId,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        $deal->forceFill(['conversation_id' => $conversation->id])->save();

        $this->chat->postSystemMessage(
            $conversation,
            "Сделка №{$this->number($deal)} создана. Статус: {$deal->status->label()}.",
        );

        return $conversation;
    }

    /**
     * Narrate the deal's current status in its chat.
     *
     * Called from every escrow log entry; the conversation remembers the last
     * announced status, so book-keeping entries that move no status (the
     * platform commission, a registered checkout) stay silent.
     */
    public function announceStatus(SafeDeal $deal, string $note = ''): void
    {
        try {
            $conversation = $this->ensureConversation($deal);

            if ($conversation === null) {
                return;
            }

            $settings = $conversation->settings ?? [];
            $status = $deal->status->value;

            if (($settings['deal_status'] ?? null) === $status) {
                return;
            }

            $conversation->forceFill([
                'settings' => array_merge($settings, ['deal_status' => $status]),
            ])->save();

            $body = "Сделка №{$this->number($deal)} — {$deal->status->label()}.";
            if ($note !== '') {
                $body .= ' '.$note;
            }

            $this->chat->postSystemMessage($conversation, $body);
        } catch (\Throwable $e) {
            // A chat notice must never be the reason a deal fails.
            Log::warning('SafeDeal: chat status notice failed', [
                'deal' => $deal->uuid,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /** Short, human-quotable deal number — the head of its uuid. */
    private function number(SafeDeal $deal): string
    {
        return mb_substr((string) $deal->uuid, 0, 8);
    }

    private function title(SafeDeal $deal): string
    {
        $listingTitle = trim((string) ($deal->listing?->title ?? ''));

        return $listingTitle !== ''
            ? 'Сделка: '.mb_substr($listingTitle, 0, 120)
            : 'Безопасная сделка';
    }
}
