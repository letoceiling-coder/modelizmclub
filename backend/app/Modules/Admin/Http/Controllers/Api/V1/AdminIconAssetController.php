<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\IconAsset;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;

#[Group('Admin — Design', weight: 82)]
class AdminIconAssetController extends Controller
{
    public function index(): JsonResponse
    {
        $assets = IconAsset::query()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (IconAsset $asset): array => [
                'id' => (string) $asset->id,
                'name' => $asset->name,
                'svg' => $asset->svg,
                'createdAt' => $asset->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $assets]);
    }

    public function destroy(int $id): JsonResponse
    {
        $asset = IconAsset::query()->findOrFail($id);
        $asset->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }
}
