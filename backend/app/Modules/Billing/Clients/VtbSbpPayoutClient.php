<?php

namespace Modules\Billing\Clients;

/**
 * VTB SBP B2C payouts (ОЭ): dictionary/banks + b2c_pay/*.
 *
 * Flow: check_accept_transaction → wait APPROVED (callback or poll
 * status_transaction) → confirm_transaction (OK|FAIL) → PAID|DECLINED.
 *
 * @see https://test-pay.vtb.ru/api-developer-docs/#/api-transfer/transfer_sbp
 */
class VtbSbpPayoutClient
{
    public const CONFIRM_OK = 'OK';

    public const CONFIRM_FAIL = 'FAIL';

    public const SCENARIO_B2C_OTHER = 'B2COther';

    public function __construct(
        private readonly VtbPayoutOAuthClient $oauth,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function dictionaryBanks(): array
    {
        return $this->oauth->getJson('sbp-gateway/v1/dictionary/banks');
    }

    /**
     * @return array<string, mixed>
     */
    public function checkAcceptTransaction(
        string $requestId,
        string $phone,
        int $amountKopecks,
        string $bankId,
        string $fullName,
        ?string $paymentPurpose = null,
        ?string $rvncode = null,
        ?string $codeControl = null,
    ): array {
        $payload = [
            'requestId' => $requestId,
            'phone' => $phone,
            'amount' => VtbPayoutOAuthClient::rubFromKopecks($amountKopecks),
            'bankId' => $bankId,
            'fullName' => $fullName,
        ];

        if ($paymentPurpose !== null) {
            $payload['paymentPurpose'] = $paymentPurpose;
        }

        if ($rvncode !== null) {
            $payload['rvncode'] = $rvncode;
        }

        if ($codeControl !== null) {
            $payload['codeControl'] = $codeControl;
        }

        return $this->oauth->postJson('sbp-gateway/v1/b2c_pay/check_accept_transaction', $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function confirmTransaction(string $requestId, string $confirmStatus = self::CONFIRM_OK): array
    {
        return $this->oauth->postJson('sbp-gateway/v1/b2c_pay/confirm_transaction', [
            'requestId' => $requestId,
            'confirmStatus' => $confirmStatus,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function statusTransaction(string $requestId): array
    {
        return $this->oauth->postJson('sbp-gateway/v1/b2c_pay/status_transaction', [
            'requestId' => $requestId,
        ]);
    }
}
