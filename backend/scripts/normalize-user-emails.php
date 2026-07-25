<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$count = DB::update('UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email))');
echo "normalized emails: {$count}\n";
