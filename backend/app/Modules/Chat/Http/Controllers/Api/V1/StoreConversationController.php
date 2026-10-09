<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\User;
use App\Support\ListingChat;
use App\Support\ListingChatLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Modules\Chat\Http\Resources\ConversationResource;
use Modules\Chat\Services\ChatService;

class StoreConversationController extends Controller
{
    public function __invoke(Request $request, ChatService $chat): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'listing_uuid' => ['nullable', 'string', 'uuid'],
            'listing_id' => ['nullable'],
        ]);

        $to = User::query()->findOrFail($data['user_id']);
        $listing = $this->resolveListing($data);
        $запрошеноОбъявление = $this->listingRequested($data);
        $поОбъявлению = ListingChat::isOpenFor($listing, $to);

        /*
         * Переписка уже есть — значит её продолжают, а не начинают.
         *
         * Решение Ж3, пункт 3: оба продолжают переписку и после снятия
         * объявления. Клиент на кнопку «Написать продавцу» всегда посылает
         * этот запрос, поэтому без такой проверки снятие товара закрывало бы
         * вход в уже начатый разговор: объявление перестало быть
         * опубликованным, и отказ ниже сработал бы на существующей переписке.
         */
        $продолжение = $chat->hasDirectBetween($request->user(), $to);

        /*
         * Объявление запрошено, но написать по нему нельзя.
         *
         * Пункты 3 и 4 решения Ж3: начать новую переписку по снятому
         * объявлению или по черновику нельзя, и сервер проверяет, что
         * объявление опубликовано **и принадлежит получателю**. Без второго
         * условия достаточно было бы подставить uuid любого живого
         * объявления, чтобы написать любому человеку в обход правила дружбы.
         */
        if ($запрошеноОбъявление && ! $поОбъявлению && ! $продолжение) {
            return response()->json([
                'message' => $listing === null
                    ? 'Объявление не найдено.'
                    : 'По этому объявлению написать нельзя: оно снято или принадлежит другому человеку.',
                'code' => 'listing_not_open',
            ], 422);
        }

        /*
         * Подтверждённый телефон — только там, где его требует матрица.
         *
         * Пункт 8 решения Ж3. Маршрут лежал в группе с посредником
         * `verified`, то есть телефон требовался всегда и из кода, а не из
         * настройки. Матрица же в админке знает три уровня
         * (`guest | auth | subscription`), ключ `messenger.send` стоит в ней
         * на `auth`, и `levelFromAccessTier("auth")` на клиенте даёт
         * `registered` — «вошёл, телефон не подтверждён». То есть матрица
         * телефона для переписки не требует, а сервер требовал.
         *
         * Поэтому проверка перенесена сюда и сузилась: путь из объявления её
         * не проходит, все прочие — проходят, как и раньше. Шире я её не
         * трогал: требование подтверждённого телефона стоит ещё на 135
         * маршрутах, и это правка прав, которой владелец не просил. Разбор —
         * `docs/acceptance/release/phone-required.md`.
         */
        if (! $поОбъявлению && ! $продолжение) {
            if ($отказ = $this->denyUnverified($request)) {
                return $отказ;
            }
        }

        /*
         * Отказ должен быть внятным, а не пустым.
         *
         * Голый authorize() отдавал 403 «This action is unauthorized» без
         * кода, и клиент — который для известных кодов открывает окно, а
         * неизвестные показывает тостом — не показывал ничего вовсе. Замер
         * 07.09: пользователь с подтверждённым номером добавляет собеседника
         * в друзья по подсказке «добавьте в друзья, чтобы написать», жмёт
         * «Написать» и не получает ни диалога, ни объяснения.
         *
         * Получателя передаём в политику: с 05.10 переписку открывает дружба
         * либо подписка, и без собеседника решить нельзя. Объявление — с
         * 09.10, по решению Ж3: по опубликованному объявлению получателя
         * пишет любой вошедший. Код отказа различает случаи —
         * `friendship_required` открывает окно «Добавьте в друзья»,
         * `subscription_required` окно подписки.
         */
        $verdict = Gate::forUser($request->user())
            ->inspect('create', [Conversation::class, $to, $поОбъявлению ? $listing : null]);

        if (! $verdict->allowed()) {
            return response()->json([
                'message' => $verdict->message() ?: 'Нельзя начать переписку.',
                'code' => $verdict->code() ?: 'forbidden',
            ], 403);
        }

        /*
         * Защита от рассылок — пункт 7 решения Ж3.
         *
         * Предел считается только на новые переписки по объявлениям: дружба
         * раньше работала и как защита от рассылок, и, сняв её на этом пути,
         * защиту нужно вернуть чем-то другим. Продолжение существующего
         * разговора предела не трогает — иначе продавец, которому написали
         * двадцать человек, не смог бы ответить двадцать первому.
         */
        if ($поОбъявлению && ! $продолжение && ListingChatLimits::isExhausted($request->user())) {
            return response()->json([
                'message' => 'Сегодня вы начали слишком много переписок по объявлениям. '
                    .'Попробуйте завтра.',
                'code' => 'listing_chat_limit',
            ], 429);
        }

        $conversation = $chat->findOrCreateDirect($request->user(), $to, $listing);

        /*
         * `created` — переписка создана сейчас, а не найдена.
         *
         * Нужно клиенту, чтобы дописывать приветствие «Пишу по объявлению…»
         * только в новую переписку (решение Ж3, пункт 2: повторное нажатие
         * ОТКРЫВАЕТ ту же переписку, а не дописывает в неё ещё одно
         * приветствие). Замер 09.10: три нажатия давали три одинаковых
         * сообщения от одного покупателя.
         *
         * Говорит сервер, а не догадывается клиент. Первая попытка опиралась
         * на тип последнего сообщения в ответе — и оказалась пустой:
         * `ConversationResource` отдаёт `last_message` только когда загружена
         * связь `latestMessage` или `messages`, а `findOrCreateDirect`
         * загружает участников и объявление. То есть признак всегда означал
         * «новая», и три приветствия остались на месте.
         */
        return response()->json([
            'data' => new ConversationResource($conversation),
            'meta' => ['created' => ! $продолжение],
        ], 201);
    }

    /**
     * Запрос телефона у того, кто его не подтвердил.
     *
     * Повторяет ответ посредника `EnsureFullyVerified`, снятого с этого
     * маршрута: тот же код `phone_not_verified`, по которому клиент открывает
     * окно подтверждения номера.
     */
    private function denyUnverified(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if ($user === null || $user->isFullyVerified()) {
            return null;
        }

        if ($user->requiresEmailVerification()) {
            return response()->json([
                'message' => 'Подтвердите email, чтобы выполнить это действие.',
                'code' => 'email_not_verified',
            ], 403);
        }

        return response()->json([
            'message' => 'Подтвердите номер телефона по SMS, чтобы выполнить это действие.',
            'code' => 'phone_not_verified',
        ], 403);
    }

    /** @param  array<string, mixed>  $data */
    private function listingRequested(array $data): bool
    {
        if (! empty($data['listing_uuid'])) {
            return true;
        }

        return array_key_exists('listing_id', $data)
            && $data['listing_id'] !== null
            && $data['listing_id'] !== '';
    }

    /** @param  array<string, mixed>  $data */
    private function resolveListing(array $data): ?Listing
    {
        if (! empty($data['listing_uuid'])) {
            return Listing::query()->where('uuid', $data['listing_uuid'])->first();
        }

        if (! array_key_exists('listing_id', $data) || $data['listing_id'] === null || $data['listing_id'] === '') {
            return null;
        }

        $listingId = $data['listing_id'];

        if (is_numeric($listingId)) {
            return Listing::query()->find((int) $listingId);
        }

        return Listing::query()->where('uuid', (string) $listingId)->first();
    }
}
