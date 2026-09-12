<?php

namespace App\Support\Demo;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Modules\Chat\Services\ChatService;

/**
 * Переписка: диалоги демо-людей между собой и с тестовыми учётками.
 *
 * ЗАЧЕМ НЕПРОЧИТАННЫЕ. Счётчик непрочитанных, жирная строка в списке и
 * поднятие диалога наверх проверяются только тем диалогом, который не открыт.
 * Поэтому часть диалогов остаётся непрочитанной у получателя: последнее
 * сообщение пишет собеседник и `markConversationRead` не зовётся.
 *
 * ВЛОЖЕНИЯ. Часть диалогов — с картинкой, отправленной через тот же
 * `uploadAttachment`, что и у человека: вложение попадает в медиа с
 * назначением `chat` и получает те же ограничения.
 *
 * С ТЕСТОВЫМИ УЧЁТКАМИ. Адреса берутся из `docs/qa-accounts.md`; если такой
 * учётки на сервере нет, диалог просто пропускается — набор не должен падать
 * из-за отсутствия чужой почты.
 */
class DemoChatsSection extends DemoSection
{
    /** Тестовые учётки, с которыми заводится переписка. */
    private const TEST_ACCOUNTS = [
        'miyed37693@hebase.com',
        'vevid72194@hebase.com',
        'hoxifoj625@hebase.com',
    ];

    /** Сколько диалогов между демо-людьми. */
    private const PEER_DIALOGS = 14;

    public function __construct(private readonly ChatService $chat) {}

    public function key(): string
    {
        return 'chats';
    }

    public function title(): string
    {
        return 'Переписка';
    }

    public function columns(): array
    {
        return ['вид', 'диалогов', 'сообщений', 'есть'];
    }

    public function plan(): array
    {
        $existing = $this->existingCount();
        $peer = self::PEER_DIALOGS;
        $withTests = count($this->presentTestAccounts());

        return [
            'rows' => [
                ['между демо-людьми', $peer, $peer * 5, min($existing, $peer)],
                ['с тестовыми учётками', $withTests, $withTests * 6, max(0, $existing - $peer)],
            ],
            'create' => max(0, $peer + $withTests - $existing),
            'exists' => min($existing, $peer + $withTests),
        ];
    }

    public function create(callable $tick): int
    {
        $people = array_values($this->people());
        if (count($people) < 4) {
            return 0;
        }

        $lines = DemoTexts::chat();
        $made = 0;

        for ($i = 0; $i < self::PEER_DIALOGS; $i++) {
            $a = $people[($i * 2) % count($people)];
            $b = $people[($i * 2 + 3) % count($people)];
            if ($a->id === $b->id) {
                continue;
            }
            if ($this->alreadyTalking($a, $b)) {
                continue;
            }

            $conversation = $this->chat->findOrCreateDirect($a, $b);
            $this->talk($conversation, $a, $b, $lines, 5, $i);

            // Половину диалогов оставляем непрочитанной у получателя.
            if ($i % 2 === 0) {
                $this->chat->markConversationRead($conversation, $b);
            }

            $made++;
            $tick("{$a->name} — {$b->name}");
        }

        foreach ($this->presentTestAccounts() as $index => $account) {
            $person = $people[($index * 5 + 1) % count($people)];
            if ($this->alreadyTalking($person, $account)) {
                continue;
            }

            $conversation = $this->chat->findOrCreateDirect($person, $account);
            $this->talk($conversation, $person, $account, $lines, 6, $index);
            $this->attach($conversation, $person);

            $made++;
            $tick("{$person->name} — {$account->email}");
        }

        return $made;
    }

    /** @param list<string> $lines */
    private function talk(Conversation $conversation, User $a, User $b, array $lines, int $count, int $seed): void
    {
        for ($i = 0; $i < $count; $i++) {
            $author = $i % 2 === 0 ? $a : $b;
            $this->chat->sendMessage($conversation, $author, $lines[($seed + $i) % count($lines)]);
        }
    }

    /** Одно вложение: картинка тем же путём, что у человека. */
    private function attach(Conversation $conversation, User $author): void
    {
        $path = \App\Support\DemoImageFactory::createJpeg('Вложение · '.$conversation->uuid);
        try {
            $file = new UploadedFile($path, 'demo.jpg', 'image/jpeg', null, true);
            $uploaded = $this->chat->uploadAttachment($conversation, $author, $file);
            // Ключ именно `media_uuid` — так его называет `uploadAttachment`.
            $uuid = $uploaded['media_uuid'] ?? null;
            if ($uuid !== null) {
                $this->chat->sendMessage($conversation, $author, 'Фото коробки, как договаривались.', null, 'text', [$uuid]);
            }
        } finally {
            @unlink($path);
        }
    }

    /**
     * Личный диалог этих двоих уже есть?
     *
     * Только личный. Сначала здесь стоял поиск любого общего диалога, и это
     * ломало весь раздел: у сообщества есть свой чат, в нём десятки людей, и
     * «уже переписываются» отвечало «да» на любую пару из одного сообщества.
     * Диалогов не создавалось ни одного.
     */
    private function alreadyTalking(User $a, User $b): bool
    {
        return DB::table('conversation_participants as p1')
            ->join('conversation_participants as p2', 'p1.conversation_id', '=', 'p2.conversation_id')
            ->join('conversations as c', 'c.id', '=', 'p1.conversation_id')
            ->where('c.type', ConversationType::Direct->value)
            ->where('p1.user_id', $a->id)
            ->where('p2.user_id', $b->id)
            ->exists();
    }

    /** @return list<User> */
    private function presentTestAccounts(): array
    {
        return User::query()->whereIn('email', self::TEST_ACCOUNTS)->orderBy('id')->get()->all();
    }

    private function existingCount(): int
    {
        $ids = User::query()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();
        if ($ids === []) {
            return 0;
        }

        return DB::table('conversation_participants as p')
            ->join('conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('c.type', ConversationType::Direct->value)
            ->whereIn('p.user_id', $ids)
            ->distinct()
            ->count('p.conversation_id');
    }
}
