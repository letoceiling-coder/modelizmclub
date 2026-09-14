<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Журнал аудита — в поясе приложения, как все остальные записи.
 *
 * До 14.09 `audit_logs.created_at` заполняла база значением по умолчанию
 * (CURRENT_TIMESTAMP в поясе сессии Postgres, Etc/UTC), а читал Laravel как
 * московское: каждая запись стояла на три часа раньше действия. С этой
 * выкатки время ставит AuditService (`now()`), а здесь сдвигаются строки,
 * записанные прежним путём, — все, что есть на момент миграции.
 *
 * Сдвиг проверен до миграции с другой стороны: `event.create` и
 * `admin.events.create` против `club_events.created_at` (пишет приложение) —
 * разница ровно 3,00 ч (записи 586 и 590).
 *
 * Граница сохраняется в system_settings, чтобы откат вычел часы у тех же
 * строк и не тронул записанные уже правильно.
 */
return new class extends Migration
{
    private const CUTOFF_KEY = 'migration.audit_logs_moscow_cutoff';

    public function up(): void
    {
        $cutoff = (int) DB::table('audit_logs')->max('id');

        DB::table('system_settings')->updateOrInsert(
            ['key' => self::CUTOFF_KEY],
            ['value' => json_encode(['max_id' => $cutoff, 'hours' => 3]), 'group' => 'system', 'created_at' => now(), 'updated_at' => now()],
        );

        if ($cutoff > 0) {
            DB::update("update audit_logs set created_at = created_at + interval '3 hours' where id <= ?", [$cutoff]);
        }
    }

    public function down(): void
    {
        $raw = DB::table('system_settings')->where('key', self::CUTOFF_KEY)->value('value');
        $cutoff = (int) (json_decode((string) $raw, true)['max_id'] ?? 0);

        if ($cutoff > 0) {
            DB::update("update audit_logs set created_at = created_at - interval '3 hours' where id <= ?", [$cutoff]);
        }

        DB::table('system_settings')->where('key', self::CUTOFF_KEY)->delete();
    }
};
