<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Slug категории уникален во всём дереве, а не среди соседей.
 *
 * Адрес направления односегментный — `/categories/{slug}`, — и узел
 * опознаётся слугом независимо от глубины. Ограничение при этом сторожило
 * пару `(parent_id, slug)`: два разных родителя могли завести детей с
 * одинаковым слугом, и односегментный адрес стал бы двусмысленным.
 *
 * Хуже того, пара не защищала и корневой уровень: `parent_id` там NULL, а
 * Postgres считает NULL различными, то есть два корня с одним слугом старое
 * ограничение пропускало.
 *
 * Данные к переходу готовы — проверено на проде 10.09: в `post_categories`
 * 41 строка и 41 различный slug, в `listing_categories` 25 и 25.
 */
return new class extends Migration
{
    /** @var list<array{string, string, string}> таблица, старое имя, новое */
    private const TABLES = [
        ['post_categories', 'post_categories_parent_id_slug_unique', 'post_categories_slug_unique'],
        ['listing_categories', 'listing_categories_parent_id_slug_unique', 'listing_categories_slug_unique'],
    ];

    public function up(): void
    {
        foreach (self::TABLES as [$table, $old, $new]) {
            Schema::table($table, function (Blueprint $t) use ($old, $new): void {
                $t->dropUnique($old);
                $t->unique('slug', $new);
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as [$table, $old, $new]) {
            Schema::table($table, function (Blueprint $t) use ($old, $new): void {
                $t->dropUnique($new);
                $t->unique(['parent_id', 'slug'], $old);
            });
        }
    }
};
