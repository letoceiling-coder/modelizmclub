<?php

namespace App\Support;

final class LucideIconName
{
    /**
     * Приводит хранимое имя иконки к имени компонента lucide (PascalCase).
     *
     * Раньше ветка без дефиса делала `ucfirst(strtolower($raw))` и уничтожала
     * внутренние заглавные: `MessageSquare` превращался в `Messagesquare`, а
     * `LayoutGrid` — в `Layoutgrid`. Таких имён в lucide нет, и три карточки
     * на главной («Мессенджер», «Прямое общение», «Всё в одном месте»)
     * показывали безликую заглушку `Box`. Заодно каждая загрузка главной
     * из-за промаха тянула клиентский список имён. Найдено 07.09 сверкой
     * всех иконок в базе с составом пакета.
     *
     * Имя, уже написанное в PascalCase, трогать нельзя — только дополнить
     * первой заглавной, если её нет.
     */
    public static function normalize(?string $name): string
    {
        $raw = trim((string) $name);
        if ($raw === '') {
            return 'Box';
        }

        // `message-square` и `message_square` — набранные вручную ключи.
        if (str_contains($raw, '-') || str_contains($raw, '_')) {
            $parts = preg_split('/[-_]+/', $raw) ?: [$raw];

            return implode('', array_map(
                static fn (string $part) => ucfirst(strtolower($part)),
                array_filter($parts, static fn (string $part) => $part !== ''),
            ));
        }

        // `TANK` — регистр не несёт смысла, приводим целиком.
        if ($raw === mb_strtoupper($raw)) {
            return ucfirst(strtolower($raw));
        }

        // Есть заглавная не в начале — имя уже в PascalCase (`MessageSquare`).
        if (preg_match('/[A-Z]/', mb_substr($raw, 1)) === 1) {
            return ucfirst($raw);
        }

        return ucfirst(strtolower($raw));
    }
}
