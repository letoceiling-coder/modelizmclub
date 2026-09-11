<?php

namespace Tests\Unit;

use App\Rules\SafeEmail;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Правило SafeEmail само по себе: какие адреса отбивает и какие пропускает.
 * Где оно стоит и что эндпоинты с ним делают — EmailCrlfValidationTest.
 */
class SafeEmailTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function rejected(): array
    {
        return [
            'CR' => ["a\rb@example.com"],
            'LF' => ["a\nb@example.com"],
            'CRLF в кавычках' => ["\"a\r\n b\"@example.com"],
            'TAB' => ["a\tb@example.com"],
            'NUL' => ["a\0b@example.com"],
            'DEL' => ["a\x7Fb@example.com"],
            'NEL' => ["a\u{0085}b@example.com"],
            'LINE SEPARATOR' => ["a\u{2028}b@example.com"],
            'PARAGRAPH SEPARATOR' => ["a\u{2029}b@example.com"],
            'битый UTF-8' => ["a\xC3@example.com"],
        ];
    }

    #[DataProvider('rejected')]
    public function test_rejects_control_characters(string $value): void
    {
        $this->assertTrue($this->fails($value));
    }

    /** @return array<string, array{string}> */
    public static function accepted(): array
    {
        return [
            'обычный' => ['ivan@example.com'],
            'плюс и точка' => ['ivan.petrov+club@example.com'],
            'кириллический домен' => ['ivan@пример.рф'],
            'кавычки без переводов строки' => ['"ivan petrov"@example.com'],
        ];
    }

    #[DataProvider('accepted')]
    public function test_accepts_real_addresses(string $value): void
    {
        $this->assertFalse($this->fails($value));
    }

    public function test_non_string_is_left_to_other_rules(): void
    {
        $this->assertFalse($this->fails(12345));
    }

    private function fails(mixed $value): bool
    {
        return Validator::make(['email' => $value], ['email' => [new SafeEmail]])->fails();
    }
}
