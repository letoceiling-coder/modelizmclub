<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Платёж, выпавший из окна сверки, не остаётся невидимым.
 *
 * `payments:reconcile-pending` в расписании получает `--newer-than=1440`, то
 * есть смотрит только платежи моложе суток. Верхняя граница там не лишняя:
 * опрашивать банк про старые заказы незачем, а песочница ВТБ 08.09 отсекла
 * залп из сорока семи запросов. Но следствие у неё такое: платёж, доживший до
 * суток в `pending`, выпадает из внимания навсегда.
 *
 * Замерено на проде 03.10 — четыре таких висят с 11–12 августа, пятьдесят два
 * дня, и за полтора месяца о них не сказал ни один отчёт.
 *
 * Здесь проверяются две вещи, и обе про границу, а не про деньги: что сверка
 * действительно пропускает старое (иначе чинить нечего) и что отбор, по
 * которому их показывает проверка выкатки, находит ровно их.
 */
class StalePaymentsAreSeenTest extends TestCase
{
    use RefreshDatabase;

    private function платёж(int $минутНазад, string $статус = 'pending'): Payment
    {
        $платёж = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory()->create(['status' => UserStatus::Active])->id,
            'provider' => 'vtb',
            'status' => $статус,
            'amount_cents' => 49900,
            'currency' => 'RUB',
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'half'],
        ]);

        // Время правим запросом: `created_at` при создании ставит модель.
        Payment::query()->whereKey($платёж->id)->update(['created_at' => now()->subMinutes($минутНазад)]);

        return $платёж->fresh();
    }

    /** Отбор проверки выкатки — то же условие, что в `check-stale-payments.sh`. */
    private function выпавшиеИзОкна(int $окно): \Illuminate\Support\Collection
    {
        return Payment::query()
            ->where('status', 'pending')
            ->where('created_at', '<', now()->subMinutes($окно))
            ->get();
    }

    public function test_сверка_в_расписании_старое_не_берёт(): void
    {
        /*
         * Спрашивается сама команда, а не копия её отбора: копия доказывала бы
         * только то, что я дважды написал одно и то же условие.
         *
         * Сверяется число, которое команда печатает сама, а не наличие `id` в
         * выводе: `id` — короткое целое, и «1» находится подстрокой в «1440» и
         * «1000». На этом я уже ошибся здесь же.
         */
        $this->платёж(60 * 24 * 52);
        $this->платёж(60);

        $вОкне = $this->сколькоВзяла($this->прогонСверки(['--older-than' => 10, '--newer-than' => 1440]));
        $безОкна = $this->сколькоВзяла($this->прогонСверки(['--older-than' => 10, '--newer-than' => 0]));

        $this->assertSame(1, $вОкне, 'с окном сутки сверка должна взять только свежий платёж');
        $this->assertSame(2, $безОкна, 'без верхней границы сверка берёт оба — значит старый отсекается окном');
    }

    /** Сколько платежей сверка взяла в разбор — по её собственному отчёту. */
    private function сколькоВзяла(string $вывод): int
    {
        if (str_contains($вывод, 'Висящих платежей нет')) {
            return 0;
        }

        if (preg_match('/:\s*(\d+)\s+платёж\(ей\)\s+в\s+pending/u', $вывод, $m) !== 1) {
            $this->fail('не разобрал отчёт сверки — мерить нечем: '.mb_substr($вывод, 0, 200));
        }

        return (int) $m[1];
    }

    /** Сухой прогон сверки с заданным окном; возвращает её вывод. */
    private function прогонСверки(array $доводы): string
    {
        // Без `--apply`: в банк не ходим, нужен только отбор.
        Artisan::call('payments:reconcile-pending', $доводы + ['--provider' => 'vtb']);

        return Artisan::output();
    }

    public function test_отбор_находит_ровно_выпавшие(): void
    {
        $старый = $this->платёж(60 * 24 * 52);
        $свежий = $this->платёж(30);
        $оплаченныйСтарый = $this->платёж(60 * 24 * 52, 'paid');
        $отказанныйСтарый = $this->платёж(60 * 24 * 52, 'failed');

        $нашлись = $this->выпавшиеИзОкна(1440)->pluck('id');

        $this->assertTrue($нашлись->contains($старый->id), 'выпавший из окна не найден');
        $this->assertFalse($нашлись->contains($свежий->id), 'свежий попал в список выпавших');
        $this->assertFalse($нашлись->contains($оплаченныйСтарый->id), 'оплаченный не висит');
        $this->assertFalse($нашлись->contains($отказанныйСтарый->id), 'отказанный не висит');
        $this->assertCount(1, $нашлись);
    }

    public function test_без_выпавших_отбор_пуст(): void
    {
        $this->платёж(30);

        $this->assertCount(0, $this->выпавшиеИзОкна(1440));
    }
}
