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

        $landing = FaqCategory::query()->updateOrCreate(
            ['slug' => 'landing'],
            ['name' => 'Лендинг', 'sort_order' => 5, 'is_active' => true],
        );

        $landingItems = [
            [
                'question' => 'Нужно ли регистрироваться, чтобы смотреть?',
                'answer' => 'Нет. Объявления, сообщества и каналы можно смотреть без регистрации. Аккаунт нужен, чтобы публиковать и писать сообщения.',
                'sort_order' => 10,
            ],
            [
                'question' => 'Сколько стоит участие?',
                'answer' => 'Базовое использование бесплатно. Подписка снимает ограничения и открывает расширенные возможности — актуальные цены на странице «Подписка».',
                'sort_order' => 20,
            ],
            [
                'question' => 'Как разместить объявление?',
                'answer' => 'После входа откройте раздел «Объявления» и нажмите «Создать». Заполните форму — модерация занимает до суток.',
                'sort_order' => 30,
            ],
            [
                'question' => 'Можно ли пользоваться с телефона?',
                'answer' => 'Да. Интерфейс адаптирован под мобильные — отдельное приложение не требуется.',
                'sort_order' => 40,
            ],
            [
                'question' => 'Какие направления есть?',
                'answer' => 'Направления формируются автоматически — смотрите актуальный список в каталоге объявлений.',
                'sort_order' => 50,
            ],
        ];

        foreach ($landingItems as $item) {
            FaqArticle::query()->updateOrCreate(
                ['category_id' => $landing->id, 'question' => $item['question']],
                [
                    'answer' => $item['answer'],
                    'sort_order' => $item['sort_order'],
                    'is_active' => true,
                ],
            );
        }

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
