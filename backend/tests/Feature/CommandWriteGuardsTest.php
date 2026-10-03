<?php

namespace Tests\Feature;

use App\Console\Concerns\GuardsDataWrites;
use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Сторож предохранителей у команд, меняющих данные руками.
 *
 * ЗАЧЕМ ИМЕННО ТЕСТ, а не запись в CLAUDE.md. Правило «массовое изменение
 * данных сначала с сухим прогоном» в проекте было с сентября, и
 * `communities:sync-owners` его всё равно не соблюдала: писала сразу, без
 * флага. Проверка, за которой никто не следит, — запись о намерении
 * (ровно это уже выяснилось с `chmod` у `config:cache`: из четырнадцати
 * вызовов правило стояло в четырёх).
 *
 * Поэтому список ниже — договорённость в исполняемом виде. Новая команда,
 * которая пишет в данные и запускается руками, добавляется в список; иначе
 * она проходит мимо предохранителя и об этом некому сказать.
 */
class CommandWriteGuardsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Команды, которые запускает человек и которые меняют данные.
     *
     * Сюда НЕ входят команды из расписания (`routes/console.php`): сухой
     * прогон по умолчанию остановил бы `posts:publish-scheduled` и двенадцать
     * её соседей молча — см. докблок `GuardsDataWrites`.
     */
    private const КОМАНДЫ_С_ПРЕДОХРАНИТЕЛЕМ = [
        'app:simulate-activity',
        'app:stress-test',
        'communities:sync-owners',
    ];

    /** Из этих запуск на боевом окружении отклоняется без оговорок. */
    private const НЕ_НА_ПРОДЕ = [
        'app:simulate-activity',
        'app:stress-test',
    ];

    public function test_перечисленные_команды_носят_предохранитель(): void
    {
        $команды = Artisan::all();

        foreach (self::КОМАНДЫ_С_ПРЕДОХРАНИТЕЛЕМ as $имя) {
            $this->assertArrayHasKey($имя, $команды, "Команда {$имя} не найдена — список устарел?");

            $traits = class_uses_recursive($команды[$имя]::class);

            $this->assertContains(
                GuardsDataWrites::class,
                $traits,
                "{$имя} меняет данные руками, но не использует GuardsDataWrites."
            );
        }
    }

    public function test_у_них_есть_force_иначе_подтверждение_нельзя_пропустить_в_скрипте(): void
    {
        foreach (self::КОМАНДЫ_С_ПРЕДОХРАНИТЕЛЕМ as $имя) {
            $this->assertTrue(
                Artisan::all()[$имя]->getDefinition()->hasOption('force'),
                "{$имя}: нет --force, команда непригодна для скрипта."
            );
        }
    }

    /** @dataProvider командыНеДляПрода */
    public function test_отказ_на_боевом_окружении(string $имя): void
    {
        $this->app->detectEnvironment(static fn (): string => 'production');

        $код = Artisan::call($имя, ['--force' => true]);

        $this->assertSame(
            1,
            $код,
            "{$имя} на APP_ENV=production должна отказаться, вернула {$код}."
        );
        $this->assertStringContainsString('не запускается на боевом окружении', Artisan::output());
    }

    public static function командыНеДляПрода(): array
    {
        return array_map(static fn (string $имя): array => [$имя], self::НЕ_НА_ПРОДЕ);
    }

    public function test_sync_owners_без_apply_ничего_не_пишет(): void
    {
        [$сообщество, $владелец] = $this->сообществоСРасхождением();

        $код = Artisan::call('communities:sync-owners');

        $this->assertSame(0, $код);
        $this->assertStringContainsString('Сухой прогон', Artisan::output());
        $this->assertNull(
            Community::query()->whereKey($сообщество->id)->value('created_by'),
            'Сухой прогон записал created_by — предохранитель не работает.'
        );
        $this->assertNotNull($владелец->id);
    }

    public function test_sync_owners_с_apply_и_force_пишет(): void
    {
        [$сообщество, $владелец] = $this->сообществоСРасхождением();

        $код = Artisan::call('communities:sync-owners', ['--apply' => true, '--force' => true]);

        $this->assertSame(0, $код);
        $this->assertSame(
            $владелец->id,
            Community::query()->whereKey($сообщество->id)->value('created_by'),
            'С --apply команда обязана выровнять created_by.'
        );
    }

    public function test_sync_owners_с_apply_но_без_force_не_пишет(): void
    {
        [$сообщество] = $this->сообществоСРасхождением();

        // Без --force и без интерактивного ввода ConfirmableTrait отвечает
        // отказом: именно это отличает «запустил осознанно» от «набрал по
        // привычке в скрипте».
        $код = Artisan::call('communities:sync-owners', ['--apply' => true]);

        $this->assertSame(1, $код);
        $this->assertNull(Community::query()->whereKey($сообщество->id)->value('created_by'));
    }

    /** @return array{0: Community, 1: User} */
    private function сообществоСРасхождением(): array
    {
        $владелец = User::factory()->create();

        $категория = CommunityCategory::query()->firstOrCreate(
            ['slug' => 'test-direction'],
            ['name' => 'Направление', 'is_active' => true, 'path' => 'test-direction', 'depth' => 0],
        );

        $сообщество = Community::query()->create([
            'category_id' => $категория->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Pending,
            'created_by' => null,
            'access_type' => 'open',
            'members_count' => 1,
        ]);

        DB::table('community_members')->insert([
            'community_id' => $сообщество->id,
            'user_id' => $владелец->id,
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        return [$сообщество, $владелец];
    }
}
