<?php

namespace Modules\Feed\Support;

use App\Models\PostCategory;

final class PostFormRules
{
    public const TITLE_MAX_LENGTH = 100;

    public const BODY_MAX_LENGTH = 10000;

    /** @return array<string, string> */
    /**
     * «Каналы» — служебная категория зеркал записей каналов в ленте
     * (ChannelPostService::createFeedDraft). Обычный пост в ней выглядел бы
     * записью канала, которого за ним нет; на проде такой нашёлся 17.09.
     */
    public static function notChannelsCategory(): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value !== null && PostCategory::query()->whereKey($value)->where('slug', 'channels')->exists()) {
                $fail('Категория «Каналы» — только для записей каналов.');
            }
        };
    }

    public static function messages(): array
    {
        return [
            'title.required' => 'Введите заголовок.',
            'title.max' => 'Заголовок не может быть длиннее '.self::TITLE_MAX_LENGTH.' символов.',
            'body.required' => 'Введите текст публикации.',
            'body.max' => 'Текст публикации слишком длинный.',
        ];
    }

    /** @return array<string, string> */
    public static function attributes(): array
    {
        return [
            'title' => 'заголовок',
            'body' => 'текст публикации',
        ];
    }
}
