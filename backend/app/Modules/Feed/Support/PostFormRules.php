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

    /**
     * Направление должно быть из дерева ленты.
     *
     * Флаги `in_feed / in_listings / in_communities` и есть здешний способ
     * сказать «эта категория не для записей»: узлы, импортированные из
     * торгового дерева и из дерева сообществ, получают `in_feed => false`
     * (`CategoriesSingleSourceCommand`). На пути записи этого флага не
     * проверял никто — ни этот набор правил, ни `assertCategoryExists`,
     * который смотрит только `is_active`.
     *
     * Следствие не утечка, а порча таксономии: id торгового узла отдаётся в
     * `GET /api/v1/categories/*`, и запись с ним садилась в направление,
     * которого в дереве ленты нет. В фильтре по направлениям она
     * недостижима, а в общей ленте видна.
     */
    public static function inFeedCategory(): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value === null) {
                return;
            }

            $годится = PostCategory::query()
                ->whereKey($value)
                ->where('in_feed', true)
                ->exists();

            if (! $годится) {
                $fail('Это направление не для записей ленты.');
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
