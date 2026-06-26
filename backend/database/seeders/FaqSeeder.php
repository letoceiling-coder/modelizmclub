<?php

namespace Database\Seeders;

use App\Models\FaqArticle;
use App\Models\FaqCategory;
use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'first_hundred_stats'],
            ['value' => ['taken' => 47, 'total' => 100], 'group' => 'marketing'],
        );

        $general = FaqCategory::query()->updateOrCreate(
            ['slug' => 'general'],
            ['name' => 'Общие вопросы', 'sort_order' => 10, 'is_active' => true],
        );

        $account = FaqCategory::query()->updateOrCreate(
            ['slug' => 'account'],
            ['name' => 'Аккаунт', 'sort_order' => 20, 'is_active' => true],
        );

        FaqArticle::query()->updateOrCreate(
            ['category_id' => $general->id, 'question' => 'Что такое ModelizmClub?'],
            [
                'answer' => 'ModelizmClub — сообщество моделистов: лента, объявления, чаты и тематические сообщества.',
                'sort_order' => 10,
                'is_active' => true,
            ],
        );

        FaqArticle::query()->updateOrCreate(
            ['category_id' => $general->id, 'question' => 'Как опубликовать пост?'],
            [
                'answer' => 'Откройте ленту, нажмите «Создать пост», заполните форму и отправьте на модерацию.',
                'sort_order' => 20,
                'is_active' => true,
            ],
        );

        FaqArticle::query()->updateOrCreate(
            ['category_id' => $account->id, 'question' => 'Как восстановить пароль?'],
            [
                'answer' => 'На странице входа нажмите «Забыли пароль?» и следуйте инструкции из письма.',
                'sort_order' => 10,
                'is_active' => true,
            ],
        );
    }
}
