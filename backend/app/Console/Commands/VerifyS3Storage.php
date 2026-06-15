<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VerifyS3Storage extends Command
{
    protected $signature = 'storage:verify-s3';

    protected $description = 'Verify Selectel S3 connectivity by writing and reading a test object';

    public function handle(): int
    {
        $disk = Storage::disk('s3');
        $path = 'temp/health-check-'.Str::uuid().'.txt';
        $payload = 'modelizmclub-s3-ok-'.now()->toIso8601String();

        try {
            $disk->put($path, $payload);
            $read = $disk->get($path);
            $disk->delete($path);
        } catch (\Throwable $e) {
            $this->error('S3 check failed: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($read !== $payload) {
            $this->error('S3 read/write mismatch');

            return self::FAILURE;
        }

        $this->info('S3 OK: bucket '.config('filesystems.disks.s3.bucket'));

        return self::SUCCESS;
    }
}
