<?php

namespace Modules\Feed\Support;

final class PostFormRules
{
    public const TITLE_MAX_LENGTH = 100;

    public const BODY_MAX_LENGTH = 10000;

    /** @return array<string, string> */
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
