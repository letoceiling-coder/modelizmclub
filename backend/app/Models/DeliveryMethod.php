<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryMethod extends Model
{
    protected $fillable = [
        'code',
        'name',
        'sort_order',
        'is_active',
        'is_integrated',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_integrated' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return list<string> */
    public static function activeNames(): array
    {
        return self::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->pluck('name')
            ->all();
    }
}
