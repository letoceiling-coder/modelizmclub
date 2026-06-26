<?php

namespace Database\Seeders;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoChatSeeder extends Seeder
{
    public function run(): void
    {
        $demo = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        $admin = User::query()->where('email', 'admin@modelizmclub.ru')->first();

        if (! $demo || ! $admin) {
            return;
        }

        $conversation = Conversation::query()->firstOrCreate(
            ['uuid' => '00000000-0000-4000-8000-000000000201'],
            [
                'type' => ConversationType::Direct,
                'last_message_at' => now(),
            ],
        );

        foreach ([$demo, $admin] as $user) {
            ConversationParticipant::query()->firstOrCreate(
                ['conversation_id' => $conversation->id, 'user_id' => $user->id],
                ['role' => 'member', 'joined_at' => now()],
            );
        }

        $messages = [
            ['from' => $admin, 'body' => 'Добро пожаловать в ModelizmClub!'],
            ['from' => $demo, 'body' => 'Спасибо! Рад быть в сообществе.'],
            ['from' => $admin, 'body' => 'Если будут вопросы — пишите сюда.'],
        ];

        foreach ($messages as $i => $msg) {
            Message::query()->firstOrCreate(
                ['uuid' => sprintf('00000000-0000-4000-8000-00000000030%d', $i + 1)],
                [
                    'conversation_id' => $conversation->id,
                    'user_id' => $msg['from']->id,
                    'body' => $msg['body'],
                    'type' => 'text',
                    'status' => 'sent',
                    'created_at' => now()->subMinutes(10 - $i),
                ],
            );
        }

        $conversation->update(['last_message_at' => now()]);
    }
}
