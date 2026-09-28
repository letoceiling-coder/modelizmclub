<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * График на сводке показывает настоящие регистрации, а не выдуманные числа.
 *
 * До 28.09 ряда не существовало: страница рисовала семь столбиков по
 * зашитому в код массиву `[40, 65, 55, 80, 70, 90, 60]` с подписями
 * «пн…вс». График не показывал ничего и никогда не менялся — заметить это
 * по виду было нельзя, столбики выглядели правдоподобно.
 *
 * Две вещи проверяются особо, потому что обе уже стоили этому проекту
 * ошибок: пояс (колонки времени хранят московское стенное время, и перевод
 * сдвинул бы сутки на три часа) и пустые дни (группировка возвращает только
 * те, где кто-то был).
 */
class AdminDashboardChartTest extends TestCase
{
    use RefreshDatabase;

    private function человек(string $имя, ?string $когда = null, UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'name' => $имя,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        if ($когда !== null) {
            $user->forceFill(['created_at' => $когда])->save();
        }

        return $user->fresh();
    }

    /** @return list<array{date: string, count: int}> */
    private function ряд(User $owner): array
    {
        return $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->json('data.registrations_daily');
    }

    public function test_ряд_ровно_на_тридцать_дней_и_кончается_сегодня(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);

        $ряд = $this->ряд($owner);

        $this->assertCount(30, $ряд, 'просили тридцать дней, а не последнюю неделю');
        $this->assertSame(now()->toDateString(), $ряд[29]['date'], 'последний день — сегодня');
        $this->assertSame(
            now()->startOfDay()->subDays(29)->toDateString(),
            $ряд[0]['date'],
            'первый день — двадцать девять дней назад',
        );

        // Даты идут подряд, без пропусков.
        foreach ($ряд as $i => $точка) {
            $this->assertSame(
                now()->startOfDay()->subDays(29 - $i)->toDateString(),
                $точка['date'],
                "день {$i} не на своём месте",
            );
        }
    }

    /**
     * День без регистраций — ноль, а не отсутствие точки.
     *
     * Группировка по дате возвращает только дни, где кто-то был. Отдать их
     * как есть значило бы показать двадцать столбиков вместо тридцати и
     * молча соврать про даты между ними.
     */
    public function test_пустой_день_приходит_нулём(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);
        $this->человек('Вчерашний', now()->subDay()->setTime(12, 0)->toDateTimeString());

        $ряд = collect($this->ряд($owner))->keyBy('date');

        $вчера = now()->subDay()->toDateString();
        $позавчера = now()->subDays(2)->toDateString();

        $this->assertSame(1, $ряд[$вчера]['count']);
        $this->assertArrayHasKey($позавчера, $ряд->all(), 'пустой день обязан быть в ряду');
        $this->assertSame(0, $ряд[$позавчера]['count'], 'и обязан быть нулём, а не пропуском');
    }

    public function test_регистрации_считаются_по_дням(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);

        $this->человек('Первый', now()->subDays(3)->setTime(9, 0)->toDateTimeString());
        $this->человек('Второй', now()->subDays(3)->setTime(21, 30)->toDateTimeString());
        $this->человек('Третий', now()->subDays(5)->setTime(10, 0)->toDateTimeString());

        $ряд = collect($this->ряд($owner))->keyBy('date');

        $this->assertSame(2, $ряд[now()->subDays(3)->toDateString()]['count']);
        $this->assertSame(1, $ряд[now()->subDays(5)->toDateString()]['count']);
    }

    /**
     * Поздний вечер остаётся своим днём.
     *
     * Колонки времени объявлены `timestamp without time zone`, и Laravel
     * пишет в них московское стенное время. Любой перевод пояса сдвинул бы
     * регистрацию в 23:30 на следующие сутки — и столбик уехал бы на день.
     * Ровно эта ловушка уже стоила проекту разбора 08.09.
     */
    public function test_поздний_вечер_не_уезжает_на_следующий_день(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);

        $день = now()->subDays(4)->toDateString();
        $this->человек('Поздний', now()->subDays(4)->setTime(23, 30)->toDateTimeString());
        $this->человек('Ранний', now()->subDays(4)->setTime(0, 15)->toDateTimeString());

        $ряд = collect($this->ряд($owner))->keyBy('date');

        $this->assertSame(2, $ряд[$день]['count'], 'и 00:15, и 23:30 — один и тот же день');
        $this->assertSame(0, $ряд[now()->subDays(3)->toDateString()]['count']);
    }

    /**
     * Что старше тридцати дней, в ряд не попадает.
     *
     * Иначе первый столбик копил бы в себе всю историю и был бы выше
     * остальных всегда.
     */
    public function test_старое_в_ряд_не_попадает(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);
        $this->человек('Древний', now()->subDays(45)->toDateTimeString());

        $сумма = collect($this->ряд($owner))->sum('count');

        // В ряду только Владелец, созданный сегодня.
        $this->assertSame(1, $сумма);
    }

    /**
     * Удалённая учётка из истории не исчезает.
     *
     * Регистрация — исторический факт: она не отменяется тем, что человек
     * потом ушёл. Иначе вчерашний столбик уменьшался бы задним числом, и
     * сводка расходилась бы сама с собой от захода к заходу.
     */
    public function test_удалённая_учётка_остаётся_в_истории(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);
        $ушедший = $this->человек('Ушедший', now()->subDays(2)->setTime(12, 0)->toDateTimeString());

        $день = now()->subDays(2)->toDateString();
        $this->assertSame(1, collect($this->ряд($owner))->keyBy('date')[$день]['count']);

        $ушедший->delete();

        $this->assertSame(
            1,
            collect($this->ряд($owner))->keyBy('date')[$день]['count'],
            'столбик не должен уменьшаться задним числом',
        );
    }
}
