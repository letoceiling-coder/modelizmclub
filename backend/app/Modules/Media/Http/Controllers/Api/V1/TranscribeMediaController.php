<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\MediaTranscript;
use App\Models\MessageAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Media\Exceptions\TranscriptionException;
use Modules\Media\Services\VoiceTranscriber;

class TranscribeMediaController extends Controller
{
    public function __invoke(Request $request, string $uuid, VoiceTranscriber $transcriber): JsonResponse
    {
        $media = Media::query()->where('uuid', $uuid)->firstOrFail();

        if ($media->purpose !== 'voice') {
            throw ValidationException::withMessages([
                'media' => ['Транскрибация доступна только для голосовых сообщений.'],
            ]);
        }

        // Расшифровать голосовое — только участникам переписки. Роль площадки
        // права читать чужие переписки не даёт (до 17.09 администратору давала).
        if (! $this->canAccessVoice($media, $request->user()->id)) {
            abort(403, 'Нет доступа к голосовому сообщению.');
        }

        // Без настоящего провайдера отвечаем «недоступно», а не текстом
        // заглушки: выдуманная расшифровка хуже отсутствующей. Сохранённое
        // раньше тоже не отдаём — на проде это были только заглушки.
        if (! VoiceTranscriber::available()) {
            return response()->json([
                'message' => 'Расшифровка голосовых пока недоступна.',
            ], 503);
        }

        $existing = MediaTranscript::query()->find($media->id);
        if ($existing?->text) {
            return response()->json(['text' => $existing->text, 'lang' => $existing->lang]);
        }

        try {
            $result = $transcriber->transcribe($media);
        } catch (TranscriptionException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        if ($result === null) {
            return response()->json([
                'message' => 'Расшифровка недоступна — STT-провайдер не подключён.',
            ], 503);
        }

        // Cache non-empty transcripts; an empty result usually means silence or
        // a recognition miss, so don't persist it and let a later retry try again.
        if (trim($result['text']) !== '') {
            MediaTranscript::query()->updateOrCreate(
                ['media_id' => $media->id],
                ['text' => $result['text'], 'lang' => $result['lang']],
            );
        }

        return response()->json(['text' => $result['text'], 'lang' => $result['lang']]);
    }

    private function canAccessVoice(Media $media, int $userId): bool
    {
        if ($media->uploaded_by === $userId) {
            return true;
        }

        return MessageAttachment::query()
            ->where('media_id', $media->id)
            ->whereHas('message.conversation.participants', fn ($q) => $q->where('user_id', $userId))
            ->exists();
    }
}
