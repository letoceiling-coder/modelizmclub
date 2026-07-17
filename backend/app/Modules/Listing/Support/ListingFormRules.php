<?php

namespace Modules\Listing\Support;

final class ListingFormRules
{
    /** 999 999 999 ₽ — safe for 64-bit price_cents storage. */
    public const MAX_PRICE_CENTS = 99_999_999_900;

    /** @return array<string, mixed> */
    public static function store(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category_id' => ['required', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['nullable', 'array'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['string'],
            'publish' => ['nullable', 'boolean'],
        ];
    }

    /** @return array<string, mixed> */
    public static function update(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:10000'],
            'category_id' => ['sometimes', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['sometimes', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['sometimes', 'array'],
            'media_ids' => ['sometimes', 'array'],
            'media_ids.*' => ['string'],
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'category_id.required' => 'Выберите категорию.',
            'category_id.integer' => 'Выберите категорию из списка.',
            'subcategory_id.integer' => 'Выберите подкатегорию из списка.',
            'city_id.integer' => 'Выберите город из списка.',
            'price_cents.integer' => 'Укажите корректную цену — слишком большое число или неверный формат.',
            'price_cents.max' => 'Цена слишком большая. Максимум — 999 999 999 ₽.',
            'price_cents.min' => 'Цена не может быть отрицательной.',
        ];
    }

    /** @return array<string, string> */
    public static function attributes(): array
    {
        return [
            'title' => 'название',
            'description' => 'описание',
            'category_id' => 'категория',
            'subcategory_id' => 'подкатегория',
            'price_cents' => 'цена',
            'city_id' => 'город',
        ];
    }
}
