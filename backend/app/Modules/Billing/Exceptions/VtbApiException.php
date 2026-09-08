<?php

namespace Modules\Billing\Exceptions;

use RuntimeException;

/**
 * Отказ ВТБ с сохранённой причиной.
 *
 * Клиент всегда бросал голый `RuntimeException` с человеческим текстом, и
 * разобрать причину можно было только по строке. `payments:reconcile-pending`
 * так и делал — искал «code 6» и «not found» в сообщении, — и 08.09 это
 * привело к ложной раскладке: двадцать семь заказов из сорока семи попали в
 * корзину «опросить не удалось» просто потому, что песочница отвечала 429, а
 * команда не отличала «банк отказал» от «банк не знает».
 *
 * Наследуется от `RuntimeException` намеренно: места, ловящие его по старому
 * типу, продолжают работать.
 */
class VtbApiException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly ?int $httpStatus = null,
        private readonly ?string $errorCode = null,
    ) {
        parent::__construct($message);
    }

    /** HTTP-код ответа, если отказ был на уровне протокола. */
    public function httpStatus(): ?int
    {
        return $this->httpStatus;
    }

    /** `errorCode` из тела ответа, если банк ответил 200 с ошибкой внутри. */
    public function errorCode(): ?string
    {
        return $this->errorCode;
    }

    /** Частота превышена — стоит подождать и повторить. */
    public function isRateLimited(): bool
    {
        return $this->httpStatus === 429;
    }

    /**
     * Заказа с таким номером у банка нет.
     *
     * Код 6 в протоколе RBS — «Неверный номер заказа». Отдельный вопрос от
     * «не смогли спросить»: по нему заказ можно закрывать, по остальным — нет.
     */
    public function isUnknownOrder(): bool
    {
        return $this->errorCode === '6';
    }
}
