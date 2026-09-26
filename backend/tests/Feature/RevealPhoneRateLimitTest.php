<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Раскрытие номера отбивается при сборе, но не мешает покупателю.
 *
 * Приёмка 27.09 замерила: шестнадцать раскрытий за полчаса с одной учётки и
 * ни одного отказа. Номер отдаётся по одному запросу, значит собрать телефоны
 * всего каталога — это цикл по списку объявлений. След оставался
 * (`listing_phone_reveals`), но заметить можно было только задним числом.
 *
 * Проверяется поведение, а не наличие лимитера: до шестого запроса в минуту
 * номер отдаётся, на шестом приходит 429.
 */
class RevealPhoneRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private function продавец(): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => '+79990001234',
            'phone_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Продавец',
            'slug' => 'prodavec-'.$user->id,
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private static int $счётчик = 0;

    private function покупатель(): User
    {
        // Телефон уникален в базе — каждому покупателю свой.
        self::$счётчик++;

        return User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => sprintf('+7999000%04d', 5000 + self::$счётчик),
            'phone_verified_at' => now(),
        ]);
    }

    /** @return list<Listing> */
    private function объявления(User $seller, int $сколько): array
    {
        $category = ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'motors-reveal-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $out = [];
        for ($i = 0; $i < $сколько; $i++) {
            $out[] = Listing::create([
                'user_id' => $seller->id,
                'category_id' => $category->id,
                'title' => "Объявление {$i}",
                'slug' => 'obyavlenie-'.uniqid(),
                'description' => 'Описание',
                'price_cents' => 100_00,
                'status' => ListingStatus::Published,
                'published_at' => now(),
                'contact_via_messenger' => false,
            ]);
        }

        return $out;
    }

    public function test_шестое_раскрытие_в_минуту_отбивается(): void
    {
        $seller = $this->продавец();
        $buyer = $this->покупатель();
        $listings = $this->объявления($seller, 7);

        $коды = [];

        foreach ($listings as $i => $listing) {
            $ответ = $this->actingAs($buyer, 'sanctum')
                ->postJson("/api/v1/listings/{$listing->uuid}/reveal-phone");
            $коды[] = $ответ->getStatusCode();
        }

        $первыеПять = array_slice($коды, 0, 5);
        $шестой = $коды[5] ?? null;

        $this->assertSame(
            [200, 200, 200, 200, 200],
            $первыеПять,
            'первые пять раскрытий должны проходить: покупатель сравнивает объявления. Получено: '
            .implode(', ', $коды),
        );
        $this->assertSame(
            429,
            $шестой,
            'шестое раскрытие в ту же минуту должно отбиваться — именно так собирают номера',
        );
    }

    /**
     * Ключ по пользователю, а не по адресу: иначе один сборщик в офисе
     * закрывает раскрытие всем остальным за тем же адресом.
     */
    public function test_отказ_одному_не_мешает_другому(): void
    {
        $seller = $this->продавец();
        $первый = $this->покупатель();
        $второй = $this->покупатель();
        $listings = $this->объявления($seller, 7);

        foreach ($listings as $listing) {
            $this->actingAs($первый, 'sanctum')
                ->postJson("/api/v1/listings/{$listing->uuid}/reveal-phone");
        }

        $ответ = $this->actingAs($второй, 'sanctum')
            ->postJson("/api/v1/listings/{$listings[0]->uuid}/reveal-phone");

        $this->assertSame(
            200,
            $ответ->getStatusCode(),
            'второму покупателю отказ первого мешать не должен',
        );
    }
}
