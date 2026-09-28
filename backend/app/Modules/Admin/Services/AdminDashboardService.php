<?php

namespace Modules\Admin\Services;

use App\Models\Banner;
use App\Models\Community;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\Promocode;
use App\Models\Report;
use App\Models\SubscriptionPlan;
use App\Models\User;

class AdminDashboardService
{
    public function stats(): array
    {
        return [
            'users_total' => User::query()->count(),
            'posts_total' => Post::query()->count(),
            'communities_total' => Community::query()->count(),
            'moderation_pending' => ModerationQueue::query()->where('status', 'pending')->count(),
            'reports_pending' => Report::query()->where('status', 'pending')->count(),
            'plans_active' => SubscriptionPlan::query()->where('is_active', true)->count(),
            'promocodes_active' => Promocode::query()->where('is_active', true)->count(),
            'banners_active' => Banner::query()->where('is_active', true)->count(),
            'registrations_daily' => $this->registrationsDaily(),
        ];
    }

    /**
     * Регистрации по дням — ряд для графика на сводке.
     *
     * ДО 28.09 РЯДА НЕ БЫЛО ВОВСЕ. График на сводке рисовал семь столбиков по
     * зашитому в код массиву `[40, 65, 55, 80, 70, 90, 60]` с подписями
     * «пн…вс»: он не показывал ничего и никогда не менялся.
     *
     * ПОЯС НЕ ПЕРЕВОДИТСЯ, И ЭТО НАРОЧНО. `APP_TIMEZONE=Europe/Moscow`, а
     * колонки времени объявлены `timestamp without time zone` — Laravel пишет
     * в них московское стенное время. Значит `created_at::date` уже даёт
     * московскую дату, а любое `at time zone` здесь сдвинуло бы сутки на три
     * часа. Разбор этой ловушки — в CLAUDE.md, на ней 08.09 чуть не родился
     * несуществующий дефект.
     *
     * УДАЛЁННЫЕ УЧЁТКИ СЧИТАЮТСЯ (`withTrashed`). Вопрос графика —
     * «сколько человек зарегистрировалось в этот день», а это исторический
     * факт: он не меняется от того, что человек потом ушёл. Без этого
     * вчерашний столбик уменьшался бы задним числом, и сводка расходилась
     * бы сама с собой от захода к заходу.
     *
     * ПУСТЫЕ ДНИ ЗАПОЛНЯЮТСЯ НУЛЁМ. Группировка возвращает только дни, где
     * кто-то зарегистрировался; отдать их как есть значило бы показать
     * двадцать столбиков вместо тридцати и молча соврать про даты между ними.
     *
     * @return list<array{date: string, count: int}>
     */
    private function registrationsDaily(int $дней = 30): array
    {
        $первый = now()->startOfDay()->subDays($дней - 1);

        $поДням = User::query()
            ->withTrashed()
            ->where('created_at', '>=', $первый)
            ->selectRaw('date(created_at) as день, count(*) as сколько')
            ->groupBy('день')
            ->pluck('сколько', 'день');

        $ряд = [];
        for ($i = 0; $i < $дней; $i++) {
            $день = $первый->copy()->addDays($i)->toDateString();
            $ряд[] = [
                'date' => $день,
                'count' => (int) ($поДням[$день] ?? 0),
            ];
        }

        return $ряд;
    }
}
