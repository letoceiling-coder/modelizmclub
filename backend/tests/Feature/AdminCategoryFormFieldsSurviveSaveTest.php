<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Каждое поле формы правки направления доживает до базы и возвращается.
 *
 * 01.10 заказчик сообщил, что правит направление и изменения не
 * применяются. Разбор пошёл по цепочке — форма, запрос, валидация,
 * запись, ответ, отрисовка — и сервер оказался ни при чём: терялось в
 * браузере, в цепочке окон (см. `lib/ui/prompt-field.ts`).
 *
 * Эта проверка закрепляет вторую половину вывода. Без неё «на сервере
 * всё цело» остаётся утверждением одного дня: добавится поле в форму и
 * не доедет до `$fillable` — и симптом вернётся, уже по настоящей
 * причине.
 *
 * Тело запроса — ровно то, что шлёт `categoryBody` в
 * `frontend/src/lib/api/admin.ts`. Поля перечислены поимённо: общий
 * `assertDatabaseHas` на массиве сказал бы «не совпало», не назвав чем.
 */
class AdminCategoryFormFieldsSurviveSaveTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    /** Поля узла: что форма шлёт → что должно лежать в базе и в ответе. */
    private const NODE_FIELDS = [
        'name' => 'Правленое направление',
        'slug' => 'pravlenoe-napravlenie',
        'icon' => 'plane',
        'sort_order' => 70,
        'is_active' => true,
        'in_feed' => false,
        'in_listings' => true,
        'in_communities' => false,
    ];

    public function test_правка_доносит_каждое_поле_до_базы_и_обратно(): void
    {
        $admin = $this->owner();
        $родитель = PostCategory::query()->create([
            'name' => 'Родитель',
            'slug' => 'roditel',
            'is_active' => true,
            'in_listings' => true,
        ]);
        /*
         * Исходное состояние — противоположность искомому по каждому полю:
         * иначе совпадение ничего не доказывает.
         *
         * Задаётся `forceFill`, а не `create`, и проверяется сразу же.
         * Через `create` подготовка шла бы тем же механизмом массового
         * присвоения, который проверка и сторожит: выпади поле из
         * `$fillable`, оно молча уехало бы в умолчание базы — и там
         * совпало бы с ожидаемым. Опыт с убранным `in_listings` дал
         * ровно это: зелено при сломанной модели.
         */
        $узел = PostCategory::query()->create(['name' => 'До правки', 'slug' => 'do-pravki']);
        $узел->forceFill([
            'parent_id' => null,
            'icon' => null,
            'sort_order' => 0,
            'is_active' => false,
            'in_feed' => true,
            'in_listings' => false,
            'in_communities' => true,
        ])->save();

        foreach (self::NODE_FIELDS as $поле => $ожидаемое) {
            $this->assertNotSame(
                $ожидаемое,
                $узел->{$поле},
                "подготовка не удалась: «{$поле}» уже равно искомому, правка ничего не докажет",
            );
        }

        $тело = self::NODE_FIELDS + [
            'parent_id' => $родитель->id,
            'listing_price_cents' => 15000,
            'subscriber_listing_price_cents' => 7000,
        ];

        $ответ = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/categories/post/{$узел->id}", $тело);

        $ответ->assertOk();
        $узел->refresh();

        foreach (self::NODE_FIELDS as $поле => $ожидаемое) {
            $this->assertSame($ожидаемое, $узел->{$поле}, "поле «{$поле}» не дошло до базы");
            $this->assertSame($ожидаемое, $ответ->json("data.{$поле}"), "поле «{$поле}» не вернулось в ответе");
        }

        $this->assertSame($родитель->id, $узел->parent_id, 'родитель не дошёл до базы');
        $this->assertSame($родитель->id, $ответ->json('data.parent_id'), 'родитель не вернулся в ответе');

        // Цены живут не в узле, а в зеркале каталога объявлений.
        $зеркало = ListingCategory::query()->find($узел->listing_category_id);
        $this->assertNotNull($зеркало, 'зеркало в объявлениях не найдено');
        $this->assertSame(15000, $зеркало->listing_price_cents, 'цена размещения не дошла');
        $this->assertSame(7000, $зеркало->subscriber_listing_price_cents, 'цена подписчика не дошла');
    }

    public function test_правка_пишется_в_аудит(): void
    {
        $admin = $this->owner();
        $узел = PostCategory::query()->create(['name' => 'До правки', 'slug' => 'do-pravki-2']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/categories/post/{$узел->id}", [
                'name' => 'После правки',
                'slug' => 'posle-pravki',
                'parent_id' => null,
                'icon' => null,
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'admin.categories.post.update',
            'auditable_id' => $узел->id,
        ]);
    }

    public function test_смена_родителя_пересчитывает_путь_и_глубину_у_потомков(): void
    {
        $admin = $this->owner();

        $корень = PostCategory::query()->create(['name' => 'Корень', 'slug' => 'koren']);
        $новыйКорень = PostCategory::query()->create(['name' => 'Новый', 'slug' => 'novyj']);

        $ветка = PostCategory::query()->create([
            'name' => 'Ветка', 'slug' => 'vetka', 'parent_id' => $корень->id,
        ]);
        $лист = PostCategory::query()->create([
            'name' => 'Лист', 'slug' => 'list', 'parent_id' => $ветка->id,
        ]);
        /*
         * `path` и `depth` считает служба таксономии, а не модель: строка,
         * заведённая напрямую, остаётся с пустым путём, и склейка
         * «путь родителя + slug» даёт у потомка голый slug. Через админку
         * такого узла не бывает — поэтому оба корня здесь синхронизируются.
         */
        $taxonomy = app(CategoryTaxonomyService::class);
        $taxonomy->syncFromPostCategory($корень->fresh());
        $taxonomy->syncFromPostCategory($новыйКорень->fresh());

        $this->assertSame('koren/vetka/list', $лист->fresh()->path, 'подготовка: путь листа');

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/categories/post/{$ветка->id}", [
                'name' => 'Ветка',
                'slug' => 'vetka',
                'parent_id' => $новыйКорень->id,
                'icon' => null,
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertOk();

        // Переехала ветка — переехал и лист под ней.
        $this->assertSame('novyj/vetka', $ветка->fresh()->path, 'путь ветки');
        $this->assertSame(1, $ветка->fresh()->depth, 'глубина ветки');
        $this->assertSame('novyj/vetka/list', $лист->fresh()->path, 'путь листа после переезда');
        $this->assertSame(2, $лист->fresh()->depth, 'глубина листа после переезда');
    }
}
