<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Человек без подтверждённого телефона пользуется сервисом. Решение З2.
 *
 * Это пункт 3 части Б промпта 02: тот же список, что проверяется запросами к
 * серверу. Четыре жалобы владельца от 09.10 звучали так — «мессенджер не
 * работает», «сообщество посмотреть нельзя», «окно всплывает постоянно», «код
 * не той длины». Первые две проверяются здесь; про окно — сторож во фронтенде
 * (`gate.test.ts`), про длину — `SmsCodeLengthIsOneTruthTest`.
 *
 * Отдельно от `PhoneRequiredOnlyWhereDecidedTest`: там проверяется **список**
 * маршрутов, здесь — **поведение**. Список можно привести в порядок и всё
 * равно оставить отказ в контроллере, как он и стоял до 09.10 в мессенджере.
 */
class WithoutPhoneTheServiceWorksTest extends TestCase
{
    use RefreshDatabase;

    private function безТелефона(string $имя): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => $имя.'-'.$user->id,
        ]);

        return $user;
    }

    /** @return array<string, string> */
    private function токен(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
    }

    public function test_читает_ленту_сообщества_каналы_и_свои_беседы(): void
    {
        $человек = $this->безТелефона('reader');
        $токен = $this->токен($человек);

        foreach ([
            'лента' => '/api/v1/feed',
            'сообщества' => '/api/v1/communities',
            'каналы' => '/api/v1/channels',
            'беседы' => '/api/v1/conversations',
            'объявления' => '/api/v1/listings',
            'уведомления' => '/api/v1/users/me/notifications',
        ] as $что => $url) {
            $ответ = $this->getJson($url, $токен);
            $this->assertNotSame(
                403,
                $ответ->status(),
                $что.' ('.$url.') закрыты без телефона: '.$ответ->getContent(),
            );
        }
    }

    public function test_пишет_другу_без_подтверждённого_телефона(): void
    {
        $один = $this->безТелефона('one');
        $другой = $this->безТелефона('two');

        /*
         * Дружба — прежнее требование личной переписки, и телефон к нему не
         * относится. Заводим её прямо в таблице: путь через заявку проверяют
         * свои тесты, а здесь надо убедиться, что упирается ли человек именно
         * в телефон.
         *
         * Две строки, а не одна: дружба считается подтверждённой, когда обе
         * стороны записаны (см. `ConversationPolicy`).
         */
        DB::table('user_friendships')->insert([
            ['user_id' => $один->id, 'friend_id' => $другой->id, 'created_at' => now()],
            ['user_id' => $другой->id, 'friend_id' => $один->id, 'created_at' => now()],
        ]);

        $беседа = $this->postJson('/api/v1/conversations', [
            'user_id' => $другой->id,
        ], $this->токен($один));

        $беседа->assertStatus(201);
        $uuid = $беседа->json('data.uuid');

        $this->postJson('/api/v1/conversations/'.$uuid.'/messages', [
            'body' => 'Привет, это проверка решения З2.',
        ], $this->токен($один))->assertStatus(201);
    }

    public function test_публикация_объявления_отказывает_понятно(): void
    {
        $продавец = $this->безТелефона('seller');
        $category = ListingCategory::firstOrCreate(
            ['slug' => 'parts'],
            ['name' => 'Запчасти', 'sort_order' => 1, 'depth' => 0, 'is_active' => true],
        );

        $ответ = $this->postJson('/api/v1/listings', [
            'category_id' => $category->id,
            'title' => 'Модель самолёта',
            'description' => 'Проверка требования телефона.',
            'price' => 1000,
            'condition' => 'new',
        ], $this->токен($продавец));

        $ответ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');

        $this->assertStringContainsString(
            'Подтвердите номер телефона',
            (string) $ответ->json('message'),
            'отказ должен называть, что именно сделать',
        );
    }

    public function test_публикация_черновика_тоже_просит_телефон(): void
    {
        $продавец = $this->безТелефона('seller2');
        $category = ListingCategory::firstOrCreate(
            ['slug' => 'parts'],
            ['name' => 'Запчасти', 'sort_order' => 1, 'depth' => 0, 'is_active' => true],
        );
        $черновик = Listing::create([
            'user_id' => $продавец->id,
            'category_id' => $category->id,
            'title' => 'Черновик',
            'slug' => 'draft-'.uniqid(),
            'description' => 'Проверка',
            'price_cents' => 100_000,
            'currency' => 'RUB',
            'status' => ListingStatus::Draft,
        ]);

        $this->postJson('/api/v1/listings/'.$черновик->uuid.'/publish', [], $this->токен($продавец))
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');
    }

    public function test_вывод_средств_отказывает_понятно(): void
    {
        $человек = $this->безТелефона('payee');

        $this->postJson('/api/v1/wallet/withdraw', ['amount' => 500], $this->токен($человек))
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');
    }
}
