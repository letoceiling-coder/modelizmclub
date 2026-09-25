<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Отдельное право сотрудника поверх его роли (C3).
 *
 * Строка добавляет раздел, снять роль ею нельзя — см. миграцию и
 * App\Support\AdminAccess.
 */
class AdminPermissionGrant extends Model
{
    protected $fillable = ['user_id', 'section', 'granted_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    /**
     * Память запроса — чтобы карта доступа не стоила запроса на каждую
     * проверку: `allows()` зовут и маршруты, и меню, и ресурсы.
     *
     * @var array<int, list<string>>
     */
    private static array $память = [];

    /** @return list<string> разделы, выданные этому человеку отдельно */
    public static function sectionsFor(int $userId): array
    {
        return self::$память[$userId] ??= self::query()
            ->where('user_id', $userId)
            ->pluck('section')
            ->map(fn ($s) => (string) $s)
            ->all();
    }

    /**
     * Забыть память. Зовётся вручную после каждой записи.
     *
     * Модельных событий здесь нет намеренно: отзыв прав идёт пакетным
     * `delete()` по построителю запросов, а он событий не поднимает, и
     * хук создавал бы ложное впечатление, что инвалидация происходит
     * сама.
     *
     * Память рассчитана на один запрос. php-fpm сбрасывает состояние
     * между запросами; в очередях и командах карта доступа не читается.
     */
    public static function forget(): void
    {
        self::$память = [];
    }
}
