<?php

use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class);

    require base_path('app/Modules/Auth/routes/api.php');
    require base_path('app/Modules/User/routes/api.php');
    require base_path('app/Modules/Catalog/routes/api.php');
    require base_path('app/Modules/Community/routes/api.php');
    require base_path('app/Modules/Channel/routes/api.php');
    require base_path('app/Modules/Call/routes/api.php');
    require base_path('app/Modules/Feed/routes/api.php');
    require base_path('app/Modules/Media/routes/api.php');
    require base_path('app/Modules/Billing/routes/api.php');
    require base_path('app/Modules/Chat/routes/api.php');
    require base_path('app/Modules/Listing/routes/api.php');
    require base_path('app/Modules/PublicContent/routes/api.php');
    require base_path('app/Modules/Report/routes/api.php');
    require base_path('app/Modules/Admin/routes/api.php');
});
