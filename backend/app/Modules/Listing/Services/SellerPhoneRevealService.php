<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingPhoneReveal;
use App\Models\User;
use Illuminate\Http\Request;
use Modules\Listing\Contracts\ContactNumberProvider;
use Modules\Listing\Support\ContactNumber;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * «Позвонить продавцу» — всё, что происходит между кнопкой и номером.
 *
 * Номер берёт ContactNumberProvider; этот сервис решает, можно ли его
 * выдать, считает частоту и пишет журнал. При переходе на АТС меняется
 * провайдер, а не этот сервис (docs/seller-phone-reveal.md).
 *
 * Лимит считается по журналу, а не по счётчику в кеше: он переживает очистку
 * кеша и считает именно разные объявления — повторное раскрытие того же
 * номера лимит не тратит, покупатель может нажать ещё раз на той же странице.
 */
class SellerPhoneRevealService
{
    /**
     * Разных объявлений за час на учётку.
     *
     * Покупатель, сравнивающий предложения, за час открывает номера у
     * нескольких продавцов — двадцать с запасом. Сборщик номеров с одной
     * учётки упирается в двадцать в час, а новая учётка требует
     * подтверждённого по SMS телефона (маршрут за `verified`).
     */
    public const PER_ACCOUNT_PER_HOUR = 20;

    /**
     * Разных объявлений за час с одного адреса — по всем учёткам вместе.
     *
     * Выше лимита учётки: за одним адресом бывает несколько человек (офис,
     * мобильный оператор отдаёт один внешний адрес многим абонентам). Тридцать
     * — это полтора активных покупателя, а не ферма учёток на одном сервере.
     */
    public const PER_ADDRESS_PER_HOUR = 30;

    public function __construct(private readonly ContactNumberProvider $provider) {}

    /** Показывать ли кнопку. Без обращения к провайдеру за номером. */
    public function isAvailable(Listing $listing): bool
    {
        return (bool) $listing->show_phone
            && $listing->status === ListingStatus::Published
            && $this->provider->canProvide($listing);
    }

    public function reveal(Listing $listing, User $viewer, Request $request): ContactNumber
    {
        if (! $this->isAvailable($listing)) {
            throw new NotFoundHttpException('Номер недоступен.');
        }

        $ip = $request->ip();

        if (! $this->alreadyRevealed($listing, $viewer)) {
            $since = now()->subHour();
            $byAccount = ListingPhoneReveal::query()
                ->where('viewer_id', $viewer->id)
                ->where('created_at', '>=', $since)
                ->distinct()
                ->count('listing_id');
            $byAddress = $ip === null ? 0 : ListingPhoneReveal::query()
                ->where('ip_address', $ip)
                ->where('created_at', '>=', $since)
                ->distinct()
                ->count('listing_id');

            if ($byAccount >= self::PER_ACCOUNT_PER_HOUR || $byAddress >= self::PER_ADDRESS_PER_HOUR) {
                throw new TooManyRequestsHttpException(3600, 'Слишком много номеров за час. Попробуйте позже.');
            }
        }

        $number = $this->provider->numberFor($listing, $viewer);

        ListingPhoneReveal::query()->create([
            'listing_id' => $listing->id,
            'viewer_id' => $viewer->id,
            'seller_id' => $listing->user_id,
            'provider' => $this->provider->name(),
            'ip_address' => $ip,
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255) ?: null,
        ]);

        return $number;
    }

    private function alreadyRevealed(Listing $listing, User $viewer): bool
    {
        return ListingPhoneReveal::query()
            ->where('viewer_id', $viewer->id)
            ->where('listing_id', $listing->id)
            ->where('created_at', '>=', now()->subHour())
            ->exists();
    }
}
