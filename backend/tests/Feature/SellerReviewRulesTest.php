<?php

namespace Tests\Feature;

use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserReview;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\User\Services\UserRatingService;
use Tests\Feature\Policies\PolicyFixtures;
use Tests\TestCase;

/**
 * Отзыв продавцу: только покупатель, только по завершённой сделке с этим
 * продавцом, один раз, не самому себе (правило заказчика, 17.09).
 *
 * До 17.09 оценить мог любой участник: `SafeDealPolicy::review` смотрел на
 * `involves()`, и на проде у продавца 1230 по завершённым сделкам стоял
 * `can_review: true` — он мог оценить покупателя. Проверка серверная:
 * политика, сервис и сама модель, а не скрытая кнопка.
 */
class SellerReviewRulesTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    private function review(User $author, SafeDeal $deal, int $rating = 5)
    {
        return $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/review", ['rating' => $rating, 'text' => 'Отзыв']);
    }

    /** Строка в обход модели — так выглядят данные, записанные до правила или чужим путём. */
    private function rawReview(User $author, User $target, ?SafeDeal $deal): string
    {
        $uuid = (string) Str::uuid();
        DB::table('user_reviews')->insert([
            'uuid' => $uuid,
            'author_id' => $author->id,
            'target_user_id' => $target->id,
            'safe_deal_id' => $deal?->id,
            'rating' => 1,
            'text' => 'в обход',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $uuid;
    }

    public function test_buyer_reviews_a_completed_deal_once(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        $this->review($buyer, $deal)->assertCreated();
        $this->review($buyer, $deal)
            ->assertForbidden()
            ->assertJsonPath('message', 'Вы уже оставили оценку по этой сделке.');

        $this->assertSame(1, UserReview::query()->count());
        $this->assertSame((int) $seller->id, (int) UserReview::query()->value('target_user_id'));
    }

    public function test_seller_cannot_review_the_buyer(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false)
            ->assertJsonPath('data.can.review', false);

        $this->review($seller, $deal)->assertForbidden();
        $this->assertSame(0, UserReview::query()->count());
    }

    public function test_review_is_refused_for_every_status_but_completed(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');

        foreach (SafeDealStatus::cases() as $status) {
            if ($status === SafeDealStatus::Completed) {
                continue;
            }
            $deal = $this->seedDeal($buyer, $seller, $status);

            $this->actingAs($buyer, 'sanctum')
                ->getJson("/api/v1/safe-deals/{$deal->uuid}")
                ->assertJsonPath('data.can_review', false);
            $this->review($buyer, $deal)->assertForbidden();
        }

        $this->assertSame(0, UserReview::query()->count());
    }

    public function test_model_refuses_a_review_outside_a_completed_deal_bought_by_the_author(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $completed = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);
        $paid = $this->seedDeal($buyer, $seller, SafeDealStatus::Paid);

        $attempts = [
            'без сделки' => [$buyer, $seller, null],
            'сделка не завершена' => [$buyer, $seller, $paid],
            'пишет продавец' => [$seller, $buyer, $completed],
            'самому себе' => [$buyer, $buyer, $completed],
            'не тому продавцу' => [$buyer, $this->seedUser('other'), $completed],
        ];

        foreach ($attempts as $label => [$author, $target, $deal]) {
            try {
                UserReview::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'author_id' => $author->id,
                    'target_user_id' => $target->id,
                    'safe_deal_id' => $deal?->id,
                    'rating' => 5,
                ]);
                $this->fail("отзыв создан: {$label}");
            } catch (\DomainException) {
                // ожидаемо
            }
        }

        $this->assertSame(0, UserReview::query()->count());
    }

    public function test_rating_and_list_count_only_buyer_reviews_of_completed_deals(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $completed = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        // Продавец о покупателе — по старому правилу такое проходило.
        $this->rawReview($seller, $buyer, $completed);

        $this->assertSame(0, app(UserRatingService::class)->aggregate($buyer->id)['count']);
        $this->getJson("/api/v1/users/{$buyer->id}/reviews")->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_reply_is_refused_for_a_review_that_does_not_count(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $cancelled = $this->seedDeal($buyer, $seller, SafeDealStatus::Cancelled);
        $uuid = $this->rawReview($buyer, $seller, $cancelled);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/users/me/reviews/{$uuid}/reply", ['reply' => 'Ответ'])
            ->assertNotFound();
    }

    public function test_review_list_links_the_author_profile(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);
        $this->review($buyer, $deal)->assertCreated();

        $this->getJson("/api/v1/users/{$seller->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.0.author.id', (int) $buyer->id)
            ->assertJsonPath('data.0.author.uuid', $buyer->uuid)
            ->assertJsonPath('data.0.author.slug', $buyer->profile->slug);
    }
}
