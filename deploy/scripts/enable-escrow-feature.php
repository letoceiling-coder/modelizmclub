<?php

require __DIR__.'/../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

App\Models\SystemSetting::query()->updateOrCreate(
    ['key' => 'feature.escrow_enabled'],
    ['value' => ['enabled' => true], 'group' => 'features'],
);

echo "feature.escrow_enabled = true\n";
