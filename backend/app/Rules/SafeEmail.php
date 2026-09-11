<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Адрес без управляющих символов.
 *
 * Стоит рядом со стандартным `email` на каждом поле, где адрес приходит
 * извне. Сам по себе `email` в Laravel 11 пропускает часть последовательностей
 * с переводом строки, а Symfony Mailer потом подставляет такой адрес в
 * заголовки письма: GHSA-5vg9-5847-vvmq, «CRLF injection in default email
 * rule», high. Через регистрацию и «забыли пароль» это достижимо без входа —
 * на указанный адрес уходит письмо, и перевод строки внутри адреса
 * позволяет дописать заголовки или чужих получателей.
 *
 * Исправлено только в Laravel 12.60; для 11.x заплатки нет. Пока переход не
 * сделан, это правило закрывает дыру у нас: настоящему адресу управляющие
 * символы не нужны ни в каком виде, поэтому отказ ничего законного не режет.
 *
 * Запрещены C0 (включая CR, LF, NUL, TAB), DEL и юникодные переводы строки
 * NEL, LINE SEPARATOR, PARAGRAPH SEPARATOR — последние Symfony Mime тоже
 * может превратить в разрыв строки.
 */
class SafeEmail implements ValidationRule
{
    private const FORBIDDEN = '/[\x00-\x1F\x7F\x{0085}\x{2028}\x{2029}]/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        // Невалидный UTF-8 preg_match не разберёт и вернёт false — это тоже отказ.
        if (preg_match(self::FORBIDDEN, $value) !== 0) {
            $fail('Адрес содержит недопустимые символы.');
        }
    }
}
