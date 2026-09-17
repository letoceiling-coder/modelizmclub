<?php

namespace Modules\Admin\Http\Resources;

use App\Models\ChannelApplication;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\Listing;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/** @mixin ModerationQueue */
class ModerationQueueResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'queue' => $this->queue,
            'status' => $this->status,
            'priority' => $this->priority,
            'moderatable_type' => class_basename($this->moderatable_type),
            'moderatable_id' => $this->moderatable_id,
            'moderatable' => $this->whenLoaded('moderatable', fn () => $this->formatModeratable()),
            'assigned_to' => $this->whenLoaded('assignee', fn () => [
                'uuid' => $this->assignee?->uuid,
                'name' => $this->assignee?->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function formatModeratable(): ?array
    {
        $model = $this->moderatable;

        if ($model === null) {
            return null;
        }

        if ($model instanceof CommunityApplication || $model instanceof ChannelApplication) {
            return $this->formatApplication($model);
        }

        if ($model instanceof ChannelPost) {
            $model->loadMissing(['author.profile', 'channel']);

            return [
                'uuid' => $model->uuid,
                'title' => Str::limit(trim($model->text), 80, '…') ?: 'Пост канала',
                'text' => $model->text,
                'body' => $model->text,
                'author' => [
                    'display_name' => $model->author?->profile?->display_name ?? $model->author?->name ?? '',
                ],
                'category' => [
                    'name' => $model->channel?->name ?? 'Канал',
                ],
                'channel' => [
                    'name' => $model->channel?->name ?? '',
                    'slug' => $model->channel?->slug ?? null,
                ],
                'submitted_at' => $model->created_at?->toIso8601String(),
                'media' => [],
            ];
        }

        if ($model instanceof Community) {
            $model->loadMissing(['category', 'creator.profile']);

            return [
                'uuid' => $model->uuid,
                'slug' => $model->slug,
                'name' => $model->name,
                'title' => $model->name,
                'description' => $model->description,
                'body' => $model->description,
                'author' => [
                    'display_name' => $model->creator?->profile?->display_name ?? $model->creator?->name ?? '',
                ],
                'category' => [
                    'name' => $model->category?->name ?? 'Сообщество',
                ],
                'submitted_at' => $model->created_at?->toIso8601String(),
                'media' => [],
            ];
        }

        if ($model instanceof Post) {
            $model->loadMissing(['author.profile', 'category', 'mediaItems.media']);

            return [
                'uuid' => $model->uuid,
                'title' => $model->title,
                'body' => $model->body,
                'author' => [
                    'display_name' => $model->author?->profile?->display_name ?? $model->author?->name ?? '',
                ],
                'category' => [
                    'name' => $model->category?->name ?? '',
                ],
                'submitted_at' => $model->created_at?->toIso8601String(),
                'media' => $this->mapMedia($model->mediaItems),
            ];
        }

        if ($model instanceof Video) {
            $model->loadMissing(['uploader.profile', 'category']);

            return [
                'uuid' => $model->uuid,
                'title' => $model->title,
                'description' => $model->description,
                'body' => $model->description,
                'author' => [
                    'display_name' => $model->uploader?->profile?->display_name ?? $model->uploader?->name ?? '',
                ],
                'category' => [
                    'name' => $model->category?->name ?? '',
                ],
                'submitted_at' => $model->created_at?->toIso8601String(),
                'media' => [],
            ];
        }

        if ($model instanceof Listing) {
            $model->loadMissing(['author.profile', 'category', 'mediaItems.media']);

            return [
                'uuid' => $model->uuid,
                'title' => $model->title,
                'description' => $model->description,
                'body' => $model->description,
                'price_cents' => $model->price_cents,
                'author' => [
                    'display_name' => $model->author?->profile?->display_name ?? $model->author?->name ?? '',
                ],
                'category' => [
                    'name' => $model->category?->name ?? '',
                ],
                'submitted_at' => $model->created_at?->toIso8601String(),
                'media' => $this->mapMedia($model->mediaItems),
            ];
        }

        return [
            'uuid' => $model->uuid ?? null,
            'title' => $model->title ?? $model->name ?? null,
        ];
    }

    /**
     * Заявка на сообщество или канал.
     *
     * uuid у заявок нет — решение адресуется номером заявки, и он отдаётся
     * отдельным полем `application_id`, чтобы его не спутали с номером строки
     * очереди. В `details` — то, что заявитель заполнил сверх названия и
     * описания: по одному названию решать нечего.
     *
     * @return array<string, mixed>
     */
    private function formatApplication(CommunityApplication|ChannelApplication $model): array
    {
        $isChannel = $model instanceof ChannelApplication;
        $model->loadMissing($isChannel ? ['user.profile'] : ['user.profile', 'category']);
        $applicant = $model->user;

        $details = [];
        if ($isChannel) {
            $details[] = ['label' => 'Адрес', 'value' => $model->proposed_slug];
            $details[] = ['label' => 'Тип канала', 'value' => $model->proposed_kind];
            $details[] = ['label' => 'Комментарии', 'value' => $model->comments_enabled ? 'включены' : 'выключены'];
        } else {
            $payload = is_array($model->payload) ? $model->payload : [];
            $contacts = is_array($payload['contacts'] ?? null) ? array_filter($payload['contacts']) : [];
            $details[] = ['label' => 'Своя тематика', 'value' => $payload['custom_category'] ?? null];
            $details[] = [
                'label' => 'Вступление',
                'value' => isset($payload['access_type'])
                    ? ($payload['access_type'] === 'request' ? 'по заявке' : 'открытое')
                    : null,
            ];
            $details[] = ['label' => 'Правила', 'value' => $payload['rules'] ?? null];
            $details[] = ['label' => 'Контакты', 'value' => $contacts !== [] ? implode(', ', $contacts) : null];
        }

        return [
            'uuid' => null,
            'application_id' => $model->id,
            'kind' => $isChannel ? 'channel' : 'community',
            'title' => $model->proposed_name,
            'name' => $model->proposed_name,
            'description' => $model->description,
            'body' => $model->description ?? '',
            'author' => [
                'display_name' => $applicant?->profile?->display_name ?? $applicant?->name ?? '',
                'uuid' => $applicant?->uuid,
                'slug' => $applicant?->profile?->slug,
            ],
            'category' => [
                'name' => $isChannel ? ($model->category ?? '') : ($model->category?->name ?? ''),
            ],
            'details' => array_values(array_filter(
                $details,
                fn (array $row): bool => $row['value'] !== null && $row['value'] !== '',
            )),
            'submitted_at' => $model->created_at?->toIso8601String(),
            'media' => [],
        ];
    }

    /** @param iterable<int, object{media?: object|null}> $items
     * @return list<array{url: string, mime_type: string|null}>
     */
    private function mapMedia(iterable $items): array
    {
        $out = [];
        foreach ($items as $item) {
            $media = $item->media ?? null;
            if ($media === null || ! $media->url) {
                continue;
            }
            $out[] = [
                'url' => $media->url,
                'mime_type' => $media->mime_type ?? null,
            ];
            if (count($out) >= 4) {
                break;
            }
        }

        return $out;
    }
}
