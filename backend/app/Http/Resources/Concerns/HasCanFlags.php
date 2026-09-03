<?php

namespace App\Http\Resources\Concerns;

use App\Models\User;

/**
 * `'can' => $this->canFlags($request->user(), ['edit' => 'update', 'delete'])`
 * — one boolean per ability, resolved through the model's policy, so the
 * client renders only the actions this viewer may actually take.
 */
trait HasCanFlags
{
    /**
     * @param  array<int|string, string>  $abilities  list of abilities, or alias => ability
     * @return array<string, bool>
     */
    protected function canFlags(?User $user, array $abilities): array
    {
        $flags = [];
        foreach ($abilities as $key => $ability) {
            $name = is_string($key) ? $key : $ability;
            $flags[$name] = $user ? $user->can($ability, $this->resource) : false;
        }

        return $flags;
    }
}
