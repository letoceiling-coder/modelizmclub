<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Два инварианта доступа, у которых не было теста.
 *
 * Сверка требований 04.10 нашла их обоих со статусом «частично»: правила
 * описаны в Библии, в коде выглядят соблюдёнными, а проверки нет. Один
 * оказался настоящим дефектом, второй — нет, и разница видна только
 * замером.
 *
 * ПЕРВЫЙ — заблокированный по старому токену. Был дефектом.
 * Воспроизведено до починки: токен выдан активному — `/api/v1/auth/me`
 * отвечает 200; статус сменён на `blocked` — снова 200, токенов у
 * заблокированного осталось 1. Проверка статуса стояла только во входе
 * (`AuthService::login`, `OAuthService`), то есть блокировка закрывала
 * человеку вход и не закрывала открытую вкладку. Починка —
 * `RejectBlockedAccounts` на всю группу `api`.
 *
 * ВТОРОЙ — подмена `role`, `status`, баланса и владельца в теле запроса.
 * Дефектом не оказался, и важнее то, **чем именно** он не оказался.
 *
 * `role` и `status` перечислены в `$fillable` модели `User`, поэтому
 * первая мысль — что защита держится на `$request->validated()` в
 * контроллере. Это не так, и проверено откатом: замена `validated()` на
 * `all()` в `UpdateProfileController` ничего не ломает. Причина в том, что
 * правка профиля пишет в `UserProfile`, а у него в `$fillable` нет ни
 * роли, ни статуса, ни денег — таких колонок у таблицы вообще нет. Защита
 * здесь не в проверке, а в том, что путь от тела запроса к модели `User`
 * у пользователя отсутствует: все записи в `User` вне админки — это
 * `forceFill` с жёстко заданным списком полей.
 *
 * Единственное место, где человек подаёт тело и получает новую строку в
 * `User`, — регистрация. Поэтому проверка, которая **умеет** провалиться,
 * стоит именно там, а проверки на правке профиля и объявления остаются
 * как границы поведения: они закрепляют, что лишние ключи молча
 * игнорируются, а не применяются.
 *
 * Доказательство откатом (правило 5.1 Библии). Проверено этой ночью:
 *
 *   убрать RejectBlockedAccounts из группы api
 *     → падают три проверки: заблокированный, удалённый, обезличенный
 *   в AuthService::register взять роль и статус из тела запроса
 *     → падает test_регистрация_не_верит_роли_и_статусу_из_тела
 *
 * А вот чего откат НЕ ломает, и это записано, чтобы следующий не считал
 * проверку сильнее, чем она есть:
 *
 *   заменить validated() на all() в UpdateProfileController
 *     → все проверки остаются зелёными
 */
class AccessSurvivesTheBodyAndTheBlockTest extends TestCase
{
    use RefreshDatabase;

