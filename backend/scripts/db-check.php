<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\DB;

$emails = ['dsc-23@yandex.ru', 'admin@modelizmclub.ru'];
foreach ($emails as $email) {
    $id = User::where('email', $email)->value('id');
    echo $email.': '.($id ?? 'null').PHP_EOL;
}

$counts = [
    'users' => DB::table('users')->count(),
    'posts' => DB::table('posts')->count(),
    'listings' => DB::table('listings')->count(),
    'communities' => DB::table('communities')->count(),
    'messages' => DB::table('messages')->count(),
    'post_categories' => DB::table('post_categories')->count(),
    'listing_categories' => DB::table('listing_categories')->count(),
    'cities' => DB::table('cities')->count(),
    'system_settings' => DB::table('system_settings')->count(),
];

echo json_encode($counts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE).PHP_EOL;
