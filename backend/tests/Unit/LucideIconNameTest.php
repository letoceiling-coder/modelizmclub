<?php

namespace Tests\Unit;

use App\Support\LucideIconName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LucideIconNameTest extends TestCase
{
    /** @return array<string, array{string|null, string}> */
    public static function names(): array
    {
        return [
            // Ради чего правка: имя уже в PascalCase, ломать его нельзя.
            'PascalCase остаётся как есть' => ['MessageSquare', 'MessageSquare'],
            'вторая заглавная в середине' => ['LayoutGrid', 'LayoutGrid'],
            'три слова' => ['MessageSquarePlus', 'MessageSquarePlus'],
            'заглавная перед цифрой' => ['Users2', 'Users2'],

            // Ветки, которые работали и раньше.
            'строчное имя из сида' => ['plane', 'Plane'],
            'дефисный ключ' => ['message-square', 'MessageSquare'],
            'дефисный ключ с цифрой' => ['users-2', 'Users2'],
            'подчёркивание' => ['layout_grid', 'LayoutGrid'],
            'одно слово с заглавной' => ['Truck', 'Truck'],
            'капслок' => ['TANK', 'Tank'],
            'пробелы по краям' => ['  Ship  ', 'Ship'],
            'пусто' => ['', 'Box'],
            'null' => [null, 'Box'],
        ];
    }

    #[DataProvider('names')]
    public function test_it_normalizes_stored_names_to_lucide_components(?string $raw, string $expected): void
    {
        $this->assertSame($expected, LucideIconName::normalize($raw));
    }
}