    private function активный(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'status' => UserStatus::Active,
            'role' => UserRole::User,
        ], $overrides));
    }

    /** Токен, выданный так же, как при обычном входе. */
    private function токен(User $user): string
    {
        return $user->createToken('проба ночи')->plainTextToken;
    }

    private function сТокеном(string $token)
    {
        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    // --- Заблокированный и удалённый ---

    public function test_заблокированный_не_действует_по_старому_токену(): void
    {
        $user = $this->активный();
        $token = $this->токен($user);

        $this->сТокеном($token)->getJson('/api/v1/auth/me')->assertOk();

        $user->forceFill(['status' => UserStatus::Blocked])->save();

        /*
         * Сброс guard'ов, иначе проверка не может провалиться правильно.
         *
         * Приложение в тесте одно на все запросы, и guard держит
         * разрешённого пользователя в памяти. Без сброса второй запрос
         * получает тот же объект со статусом `active` — и тест
         * зеленеет при сломанной починке. Первая редакция этого теста
         * падала именно так: удалённый и обезличенный отбивались, а
         * заблокированный «проходил», потому что до блокировки был
         * успешный запрос и объект остался в guard'е. В бою такого
         * кеша нет: каждый запрос разрешает токен из базы заново.
         *
         * Тот же приём стоит в SellerPhoneRevealTest по той же причине.
         */
        $this->app['auth']->forgetGuards();

        $this->сТокеном($token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Доступ к аккаунту закрыт. Обратитесь в поддержку.');
    }

    public function test_удалённый_не_действует_по_старому_токену(): void
    {
        $user = $this->активный();
        $token = $this->токен($user);

        $user->forceFill(['status' => UserStatus::Deleted])->save();

        $this->сТокеном($token)->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    /**
     * Обезличивание ставит `status = blocked` — значит закрывает и доступ.
     *
     * Проверка отдельная, потому что это другой путь к тому же состоянию:
     * статус меняет команда, а не админка, и отзыва токенов там нет.
     */
    public function test_обезличенная_учётка_закрыта_тем_же_правилом(): void
    {
        $user = $this->активный();
        $token = $this->токен($user);

        // Ровно то, что делает AnonymizeUsersCommand со статусом.
        $user->forceFill(['status' => UserStatus::Blocked->value])->save();

        $this->сТокеном($token)->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    /**
     * Неподтверждённая почта доступ не закрывает.
     *
     * Проверка существует, чтобы починка не закрыла лишнего:
     * `pending_verification` — обычный зарегистрированный, у него свои
     * ворота на отдельных действиях, а не запрет на весь API.
     */
    public function test_неподтверждённая_почта_доступ_не_закрывает(): void
    {
        $user = $this->активный(['status' => UserStatus::PendingVerification]);

        $this->сТокеном($this->токен($user))->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_гость_без_токена_получает_401_а_не_200(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    // --- Подмена полей в теле запроса ---

    public function test_подмена_роли_и_статуса_в_теле_не_проходит(): void
    {
        $user = $this->активный();

        $this->actingAs($user, 'sanctum')->patchJson('/api/v1/users/me', [
            'display_name' => 'Обычное имя',
            'role' => UserRole::Owner->value,
            'status' => UserStatus::Active->value,
            'is_qa_account' => true,
        ]);

        $user->refresh();

        $this->assertSame(UserRole::User, $user->role, 'роль поднялась через тело запроса');
        $this->assertFalse((bool) $user->is_qa_account, 'признак учётки приёмки выставился через тело');
    }

    /**
     * Баланс и бесплатные размещения — тоже поля пользователя.
     *
     * Их подмена опаснее роли: роль заметна, а приписанные себе деньги
     * расходятся по сделкам и возвращаются уже чужими.
     */
    public function test_подмена_баланса_и_льгот_в_теле_не_проходит(): void
    {
        $user = $this->активный();
        $балансДо = (int) ($user->wallet_balance_cents ?? 0);

        $this->actingAs($user, 'sanctum')->patchJson('/api/v1/users/me', [
            'display_name' => 'Имя',
            'wallet_balance_cents' => 10_000_00,
            'balance' => 10_000_00,
            'bonus_points' => 100_000,
            'free_placements' => 999,
            'subscription_not_required' => true,
        ]);

        $user->refresh();

        $this->assertSame($балансДо, (int) ($user->wallet_balance_cents ?? 0), 'баланс вырос через тело запроса');
        $this->assertSame(0, (int) ($user->bonus_points ?? 0), 'баллы начислились через тело запроса');
    }

    public function test_подмена_владельца_объявления_в_теле_не_проходит(): void
    {
        $продавец = $this->активный();
        $посторонний = $this->активный();
        $объявление = $this->объявление($продавец);

        $this->actingAs($продавец, 'sanctum')->patchJson("/api/v1/listings/{$объявление->uuid}", [
            'title' => 'Новое название',
            'user_id' => $посторонний->id,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->toISOString(),
        ]);

        $объявление->refresh();

        $this->assertSame($продавец->id, $объявление->user_id, 'объявление сменило владельца через тело запроса');
    }

    /**
     * Посторонний не правит чужое объявление даже с верным телом запроса.
     *
     * Политика на это есть и проверена отдельно; здесь проверяется, что
     * отказ приходит кодом отказа, а не кодом 200 с неизменёнными данными.
     * Разницу видно только так: «ничего не изменилось» и «отказано» для
     * клиента — разные ответы, и первое он покажет как успех.
     */
    public function test_посторонний_получает_отказ_а_не_200(): void
    {
        $продавец = $this->активный();
        $посторонний = $this->активный();
        $объявление = $this->объявление($продавец);

        $ответ = $this->actingAs($посторонний, 'sanctum')
            ->patchJson("/api/v1/listings/{$объявление->uuid}", ['title' => 'Чужими руками']);

        $this->assertContains($ответ->status(), [403, 404], 'отказ пришёл кодом '.$ответ->status());
        $this->assertNotSame(200, $ответ->status());
    }

    /**
     * Регистрация не верит роли и статусу из тела запроса.
     *
     * Единственное место, где тело запроса превращается в новую строку
     * `User`. `AuthService::register` задаёт `role` и `status` сам, но
     * оба поля есть в `$fillable`, и достаточно передать в `User::create`
     * массив из запроса, чтобы любой желающий заводил себе Владельца.
     * Эта проверка умеет провалиться — и в этом её смысл.
     */
    public function test_регистрация_не_верит_роли_и_статусу_из_тела(): void
    {
        $ответ = $this->postJson('/api/v1/auth/register', [
            'email' => 'proba-nochi@example.test',
            'password' => 'ОченьДлиннныйПароль1',
            'password_confirmation' => 'ОченьДлиннныйПароль1',
            'registration_track' => RegistrationTrack::cases()[0]->value,
            'display_name' => 'Проба Ночи',
            'accept_terms' => true,
            'accept_privacy' => true,
            // Лишнее: то, чего в правилах нет и чему верить нельзя.
            'role' => UserRole::Owner->value,
            'status' => UserStatus::Active->value,
            'is_qa_account' => true,
            'bonus_points' => 100000,
        ]);

        $this->assertContains($ответ->status(), [200, 201, 202], 'регистрация не прошла: '.$ответ->status());

        $создан = User::query()->where('email', 'proba-nochi@example.test')->firstOrFail();

        $this->assertSame(UserRole::User, $создан->role, 'регистрация выдала роль из тела запроса');
        $this->assertSame(
            UserStatus::PendingVerification,
            $создан->status,
            'регистрация выдала статус из тела запроса',
        );
        $this->assertFalse((bool) $создан->is_qa_account, 'признак учётки приёмки пришёл из тела');
        $this->assertSame(0, (int) ($создан->bonus_points ?? 0), 'баллы начислились из тела запроса');
    }

    private function объявление(User $продавец): Listing
    {
        $категория = ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'engines-'.Str::random(6),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $title = 'Пропеллер '.Str::random(6);

        return Listing::create([
            'user_id' => $продавец->id,
            'category_id' => $категория->id,
            'title' => $title,
            'slug' => Str::slug($title),
            'description' => 'Описание',
            'price_cents' => 120_00,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }
}
