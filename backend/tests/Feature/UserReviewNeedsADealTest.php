<?php

namespace Tests\Feature;

use App\Enums\SafeDealStatus;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserReview;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Policies\PolicyFixtures;
use Tests\TestCase;

/**
 * Отзыв без сделки невозможен на уровне базы, а наследные строки убраны.
 *
 * Приёмка 27.09 нашла в `user_reviews` две строки без сделки — обе от
 * одной учётки об одном человеке. Пара (сделка, автор) объявлена
 * уникальной, но в Postgres NULL не равен NULL, и пустая сделка защиту
 * обходит: вторая строка легла рядом с первой без возражений.
 *
 * Проверки в политике, сервисе и модели уже стояли — и через API такую
 * строку действительно не завести. Мимо них ходит прямая запись в
 * таблицу: `creating` у модели на `DB::table()->insert()` не срабатывает.
 * Этим путём строки и появились, им же закрывается дыра в уникальности.
 *
 * Отдельно проверяется пересчёт `user_profiles.reviews_count`: чтения
 * наследные отзывы отфильтровывали давно, а денормализованный счётчик
 * остался прежним — у обезличенной 1230 в профиле стояло 3 отзыва при
 * одном настоящем.
 */
class UserReviewNeedsADealTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    private const МИГРАЦИЯ = 'database/migrations/2026_09_27_100000_user_reviews_require_a_completed_deal.php';

    /** Строка в обход модели — так появились обе наследные. */
    private function сырьём(User $author, User $target, ?int $dealId): void
    {
        DB::table('user_reviews')->insert([
            'uuid' => (string) Str::uuid(),
            'author_id' => $author->id,
            'target_user_id' => $target->id,
            'safe_deal_id' => $dealId,
            'rating' => 5,
            'text' => 'наследство',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_база_не_принимает_отзыв_без_сделки(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');

        $this->expectException(QueryException::class);
        $this->сырьём($buyer, $seller, null);
    }

    /**
     * Уникальность пары начинает работать: раньше она молчала на NULL.
     */
    public function test_второй_отзыв_по_той_же_сделке_отбивает_база(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        $this->сырьём($buyer, $seller, (int) $deal->id);

        $this->expectException(QueryException::class);
        $this->сырьём($buyer, $seller, (int) $deal->id);
    }

    /**
     * Наследные строки уходят, настоящие остаются, счётчик сходится.
     *
     * Проверка идёт по самой миграции: колонке возвращается NULL, в
     * таблицу кладётся ровно то, что нашла приёмка, и миграция
     * проигрывается заново.
     */
    public function test_миграция_убирает_отзывы_без_сделки_и_пересчитывает_счётчик(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        $настоящий = UserReview::query()->create([
            'uuid' => (string) Str::uuid(),
            'author_id' => $buyer->id,
            'target_user_id' => $seller->id,
            'safe_deal_id' => $deal->id,
            'rating' => 4,
            'text' => 'по сделке',
        ]);

        DB::statement('alter table user_reviews alter column safe_deal_id drop not null');

        // Две строки одного автора об одном человеке — то, что на проде.
        $чужой = $this->seedUser('legacy');
        $this->сырьём($чужой, $seller, null);
        $this->сырьём($чужой, $seller, null);

        $this->assertSame(3, UserReview::query()->count(), 'без NOT NULL обе строки ложатся рядом');

        // Счётчик, оставшийся от старого правила.
        UserProfile::query()->where('user_id', $seller->id)->update(['reviews_count' => 3, 'rating_score' => 5]);

        $миграция = require base_path(self::МИГРАЦИЯ);
        $миграция->up();

        $this->assertSame(
            [$настоящий->id],
            UserReview::query()->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all(),
            'уйти должны только строки без сделки',
        );

        $профиль = UserProfile::query()->where('user_id', $seller->id)->first();
        $this->assertSame(1, (int) $профиль->reviews_count, 'счётчик обязан сойтись с тем, что видно в списке');
        $this->assertSame(4.0, (float) $профиль->rating_score, 'средняя считается по оставшемуся отзыву');

        // И колонка снова закрыта.
        $this->expectException(QueryException::class);
        $this->сырьём($чужой, $seller, null);
    }

    /**
     * Удаление сделки уносит отзыв, а не обнуляет ссылку.
     *
     * Внешний ключ стоял на `null on delete`; с `NOT NULL` это стало бы
     * отказом базы посреди удаления сделки.
     */
    public function test_удаление_сделки_уносит_отзыв_с_собой(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Completed);

        UserReview::query()->create([
            'uuid' => (string) Str::uuid(),
            'author_id' => $buyer->id,
            'target_user_id' => $seller->id,
            'safe_deal_id' => $deal->id,
            'rating' => 5,
        ]);

        DB::table('safe_deals')->where('id', $deal->id)->delete();

        $this->assertSame(0, UserReview::query()->count());
    }
}
