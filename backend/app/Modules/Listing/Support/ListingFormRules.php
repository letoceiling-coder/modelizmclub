<?php

namespace Modules\Listing\Support;

use App\Models\DeliveryMethod;
use Illuminate\Validation\Rule;

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
            'taxonomy_id' => ['nullable', 'integer', 'exists:post_categories,id'],
            'category_id' => ['required_without:taxonomy_id', 'nullable', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['nullable', 'array'],
            'delivery_methods.*' => ['string', 'max:120', Rule::in(DeliveryMethod::activeNames())],
            'package_size' => ['nullable', 'string', Rule::in(['s', 'm', 'l'])],
            'weight_kg' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'dimensions_cm' => ['nullable', 'array'],
            'dimensions_cm.length' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.width' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.height' => ['nullable', 'integer', 'min:1', 'max:200'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['string'],
            'publish' => ['nullable', 'boolean'],
            'promocode' => ['nullable', 'string', 'max:64'],
            'placement_payment_uuid' => ['nullable', 'uuid'],
        ];
    }

    /** @return array<string, mixed> */
    public static function update(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:10000'],
            'taxonomy_id' => ['nullable', 'integer', 'exists:post_categories,id'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['sometimes', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['sometimes', 'array'],
            'delivery_methods.*' => ['string', 'max:120', Rule::in(DeliveryMethod::activeNames())],
            'package_size' => ['nullable', 'string', Rule::in(['s', 'm', 'l'])],
            'weight_kg' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'dimensions_cm' => ['nullable', 'array'],
            'dimensions_cm.length' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.width' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.height' => ['nullable', 'integer', 'min:1', 'max:200'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'media_ids' => ['sometimes', 'array'],
            'media_ids.*' => ['string'],
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'category_id.required' => 'Выберите категорию.',
            'category_id.required_without' => 'Выберите категорию.',
            'category_id.integer' => 'Выберите категорию из списка.',
            'taxonomy_id.exists' => 'Выберите категорию.',
            'subcategory_id.integer' => 'Выберите подкатегорию из списка.',
            'city_id.integer' => 'Выберите город из списка.',
            'package_size.in' => 'Выберите типоразмер S, M или L либо укажите габариты.',
            'pickup_address.required' => 'Укажите адрес или ориентир для самовывоза.',
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
            'taxonomy_id' => 'категория',
            'price_cents' => 'цена',
            'city_id' => 'город',
        ];
    }
}
