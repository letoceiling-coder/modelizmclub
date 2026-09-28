<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LegalPage;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Страница «Как пользоваться»: содержимое из админки, видео отдельно.
 *
 * Проверяется то, что легко сломать незаметно: что страница вообще
 * опубликована (иначе пункт меню ведёт в «не найдено»), что видео живёт
 * отдельно от текста и не теряется при обычном сохранении, и что
 * возврат к прежней версии текста запись не снимает.
 */
class HowToUsePageTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    private function видео(): Media
    {
        return Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/guide_video/'.Str::uuid().'.mp4',
            'filename' => 'obzor.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 1024,
            'status' => MediaStatus::Ready,
        ]);
    }

    public function test_the_page_is_published_and_opens_by_its_slug(): void
    {
        /*
         * Пункт меню появляется той же выкаткой, что и страница. Будь она
         * черновиком, человек нажал бы «Как пользоваться» и получил
         * «документ не найден» — а понять, что дело в статусе, а не в
         * поломке, снаружи невозможно.
         */
        $ответ = $this->getJson('/api/v1/legal/how-to-use')->assertOk()->json('data');

        $this->assertSame('Как пользоваться', $ответ['title']);
        $this->assertNotSame('', trim((string) $ответ['content_html']));
    }

    public function test_the_skeleton_covers_every_section_that_was_asked_for(): void
    {
        $html = $this->getJson('/api/v1/legal/how-to-use')->assertOk()->json('data.content_html');

        foreach ([
            'Регистрация и вход',
            'Что доступно после регистрации',
            'Лента',
            'Направления и чаты',
            'Обзоры',
            'Сообщества и каналы',
            'Мессенджер',
            'Объявления и безопасная сделка',
            'Профиль, подписка, настройки',
        ] as $раздел) {
            $this->assertStringContainsString($раздел, $html, "В заготовке нет раздела «{$раздел}».");
        }
    }

    public function test_the_page_has_no_video_until_one_is_attached(): void
    {
        // Отсутствие записи — это `null`, а не пустой объект: страница по
        // нему решает, рисовать ли проигрыватель вообще.
        $this->getJson('/api/v1/legal/how-to-use')
            ->assertOk()
            ->assertJsonPath('data.video', null);
    }

    public function test_admin_attaches_a_video_and_the_page_serves_it(): void
    {
        $page = LegalPage::query()->where('slug', 'how-to-use')->firstOrFail();
        $media = $this->видео();
        $admin = $this->owner();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/legal-pages/{$page->id}", [
                'slug' => $page->slug,
                'title' => $page->title,
                'content_md' => $page->content_md,
                'video_media_uuid' => $media->uuid,
            ])
            ->assertOk()
            ->assertJsonPath('data.video.uuid', $media->uuid);

        // Правка переводит страницу в черновик — публикуем, иначе снаружи
        // её не видно, и проверка ничего не доказала бы.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/legal-pages/{$page->id}/publish")
            ->assertOk();

        $видео = $this->getJson('/api/v1/legal/how-to-use')->assertOk()->json('data.video');

        $this->assertNotNull($видео, 'Страница не отдала привязанное видео.');
        $this->assertStringContainsString($media->uuid, (string) $видео['url']);
        $this->assertSame('video/mp4', $видео['mime_type']);
    }

    public function test_saving_the_text_without_the_field_keeps_the_video(): void
    {
        $page = LegalPage::query()->where('slug', 'how-to-use')->firstOrFail();
        $media = $this->видео();
        $page->forceFill(['video_media_id' => $media->id])->save();

        $admin = $this->owner();

        /*
         * Главная ловушка поля: админка шлёт страницу целиком, и если
         * отсутствие ключа считать за «снять», любое исправление опечатки
         * в тексте выбрасывало бы запись. Человек заметил бы это не
         * сразу — страница осталась бы с текстом, но без видео.
         */
        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/legal-pages/{$page->id}", [
                'slug' => $page->slug,
                'title' => $page->title,
                'content_md' => 'Другой текст',
            ])
            ->assertOk()
            ->assertJsonPath('data.video.uuid', $media->uuid);

        $this->assertSame($media->id, (int) $page->fresh()->video_media_id);
    }

    public function test_an_empty_field_removes_the_video(): void
    {
        $page = LegalPage::query()->where('slug', 'how-to-use')->firstOrFail();
        $media = $this->видео();
        $page->forceFill(['video_media_id' => $media->id])->save();

        $this->actingAs($this->owner(), 'sanctum')
            ->putJson("/api/v1/admin/legal-pages/{$page->id}", [
                'slug' => $page->slug,
                'title' => $page->title,
                'content_md' => $page->content_md,
                'video_media_uuid' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.video', null);

        $this->assertNull($page->fresh()->video_media_id);
    }

    public function test_restoring_an_older_text_does_not_drop_the_video(): void
    {
        $page = LegalPage::query()->where('slug', 'how-to-use')->firstOrFail();
        $admin = $this->owner();

        // Правим текст — появляется версия с прежним.
        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/legal-pages/{$page->id}", [
                'slug' => $page->slug,
                'title' => $page->title,
                'content_md' => 'Текст после правки',
            ])->assertOk();

        // Видео привязано уже после правки.
        $media = $this->видео();
        $page->fresh()->forceFill(['video_media_id' => $media->id])->save();

        $версия = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/admin/legal-pages/{$page->id}/revisions")
            ->assertOk()
            ->json('data.0.id');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/legal-pages/{$page->id}/revisions/{$версия}/restore")
            ->assertOk()
            // Текст вернулся, запись осталась: к тексту её никто не привязывал.
            ->assertJsonPath('data.video.uuid', $media->uuid);
    }

    public function test_the_video_purpose_exists_and_allows_a_long_recording(): void
    {
        // Запись экрана на три минуты весит десятки мегабайт: назначение
        // с картиночным пределом в 10 МБ отвергло бы её, и выглядело бы
        // это как «загрузка не работает».
        $this->assertContains('guide_video', \Modules\Media\Services\MediaUploadService::purposes());
        $this->assertGreaterThan(
            100 * 1024,
            \Modules\Media\Services\MediaUploadService::maxSizeKb('guide_video'),
        );
    }
}
