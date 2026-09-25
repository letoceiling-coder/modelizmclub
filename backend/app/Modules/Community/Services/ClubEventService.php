<?php

namespace Modules\Community\Services;

use App\Models\ClubEvent;
use App\Models\Community;
use App\Models\Media;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Community\Jobs\SendClubEventNotificationsJob;

/**
 * Мероприятия: создание, правка, отмена, удаление, участие, напоминания.
 *
 * Права проверяет EventPolicy в контроллерах; здесь — правила самой сущности:
 * лимит предстоящих событий у сообщества, идемпотентная отметка «пойду»,
 * уведомления после записи в базу.
 */
class ClubEventService
{
    /** Поля, которые пишет форма (API и админка). */
    private const EDITABLE = ['title', 'description', 'starts_at', 'location_name', 'latitude', 'longitude'];

    /** @param  array<string, mixed>  $data */
    public function create(?Community $community, User $actor, array $data): ClubEvent
    {
        $status = $data['status'] ?? ClubEvent::STATUS_PUBLISHED;

        return DB::transaction(function () use ($community, $actor, $data, $status): ClubEvent {
            if ($community !== null && $status === ClubEvent::STATUS_PUBLISHED) {
                $this->assertUnderLimit($community);
            }

            $event = ClubEvent::query()->create([
                'scope' => $community ? ClubEvent::SCOPE_COMMUNITY : ClubEvent::SCOPE_PLATFORM,
                'status' => $status,
                'community_id' => $community?->id,
                'created_by' => $actor->id,
                ...$this->fields($data),
                'cover_media_id' => $this->mediaId($data['cover_media_uuid'] ?? null),
            ]);

            if ($status === ClubEvent::STATUS_PUBLISHED) {
                SendClubEventNotificationsJob::dispatch($event->id, SendClubEventNotificationsJob::PUBLISHED)->afterCommit();
            }

            return $event;
        });
    }

    /** @param  array<string, mixed>  $data */
    public function update(ClubEvent $event, array $data): ClubEvent
    {
        return DB::transaction(function () use ($event, $data): ClubEvent {
            $wasDraft = $event->status === ClubEvent::STATUS_DRAFT;
            $startsBefore = $event->starts_at?->toIso8601String();

            $updates = $this->fields($data);
            if (array_key_exists('cover_media_uuid', $data)) {
                $updates['cover_media_id'] = $this->mediaId($data['cover_media_uuid']);
            }
            if (isset($data['status']) && in_array($data['status'], [ClubEvent::STATUS_DRAFT, ClubEvent::STATUS_PUBLISHED], true)) {
                $updates['status'] = $data['status'];
            }

            $publishing = $wasDraft && ($updates['status'] ?? null) === ClubEvent::STATUS_PUBLISHED;
            if ($publishing && $event->community) {
                $this->assertUnderLimit($event->community, $event->id);
            }

            $event->fill($updates);
            // Перенесли начало — напоминание за сутки должно уйти заново.
            if ($event->isDirty('starts_at') && $startsBefore !== $event->starts_at?->toIso8601String()) {
                $event->reminder_sent_at = null;
            }
            $event->save();

            if ($publishing) {
                SendClubEventNotificationsJob::dispatch($event->id, SendClubEventNotificationsJob::PUBLISHED)->afterCommit();
            }

            return $event;
        });
    }

    public function cancel(ClubEvent $event, ?string $reason = null): ClubEvent
    {
        if ($event->status === ClubEvent::STATUS_CANCELLED) {
            return $event;
        }

        $wasPublished = $event->status === ClubEvent::STATUS_PUBLISHED;
        $event->forceFill([
            'status' => ClubEvent::STATUS_CANCELLED,
            'cancelled_at' => now(),
            'cancel_reason' => $reason !== null && trim($reason) !== '' ? mb_substr(trim($reason), 0, 255) : null,
        ])->save();

        if ($wasPublished && ! $event->isPast()) {
            SendClubEventNotificationsJob::dispatch($event->id, SendClubEventNotificationsJob::CANCELLED)->afterCommit();
        }

        return $event;
    }

