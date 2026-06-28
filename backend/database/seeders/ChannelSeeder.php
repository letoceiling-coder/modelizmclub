<?php

namespace Database\Seeders;

use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ChannelSeeder extends Seeder
{
    public function run(): void
    {
        $demo = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        $admin = User::query()->where('email', 'admin@modelizmclub.ru')->first();

        $channels = [
            ['slug' => 'modelizm', 'name' => 'МоДелизМ Форум', 'description' => 'Официальный канал форума: анонсы, события, новости комьюнити.', 'category' => 'Сообщество', 'kind' => 'official', 'avatar_color' => '#2563eb', 'banner_color' => 'linear-gradient(135deg,#1e3a8a,#2563eb)', 'subscribers_count' => 12480, 'owner_id' => $admin?->id],
            ['slug' => 'tamiya', 'name' => 'Tamiya News', 'description' => 'Новинки, обзоры и спецпредложения от Tamiya.', 'category' => 'Бренд', 'kind' => 'brand', 'avatar_color' => '#dc2626', 'banner_color' => 'linear-gradient(135deg,#7f1d1d,#dc2626)', 'subscribers_count' => 8920, 'owner_id' => $admin?->id],
            ['slug' => 'modelshop', 'name' => 'ModelShop24', 'description' => 'Скидки, поступления и распродажи в магазине ModelShop24.', 'category' => 'Магазин', 'kind' => 'shop', 'avatar_color' => '#16a34a', 'banner_color' => 'linear-gradient(135deg,#14532d,#16a34a)', 'subscribers_count' => 5230, 'owner_id' => $admin?->id],
            ['slug' => 'airbrush-pro', 'name' => 'Airbrush Pro', 'description' => 'Техники аэрографии, обзоры красок и пошаговые уроки.', 'category' => 'Эксперт', 'kind' => 'expert', 'avatar_color' => '#9333ea', 'banner_color' => 'linear-gradient(135deg,#4c1d95,#9333ea)', 'subscribers_count' => 3410, 'owner_id' => $admin?->id],
            ['slug' => 'scale-weekly', 'name' => 'Scale Weekly', 'description' => 'Еженедельный дайджест новинок и обзоров моделей.', 'category' => 'Автор', 'kind' => 'author', 'avatar_color' => '#ea580c', 'banner_color' => 'linear-gradient(135deg,#7c2d12,#ea580c)', 'subscribers_count' => 2140, 'owner_id' => $admin?->id],
            ['slug' => 'rc-cars', 'name' => 'RC Cars Russia', 'description' => 'Радиоуправляемые модели: соревнования, тюнинг, обзоры.', 'category' => 'Сообщество', 'kind' => 'author', 'avatar_color' => '#0891b2', 'banner_color' => 'linear-gradient(135deg,#164e63,#0891b2)', 'subscribers_count' => 6780, 'owner_id' => $admin?->id],
            ['slug' => 'my-workshop', 'name' => 'Моя мастерская', 'description' => 'Мой личный канал — делюсь сборками и текущими проектами.', 'category' => 'Автор', 'kind' => 'author', 'avatar_color' => '#f59e0b', 'banner_color' => 'linear-gradient(135deg,#92400e,#f59e0b)', 'subscribers_count' => 142, 'owner_id' => $demo?->id],
        ];

        foreach ($channels as $data) {
            $channel = Channel::query()->updateOrCreate(
                ['slug' => $data['slug']],
                array_merge($data, ['is_active' => true]),
            );

            if ($channel->posts()->count() === 0) {
                $this->seedPosts($channel);
            }
        }
    }

    private function seedPosts(Channel $channel): void
    {
        $samples = match ($channel->slug) {
            'modelizm' => [
                ['Открыта регистрация на летнюю выставку моделистов 2026. Подробности и билеты — на сайте форума.', 'announce'],
                ['Новый сезон встреч в регионах. Смотрите расписание и добавляйте свой город.', 'news'],
            ],
            'tamiya' => [
                ['Анонс: новый набор Tamiya 1/24 — Porsche 911 GT3 RS. Старт продаж 1 июля.', 'announce'],
                ['Спецпредложение: скидка 15% на всю линейку красок Tamiya Acrylic до конца месяца.', 'promo'],
            ],
            'modelshop' => [['Поступление: инструменты Hasegawa Tritool. Количество ограничено.', 'news']],
            'airbrush-pro' => [['Урок №14: имитация выцветшей краски на бронетехнике — разбираю весь процесс по слоям.', 'review']],
            'scale-weekly' => [['Дайджест недели: ТОП-5 анонсов производителей и обзор новой линейки Zvezda.', 'review']],
            'rc-cars' => [['Итоги этапа Кубка России по RC-багги. Победители, фото и видео заездов внутри.', 'news']],
            'my-workshop' => [['Закончил покраску корпуса — финальные фото готовой модели в посте.', 'news']],
            default => [],
        };

        foreach ($samples as $i => [$text, $kind]) {
            ChannelPost::query()->create([
                'uuid' => (string) Str::uuid(),
                'channel_id' => $channel->id,
                'author_id' => $channel->owner_id,
                'text' => $text,
                'kind' => $kind,
                'status' => 'published',
                'likes_count' => random_int(40, 540),
                'views_count' => random_int(800, 8000),
                'published_at' => now()->subDays($i + 1),
            ]);
        }
    }
}
