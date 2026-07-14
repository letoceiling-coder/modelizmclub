<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\MediaTranscript;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TranscribeMediaController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $media = Media::query()->where('uuid', $uuid)->firstOrFail();

        if ($media->uploaded_by !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        if ($media->purpose !== 'voice') {
            throw ValidationException::withMessages([
                'media' => ['Транскрибация доступна только для голосовых сообщений.'],
            ]);
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
}
