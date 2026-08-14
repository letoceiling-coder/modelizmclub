<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Console\Command;
use Modules\Admin\Services\UserFullDeletionService;

class PurgeUserCommand extends Command
{
    protected $signature = 'user:purge
        {identifier : User email or UUID}
        {--force : Skip confirmation prompt}';

    protected $description = 'Permanently delete a user and all related data from the database.';

    public function handle(UserFullDeletionService $deletion): int
    {
        $identifier = trim($this->argument('identifier'));

        $user = User::withTrashed()
            ->when(
                str_contains($identifier, '@'),
                fn ($q) => $q->whereRaw('LOWER(email) = ?', [strtolower($identifier)]),
                fn ($q) => $q->where('uuid', $identifier),
            )
            ->first();

        if (! $user) {
            $this->error("User not found: {$identifier}");

            return self::FAILURE;
        }

        if ($user->role === UserRole::Admin && $this->otherActiveAdminsCount($user) === 0) {
            $this->error('Cannot purge the last active superadmin.');

            return self::FAILURE;
        }

        $this->warn("Will permanently delete user #{$user->id} ({$user->email}).");

        if (! $this->option('force') && ! $this->confirm('Continue?')) {
            return self::SUCCESS;
        }

        $deletion->purge($user);

        $this->info("User {$user->email} permanently deleted.");

        return self::SUCCESS;
    }

    private function otherActiveAdminsCount(User $user): int
    {
        return User::query()
            ->where('role', UserRole::Admin)
            ->where('status', UserStatus::Active)
            ->where('id', '!=', $user->id)
            ->count();
    }
}
