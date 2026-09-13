<?php

namespace Modules\Community\Support;

use App\Models\ClubEvent;

/**
 * Правила формы мероприятия — одни для сообщества, площадки и админки.
 * Сообщения — по-русски: форма показывает их под полями как есть.
 */
final class ClubEventRules
{
    /** @return array<string, list<string>> */
    public static function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:4000'],
            // Прошлое нельзя назначить и при правке: прошедшее событие не переносят в прошлое ещё раз.
            'starts_at' => [$required, 'date', 'after:now'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'cover_media_uuid' => ['nullable', 'uuid', 'exists:media,uuid'],
            'status' => ['sometimes', 'in:'.ClubEvent::STATUS_DRAFT.','.ClubEvent::STATUS_PUBLISHED],
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'title.required' => 'Укажите название мероприятия.',
            'title.min' => 'Название — не короче 3 символов.',
            'title.max' => 'Название — не длиннее 120 символов.',
            'description.max' => 'Описание — не длиннее 4000 символов.',
            'starts_at.required' => 'Укажите дату и время начала.',
            'starts_at.date' => 'Дата и время указаны неверно.',
            'starts_at.after' => 'Начало должно быть в будущем.',
            'location_name.max' => 'Место — не длиннее 255 символов.',
            'latitude.between' => 'Широта — от −90 до 90.',
            'longitude.between' => 'Долгота — от −180 до 180.',
            'latitude.required_with' => 'Укажите обе координаты или ни одной.',
            'longitude.required_with' => 'Укажите обе координаты или ни одной.',
            'cover_media_uuid.exists' => 'Обложка не найдена — загрузите её заново.',
        ];
    }
}
