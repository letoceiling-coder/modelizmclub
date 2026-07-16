<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\MediaTranscript;
use App\Models\MessageAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TranscribeMediaController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $media = Media::query()->where('uuid', $uuid)->firstOrFail();

        if ($media->purpose !== 'voice') {
            throw ValidationException::withMessages([
                'media' => ['Транскрибация доступна только для голосовых сообщений.'],
            ]);
        }

        if (! $request->user()->isAdmin() && ! $this->canAccessVoice($media, $request->user()->id)) {
            abort(403);
        }

        $existing = MediaTranscript::query()->find($media->id);
        if ($existing?->text) {
            return response()->json(['text' => $existing->text, 'lang' => $existing->lang]);
        }

        if (config('media.transcription.stub')) {
            $text = (string) config('media.transcription.stub_text');
            $lang = (string) config('media.transcription.stub_lang');

            MediaTranscript::query()->updateOrCreate(
                ['media_id' => $media->id],
                ['text' => $text, 'lang' => $lang],
            );

            return response()->json(['text' => $text, 'lang' => $lang]);
        }

        return response()->json([
            'message' => 'Расшифровка недоступна — STT-провайдер не подключён.',
        ], 503);
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
