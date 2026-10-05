<?php

namespace Modules\Billing\Services;

use App\Models\Promocode;
use App\Models\PromocodeUsage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PromocodeService
{
    public function findValid(string $code, User $user, string $scope, ?int $listingCategoryId = null): Promocode
    {
        $promocode = Promocode::query()
            ->whereRaw('UPPER(code) = ?', [Str::upper(trim($code))])
            ->first();

        if (! $promocode) {
            throw ValidationException::withMessages([
                'promocode' => ['Промокод не найден.'],
            ]);
        }

        $this->assertValid($promocode, $user, $scope, $listingCategoryId);

        return $promocode;
    }

    public function discountCents(Promocode $promocode, int $amountCents): int
    {
        if ($amountCents <= 0) {
            return 0;
        }

        return match ($promocode->type) {
            'percent' => (int) min($amountCents, round($amountCents * $promocode->value / 100)),
            'fixed' => min($amountCents, max(0, (int) $promocode->value)),
            'free' => $amountCents,
            default => 0,
        };
    }

    /** Сколько минут держится бронь без оплаты. Решение владельца от 04.10. */
    public const МИНУТ_БРОНИ = 30;

    /**
     * Занять место в момент выдачи скидки.
     *
     * До этого лимит проверялся при выдаче, а строка писалась только после
     * оплаты: между двумя моментами счётчик не рос, и на последнее место
     * одновременно проходило сколько угодно человек. Гонка воспроизведена
     * 04.10.
     *
     * Возвращает бронь, чтобы вызывающий мог её снять, если до оплаты дело
     * не дошло.
     */
    public function reserveSeat(Promocode $promocode, User $user, ?int $paymentId = null): PromocodeUsage
    {
        return PromocodeUsage::query()->create([
            'promocode_id' => $promocode->id,
            'user_id' => $user->id,
            'payment_id' => $paymentId,
            'status' => PromocodeUsage::ЗАНЯТО,
            'reserved_at' => now(),
            'used_at' => null,
        ]);
    }

    /**
     * Снять бронь: платёж отменён, не удался или брошен.
     *
     * Строка удаляется, а не помечается: место должно освободиться, а след
     * несостоявшейся попытки остаётся в самом платеже, у которого есть и
     * статус, и причина. Хранить его вторым экземпляром здесь значило бы
     * считать лимит по строкам, часть из которых ничего не занимает.
     */
    public function releaseSeat(Promocode $promocode, User $user, ?int $paymentId = null): int
    {
        return PromocodeUsage::query()
            ->where('promocode_id', $promocode->id)
            ->where('user_id', $user->id)
            ->where('status', PromocodeUsage::ЗАНЯТО)
            ->when($paymentId !== null, fn ($q) => $q->where('payment_id', $paymentId))
            ->delete();
    }

    /**
     * Оплата прошла: бронь становится использованием.
     *
     * Если брони нет — например, место заняли до этой правки или путь
     * прошёл мимо брони, — пишем использование сразу. Молчаливый пропуск
     * означал бы неучтённое использование, а это та же дыра с другой
     * стороны.
     */
    public function recordUsage(Promocode $promocode, User $user, ?int $paymentId = null): void
    {
        $бронь = PromocodeUsage::query()
            ->where('promocode_id', $promocode->id)
            ->where('user_id', $user->id)
            ->where('status', PromocodeUsage::ЗАНЯТО)
            ->when($paymentId !== null, fn ($q) => $q->where('payment_id', $paymentId))
            ->orderBy('reserved_at')
            ->first();

        if ($бронь instanceof PromocodeUsage) {
            $бронь->update([
                'status' => PromocodeUsage::ИЗРАСХОДОВАНО,
                'payment_id' => $paymentId ?? $бронь->payment_id,
                'used_at' => now(),
            ]);

            return;
        }

        PromocodeUsage::query()->create([
            'promocode_id' => $promocode->id,
            'user_id' => $user->id,
            'payment_id' => $paymentId,
            'status' => PromocodeUsage::ИЗРАСХОДОВАНО,
            'used_at' => now(),
        ]);
    }

    private function assertValid(Promocode $promocode, User $user, string $scope, ?int $listingCategoryId): void
    {
        if (! $promocode->is_active) {
            throw ValidationException::withMessages(['promocode' => ['Промокод неактивен.']]);
        }

        if ($promocode->valid_from && $promocode->valid_from->isFuture()) {
            throw ValidationException::withMessages(['promocode' => ['Промокод ещё не действует.']]);
        }

        if ($promocode->valid_until && $promocode->valid_until->isPast()) {
            throw ValidationException::withMessages(['promocode' => ['Срок действия промокода истёк.']]);
        }

        if ($promocode->user_id && (int) $promocode->user_id !== (int) $user->id) {
            throw ValidationException::withMessages(['promocode' => ['Промокод недоступен для вашего аккаунта.']]);
        }

        /*
         * Круг людей, которым код доступен.
         *
         * Появился 28.09 вместе с подписью «Кому доступен промокод» в
         * админке. До этого ограничение было только на одного человека
         * (`user_id` выше), а поле в админке, похожее на список людей,
         * управляло **уведомлениями** и ничего не запрещало. Подпись,
         * обещающая запрет, требует запрета — вот он.
         *
         * Пустой список — код доступен всем: отсутствие ограничения и есть
         * «всем», отдельного признака для этого не нужно.
         */
        $круг = DB::table('promocode_users')->where('promocode_id', $promocode->id);
        if ($круг->exists() && ! (clone $круг)->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['promocode' => ['Промокод недоступен для вашего аккаунта.']]);
        }

        if (! in_array($promocode->scope, [$scope, 'all'], true)) {
            throw ValidationException::withMessages(['promocode' => ['Промокод нельзя применить к этой операции.']]);
        }

        if ($promocode->listing_category_id && $listingCategoryId && (int) $promocode->listing_category_id !== $listingCategoryId) {
            throw ValidationException::withMessages(['promocode' => ['Промокод не действует для выбранной категории.']]);
        }

        /*
         * Лимит считает и занятые места, и израсходованные.
         *
         * Считать только израсходованные значило бы отдавать одно и то же
         * последнее место всем, кто дошёл до оплаты одновременно: строка
         * появлялась только после платежа. Решение владельца от 04.10 —
         * место занимается при выдаче скидки.
         *
         * Брошенная бронь из счёта исключается прямо здесь, по времени, а
         * не только командой-сторожем: сторож ходит раз в несколько минут, и
         * между его заходами последнее место иначе простаивало бы.
         */
        $просрочена = now()->subMinutes(self::МИНУТ_БРОНИ);
        $занятых = $promocode->usages()
            ->where(function ($q) use ($просрочена): void {
                $q->where('status', PromocodeUsage::ИЗРАСХОДОВАНО)
                    ->orWhere(fn ($q2) => $q2
                        ->where('status', PromocodeUsage::ЗАНЯТО)
                        ->where('reserved_at', '>', $просрочена));
            })
            ->count();

        if ($promocode->max_usages !== null && $занятых >= $promocode->max_usages) {
            throw ValidationException::withMessages(['promocode' => ['Лимит использований промокода исчерпан.']]);
        }

        $userUsages = $promocode->usages()
            ->where('user_id', $user->id)
            ->where(function ($q) use ($просрочена): void {
                $q->where('status', PromocodeUsage::ИЗРАСХОДОВАНО)
                    ->orWhere(fn ($q2) => $q2
                        ->where('status', PromocodeUsage::ЗАНЯТО)
                        ->where('reserved_at', '>', $просрочена));
            })
            ->count();
        $perUser = $promocode->max_usages_per_user ?? 1;
        if ($userUsages >= $perUser) {
            throw ValidationException::withMessages(['promocode' => ['Вы уже использовали этот промокод.']]);
        }
    }
}
