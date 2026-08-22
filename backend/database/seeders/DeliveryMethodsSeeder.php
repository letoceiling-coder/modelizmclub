<?php

namespace Database\Seeders;

use App\Models\DeliveryMethod;
use Illuminate\Database\Seeder;

class DeliveryMethodsSeeder extends Seeder
{
    public function run(): void
    {
        $methods = [
            ['code' => 'cdek', 'name' => 'СДЭК', 'sort_order' => 10, 'is_integrated' => true],
            ['code' => 'yandex', 'name' => 'Яндекс Доставка', 'sort_order' => 20, 'is_integrated' => true],
            ['code' => 'pochta', 'name' => 'Почта России', 'sort_order' => 30, 'is_integrated' => false],
            ['code' => 'ozon', 'name' => 'Ozon', 'sort_order' => 40, 'is_integrated' => false],
        ];

        foreach ($methods as $row) {
            DeliveryMethod::query()->firstOrCreate(
                ['code' => $row['code']],
                array_merge($row, ['is_active' => true]),
            );
        }
    }
}
