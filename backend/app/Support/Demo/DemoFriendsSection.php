<?php

namespace App\Support\Demo;

use App\Enums\FriendRequestStatus;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\User\Services\FriendService;

/**
 * Связи между демо-людьми: друзья и заявки в ожидании.
 *
 * ЗАЧЕМ НЕРАВНОМЕРНО. Список друзей, счётчик в профиле и блок рекомендаций
 * ведут себя по-разному на нуле, на пятерых и на полутора десятках. Ровный
 * состав, где у всех одинаково, показывает ровно одно из этих состояний и
 * прячет два остальных. Здесь: первая треть состава — «общительные» (от пяти
 * до пятнадцати друзей), вторая — по два-три, последняя треть — ноль.
 *
 * ЗАЯВКИ В ОЖИДАНИИ нужны отдельно: входящая заявка меняет вид чужого
 * профиля и добавляет пункт в уведомления. Их восемь, все — к людям из
 * «одиноких», чтобы входящие было видно на пустом списке друзей.
 *
 * ЧЕРЕЗ СЕРВИС, А НЕ ВСТАВКАМИ. `FriendService` не только пишет строку: он
 * взаимно подписывает людей друг на друга и гасит встречные заявки. Прямая
 * вставка в `friend_requests` дала бы дружбу без подписки — состояние,
 * которого у живых людей не бывает, и проверка ленты на нём врала бы.
 */
class DemoFriendsSection extends DemoSection
{
    public function __construct(private readonly FriendService $friends) {}

    /** Сколько друзей у кого — по позиции в составе. */
    private const SOCIAL = 12;

    private const MODEST = 12;

    private const PENDING = 8;

    public function key(): string
    {
        return 'friends';
    }

    public function title(): string
    {
        return 'Дружба';
    }

    public function columns(): array
    {
        return ['группа', 'связей', 'уже есть'];
    }

    public function plan(): array
    {
        $pairs = $this->pairs();
        $requests = $this->pendingPairs();
        $existing = $this->existingPairs();

        $newPairs = array_values(array_filter($pairs, fn (array $p): bool => ! isset($existing[$this->key2($p)])));
        $newRequests = array_values(array_filter($requests, fn (array $p): bool => ! isset($existing[$this->key2($p)])));

        return [
            'rows' => [
                ['дружба', count($pairs), count($pairs) - count($newPairs)],
                ['заявки в ожидании', count($requests), count($requests) - count($newRequests)],
            ],
            'create' => count($newPairs) + count($newRequests),
            'exists' => (count($pairs) - count($newPairs)) + (count($requests) - count($newRequests)),
        ];
    }

    public function create(callable $tick): int
    {
        $people = $this->people();
        $existing = $this->existingPairs();
        $made = 0;

        foreach ($this->pairs() as $pair) {
            if (isset($existing[$this->key2($pair)])) {
                continue;
            }
            [$a, $b] = $this->resolve($pair, $people);
            if (! $a || ! $b) {
                continue;
            }

            $request = $this->friends->sendRequest($a, $b);
            $this->friends->acceptRequest($b, $request);
            $made++;
            $tick("{$a->name} — {$b->name}");
        }

        foreach ($this->pendingPairs() as $pair) {
            if (isset($existing[$this->key2($pair)])) {
                continue;
            }
            [$a, $b] = $this->resolve($pair, $people);
            if (! $a || ! $b) {
                continue;
            }

            $this->friends->sendRequest($a, $b);
            $made++;
            $tick("заявка {$a->name} → {$b->name}");
        }

        return $made;
    }

    /**
     * Пары, которые станут друзьями.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function pairs(): array
    {
        $roster = DemoPeople::roster();
        $pairs = [];
        $seen = [];

        foreach ($roster as $i => $person) {
            if ($i >= self::SOCIAL + self::MODEST) {
                break; // последняя треть остаётся без друзей — это тоже состояние
            }

            $count = $i < self::SOCIAL ? $this->rand('friends-'.$person['local'], 5, 15) : $this->rand('few-'.$person['local'], 2, 3);

            for ($k = 1; $k <= $count; $k++) {
                // Партнёр берётся из первых двух третей: у «одиноких» друзей нет.
                $j = ($i + $k * 3 + 1) % (self::SOCIAL + self::MODEST);
                if ($j === $i) {
                    continue;
                }
                $pair = [$person['local'], $roster[$j]['local']];
                sort($pair);
                $key = $pair[0].'|'.$pair[1];
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $pairs[] = [$pair[0], $pair[1]];
            }
        }

        return $pairs;
    }

    /**
     * Заявки, которые останутся необработанными.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function pendingPairs(): array
    {
        $roster = DemoPeople::roster();
        $lonely = array_slice($roster, self::SOCIAL + self::MODEST);
        $pairs = [];

        foreach (array_slice($lonely, 0, self::PENDING) as $n => $person) {
            $from = $roster[$n]['local'];
            $pairs[] = [$from, $person['local']];
        }

        return $pairs;
    }

    /** @return array<string, true> */
    private function existingPairs(): array
    {
        $ids = User::query()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('email', 'id')->all();
        if ($ids === []) {
            return [];
        }

        $localById = [];
        foreach ($ids as $id => $email) {
            $localById[$id] = explode('@', (string) $email)[0];
        }

        $out = [];
        $rows = DB::table('friend_requests')
            ->whereIn('from_user_id', array_keys($localById))
            ->whereIn('to_user_id', array_keys($localById))
            ->whereIn('status', [FriendRequestStatus::Pending->value, FriendRequestStatus::Accepted->value])
            ->get(['from_user_id', 'to_user_id']);

        foreach ($rows as $row) {
            $pair = [$localById[$row->from_user_id] ?? '', $localById[$row->to_user_id] ?? ''];
            sort($pair);
            $out[$pair[0].'|'.$pair[1]] = true;
        }

        return $out;
    }

    /** @param array{0: string, 1: string} $pair */
    private function key2(array $pair): string
    {
        $sorted = $pair;
        sort($sorted);

        return $sorted[0].'|'.$sorted[1];
    }

    /**
     * @param  array{0: string, 1: string}  $pair
     * @param  array<string, User>  $people
     * @return array{0: ?User, 1: ?User}
     */
    private function resolve(array $pair, array $people): array
    {
        return [$people[$pair[0]] ?? null, $people[$pair[1]] ?? null];
    }
}
