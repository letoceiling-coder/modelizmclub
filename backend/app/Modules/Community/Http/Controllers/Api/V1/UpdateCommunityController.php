<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunityCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

class UpdateCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();

        if (! $community->canManage($user)) {
            return response()->json(['message' => 'Изменять сообщество может только администратор.'], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:40'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'category_id' => ['sometimes', 'required', 'integer'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'rules' => ['sometimes', 'nullable', 'string', 'max:8000'],
            'access_type' => ['sometimes', 'in:open,request'],
            'contacts' => ['sometimes', 'nullable', 'array'],
            'contacts.telegram' => ['nullable', 'string', 'max:255'],
            'contacts.website' => ['nullable', 'string', 'max:255'],
            'contacts.phone' => ['nullable', 'string', 'max:40'],
            'custom_category' => ['sometimes', 'nullable', 'string', 'max:120'],
            'post_category_ids' => ['sometimes', 'array', 'max:12'],
            'post_category_ids.*' => ['integer', 'exists:post_categories,id'],
        ]);

        $updates = [];
        $immediate = [];
        $isOwner = $community->isOwnedBy($user);
        if ($isOwner && array_key_exists('name', $data)) {
            $updates['name'] = trim($data['name']);
        }
        if ($isOwner && array_key_exists('description', $data)) {
            $updates['description'] = $data['description'] !== null ? trim($data['description']) : null;
        }
        if ($isOwner && array_key_exists('category_id', $data)) {
            $categoryId = (int) $data['category_id'];
            if (! CommunityCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages([
                    'category_id' => ['Выберите действующую категорию.'],
                ]);
            }
            $updates['category_id'] = $categoryId;
        }
        foreach (['city_id', 'rules', 'access_type', 'contacts', 'custom_category'] as $field) {
            if (array_key_exists($field, $data)) {
                $immediate[$field] = $data[$field];
            }
        }

        if ($immediate !== []) {
            $community->update($immediate);
        }
        if (array_key_exists('post_category_ids', $data)) {
            $community->topicCategories()->sync(array_map('intval', $data['post_category_ids']));
        }

        if ($updates !== []) {
            $communities->submitRevision($community, $updates);
        }

        $community = $communities->show($slug, $user);
        $message = $updates !== []
            ? 'Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.'
            : 'Настройки сохранены.';

        return (new CommunityResource($community))
            ->additional(['message' => $message])
            ->response();
    }
}
