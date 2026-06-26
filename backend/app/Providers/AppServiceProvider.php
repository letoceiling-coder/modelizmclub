<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\Modules\Billing\Services\PaymentRecorder::class);
        $this->app->singleton(\Modules\Billing\Services\PaymentFulfillmentService::class);
        $this->app->singleton(\Modules\Billing\Clients\VtbAcquiringClient::class);
        $this->app->singleton(\Modules\Billing\Clients\YooKassaClient::class);
        $this->app->singleton(\Modules\Billing\Services\VtbPaymentGateway::class);
        $this->app->singleton(\Modules\Billing\Services\YooKassaPaymentGateway::class);
        $this->app->singleton(\Modules\Billing\Services\StubPaymentGateway::class);
        $this->app->singleton(\Modules\Billing\Services\PaymentGatewayManager::class);

        $this->app->bind(
            \Modules\Billing\Contracts\PaymentGateway::class,
            \Modules\Billing\Services\PaymentGatewayManager::class,
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Broadcast::routes(['middleware' => ['auth:sanctum'], 'prefix' => 'api/v1']);

        RateLimiter::for('auth-register', fn (Request $request) => Limit::perMinute(3)->by($request->ip()));
        RateLimiter::for('auth-verify', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('auth-login', fn (Request $request) => Limit::perMinute(5)->by($request->ip().'|'.$request->input('email')));

        Gate::define('viewApiDocs', fn () => app()->environment(['local', 'development', 'staging']));

        Scramble::configure()
            ->routes(fn (Route $route) => Str::startsWith($route->uri, 'api/'))
            ->withDocumentTransformers(function (OpenApi $openApi): void {
                $openApi->secure(
                    SecurityScheme::http('bearer', 'Sanctum'),
                );
            });
    }
}