    /** Удалить: предстоящее опубликованное сначала отменяется — отметившиеся узнают. */
    public function delete(ClubEvent $event): void
    {
        DB::transaction(function () use ($event): void {
            if ($event->status === ClubEvent::STATUS_PUBLISHED && ! $event->isPast()) {
                $this->cancel($event, 'Мероприятие удалено организатором.');
            }
            $event->delete();
        });
    }

    /**
     * «Пойду» — идемпотентно: повторный запрос не снимает отметку.
     * В открытое сообщество человек вступает тем же действием.
     *
     * @return array{going: bool, joined: bool}
     */
    public function attend(ClubEvent $event, User $user): array
    {
        return DB::transaction(function () use ($event, $user): array {
            $joined = false;
            $community = $event->community;
            if ($community && ! $community->isOwnedBy($user) && ! $community->members()->where('users.id', $user->id)->exists()) {
                if (! $community->isOpen()) {
                    throw ValidationException::withMessages([
                        'event' => ['Отметиться могут участники сообщества — сначала вступите.'],
                    ]);
                }
                $result = app(CommunityHubService::class)->requestOrJoin($community, $user);
                $joined = ($result['status'] ?? null) === 'member';
            }

            $event->attendees()->syncWithoutDetaching([$user->id]);

            return ['going' => true, 'joined' => $joined];
        });
    }

    public function unattend(ClubEvent $event, User $user): void
    {
        $event->attendees()->detach($user->id);
    }

    public function listForCommunity(Community $community, string $when, int $perPage, bool $withDrafts): LengthAwarePaginator
    {
        $query = ClubEvent::query()->where('community_id', $community->id);

        return $this->applyWhen($query, $when, $withDrafts)->paginate($perPage);
    }

    public function listPlatform(string $when, int $perPage): LengthAwarePaginator
    {
        $query = ClubEvent::query()->where('scope', ClubEvent::SCOPE_PLATFORM);

        return $this->applyWhen($query, $when, false)->paginate($perPage);
    }

    public function attendees(ClubEvent $event, int $perPage): LengthAwarePaginator
    {
        return $event->attendees()
            ->with('profile.avatar')
            ->orderByDesc('club_event_attendees.created_at')
            ->paginate($perPage);
    }

    /** Напоминание за сутки: один раз на событие, пока не перенесли начало. */
    public function dispatchReminders(): int
    {
        $count = 0;
        ClubEvent::query()
            ->where('status', ClubEvent::STATUS_PUBLISHED)
            ->whereNull('reminder_sent_at')
            ->where('starts_at', '>', now())
            ->where('starts_at', '<=', now()->addDay())
            ->orderBy('id')
            ->each(function (ClubEvent $event) use (&$count): void {
                $event->forceFill(['reminder_sent_at' => now()])->save();
                SendClubEventNotificationsJob::dispatch($event->id, SendClubEventNotificationsJob::REMINDER);
                $count++;
            });

        return $count;
    }

    /** Не чаще раза в такой срок: кнопка не должна превращаться в рассылку. */
    public const MANUAL_REMINDER_COOLDOWN_HOURS = 6;

    /**
     * Напомнить по кнопке организатора.
     *
     * `reminder_sent_at` не трогаем: им помечено автоматическое
     * напоминание за сутки. Запиши мы туда — организатор, напомнивший за
     * пять дней, отменил бы участникам напоминание накануне, то есть
     * самое нужное.
     *
     * Отказ возвращается словами, а не молчанием: человек нажал кнопку и
     * ждёт ответа.
     *
     * @return array{sent: bool, reason: ?string, next_at: ?string}
     */
    public function remindNow(ClubEvent $event): array
    {
        if ($event->status !== ClubEvent::STATUS_PUBLISHED || $event->trashed()) {
            return ['sent' => false, 'reason' => 'not_published', 'next_at' => null];
        }
        if ($event->isPast()) {
            return ['sent' => false, 'reason' => 'past', 'next_at' => null];
        }
        if ($event->attendees()->count() === 0) {
            return ['sent' => false, 'reason' => 'no_attendees', 'next_at' => null];
        }

        /*
         * Выдержка берётся одним условным UPDATE, а не проверкой и записью
         * по отдельности. Два запроса в один момент — две вкладки, два
         * модератора сообщества, повтор после таймаута сети — иначе оба
         * видят пустую колонку, и рассылка уходит дважды.
         *
         * Напомнили внутри суточного окна — помечаем и автоматическое:
         * иначе ежечасный сторож через полчаса пришлёт то же самое второй
         * раз. Вне окна `reminder_sent_at` не трогаем, ради чего колонки и
         * разведены.
         */
        $граница = now()->copy()->subHours(self::MANUAL_REMINDER_COOLDOWN_HOURS);
        $пометки = ['manual_reminder_at' => now()];
        if ($event->starts_at !== null && $event->starts_at->lte(now()->addDay())) {
            $пометки['reminder_sent_at'] = now();
        }

        $взяли = ClubEvent::query()
            ->whereKey($event->id)
            ->where(fn ($q) => $q->whereNull('manual_reminder_at')->orWhere('manual_reminder_at', '<=', $граница))
            ->update($пометки);

        $event->refresh();

        if ($взяли === 0) {
            $когдаМожно = $event->manual_reminder_at?->copy()->addHours(self::MANUAL_REMINDER_COOLDOWN_HOURS);

            return ['sent' => false, 'reason' => 'too_soon', 'next_at' => $когдаМожно?->toIso8601String()];
        }

        SendClubEventNotificationsJob::dispatch($event->id, SendClubEventNotificationsJob::REMINDER)->afterCommit();

        return ['sent' => true, 'reason' => null, 'next_at' => now()->addHours(self::MANUAL_REMINDER_COOLDOWN_HOURS)->toIso8601String()];
    }

