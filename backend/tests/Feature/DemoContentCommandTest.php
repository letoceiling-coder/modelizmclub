<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\Post;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * `demo:content` — перепись показательного содержимого и два действия над ним.
 *
 * Задание владельца 05.10: «Составь список по признаку, чем они отличаются
 * от настоящих. Скрой из публичной выдачи существующим механизмом. Ничего
 * не удаляй: подготовь команду очистки с режимом пробного прогона».
 *
 * Отсюда три свойства, которые надо сторожить, и каждое проверяется здесь:
 *
 * 1. **Пробный прогон ничего не меняет.** Иначе «посмотреть, что будет»
 *    становится «сделать».
 * 2. **Скрытие ничего не удаляет.** Строки остаются, меняется состояние —
 *    то же, которым пользуется модерация.
 * 3. **Настоящее содержимое не задето.** Признак у каждой таблицы свой, и
 *    ошибка в нём стоила бы чужих данных.
 */
class DemoContentCommandTest extends TestCase
{
    use RefreshDatabase;

    private function раздел(): ListingCategory
    {
        return ListingCategory::query()->create([
            'name' => 'Проверочный раздел',
            'slug' => 'proverochnyy-razdel',
            'is_active' => true,
            'depth' => 0,
            'sort_order' => 0,
        ]);
    }

    private function учётка(string $почта): User
    {
        return User::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => $почта,
            'email' => $почта,
            'password' => bcrypt('secret'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function запись(User $автор): Post
    {
        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $автор->id,
            'title' => 'Запись',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
        ]);
    }

    private function завестиПоказательные(): array
    {
        $демо = $this->учётка('demo@modelizmclub.ru');
        $человек = $this->учётка('zhivoy@example.com');

        $показательная = $this->запись($демо);
        $настоящая = $this->запись($человек);

        return [$показательная, $настоящая, $демо, $человек];
    }

    public function test_перепись_ничего_не_меняет(): void
    {
        [$показательная, $настоящая] = $this->завестиПоказательные();

        $this->artisan('demo:content')->assertSuccessful();

        $this->assertSame(ContentStatus::Published, $показательная->fresh()->status);
        $this->assertSame(ContentStatus::Published, $настоящая->fresh()->status);
    }

    public function test_пробный_прогон_скрытия_ничего_не_меняет(): void
    {
        [$показательная] = $this->завестиПоказательные();

        $this->artisan('demo:content --hide --dry-run')->assertSuccessful();

        $this->assertSame(ContentStatus::Published, $показательная->fresh()->status);
    }

    public function test_пробный_прогон_удаления_ничего_не_удаляет(): void
    {
        [$показательная] = $this->завестиПоказательные();

        $this->artisan('demo:content --purge --dry-run')->assertSuccessful();

        /*
         * Проверяем `deleted_at`, а не `fresh() !== null`.
         *
         * `Post` удаляется мягко, а `Model::fresh()` строит запрос через
         * `newQueryWithoutScopes()` — то есть обходит область видимости
         * мягкого удаления и возвращает строку, которая уже помечена
         * удалённой. Утверждение «строка на месте» на этом проходило и
         * тогда, когда пробный прогон действительно удалял: проверено
         * откатом, оно не покраснело.
         */
        $this->assertNull($показательная->fresh()->deleted_at, 'пробный прогон не должен удалять');
    }

    public function test_скрытие_меняет_состояние_и_ничего_не_удаляет(): void
    {
        [$показательная] = $this->завестиПоказательные();

        $this->artisan('demo:content --hide')->assertSuccessful();

        $свежая = $показательная->fresh();
        $this->assertNotNull($свежая, 'скрытие не должно удалять строку');
        $this->assertSame(ContentStatus::Hidden, $свежая->status);
    }

    public function test_настоящая_запись_не_затронута(): void
    {
        [, $настоящая] = $this->завестиПоказательные();

        $this->artisan('demo:content --hide')->assertSuccessful();

        $this->assertSame(ContentStatus::Published, $настоящая->fresh()->status);
    }

    public function test_объявление_уходит_в_снято_с_публикации(): void
    {
        $демо = $this->учётка('demo@modelizmclub.ru');
        $объявление = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $демо->id,
            'category_id' => $this->раздел()->id,
            'title' => 'Лот',
            'slug' => 'lot-'.Str::random(8),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
        ]);

        $this->artisan('demo:content --hide')->assertSuccessful();

        // У перечисления объявлений значения `hidden` нет — отсюда
        // `Unpublished`, а не «придумать новое состояние».
        $this->assertSame(ListingStatus::Unpublished, $объявление->fresh()->status);
    }

    public function test_hide_и_purge_вместе_отвергаются(): void
    {
        $this->artisan('demo:content --hide --purge')->assertFailed();
    }
}