    /** Ночная задача: события удалённых сообществ отменяются, отметившиеся узнают. */
    public function cancelForDeletedCommunities(): int
    {
        $count = 0;
        ClubEvent::query()
            ->where('scope', ClubEvent::SCOPE_COMMUNITY)
            ->whereIn('status', [ClubEvent::STATUS_DRAFT, ClubEvent::STATUS_PUBLISHED])
            ->whereHas('community', fn (Builder $q) => $q->onlyTrashed())
            ->orderBy('id')
            ->each(function (ClubEvent $event) use (&$count): void {
                $this->cancel($event, 'Сообщество удалено.');
                $count++;
            });

        return $count;
    }

    /** @return array<string, mixed> */
    private function fields(array $data): array
    {
        $out = [];
        foreach (self::EDITABLE as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }
            $value = $data[$key];
            $out[$key] = match ($key) {
                'title' => trim((string) $value),
                'description' => $this->nullableString($value, 4000),
                'location_name' => $this->nullableString($value, 255),
                'latitude', 'longitude' => $value === null || $value === '' ? null : (float) $value,
                default => $value,
            };
        }

        return $out;
    }

    private function applyWhen(Builder $query, string $when, bool $withDrafts): Builder
    {
        return match ($when) {
            'past' => $query->where('starts_at', '<', now())
                ->whereIn('status', [ClubEvent::STATUS_PUBLISHED, ClubEvent::STATUS_CANCELLED])
                ->orderByDesc('starts_at'),
            'all' => $query->when(! $withDrafts, fn ($q) => $q->where('status', '!=', ClubEvent::STATUS_DRAFT))
                ->orderByDesc('starts_at'),
            default => $query->where('starts_at', '>=', now())
                ->whereIn('status', $withDrafts
                    ? [ClubEvent::STATUS_DRAFT, ClubEvent::STATUS_PUBLISHED, ClubEvent::STATUS_CANCELLED]
                    : [ClubEvent::STATUS_PUBLISHED, ClubEvent::STATUS_CANCELLED])
                ->orderBy('starts_at'),
        };
    }

    private function assertUnderLimit(Community $community, ?int $exceptId = null): void
    {
        $upcoming = ClubEvent::query()
            ->where('community_id', $community->id)
            ->upcoming()
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->count();

        if ($upcoming >= ClubEvent::COMMUNITY_UPCOMING_LIMIT) {
            throw ValidationException::withMessages([
                'starts_at' => ['У сообщества уже '.ClubEvent::COMMUNITY_UPCOMING_LIMIT.' предстоящих мероприятий — это предел. Отмените или дождитесь прошедших.'],
            ]);
        }
    }

    private function mediaId(mixed $uuid): ?int
    {
        if (! is_string($uuid) || $uuid === '') {
            return null;
        }

        return Media::query()->where('uuid', $uuid)->value('id');
    }

    private function nullableString(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_substr($trimmed, 0, $max);
    }
}
