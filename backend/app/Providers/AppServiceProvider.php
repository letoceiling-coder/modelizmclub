<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Clients\YooKassaClient;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Services\PaymentFulfillmentService;
use Modules\Billing\Services\PaymentGatewayManager;
use Modules\Billing\Services\PaymentRecorder;
use Modules\Billing\Services\StubPaymentGateway;
use Modules\Billing\Services\VtbPaymentGateway;
use Modules\Billing\Services\YooKassaPaymentGateway;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentRecorder::class);
        $this->app->singleton(PaymentFulfillmentService::class);
        $this->app->singleton(VtbAcquiringClient::class);
        $this->app->singleton(YooKassaClient::class);
        $this->app->singleton(VtbPaymentGateway::class);
        $this->app->singleton(YooKassaPaymentGateway::class);
        $this->app->singleton(StubPaymentGateway::class);
        $this->app->singleton(PaymentGatewayManager::class);

        $this->app->bind(
            PaymentGateway::class,
            PaymentGatewayManager::class,
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Broadcast::routes(['middleware' => ['auth:sanctum'], 'prefix' => 'api/v1']);

        // This is an API-only backend: the password-reset link must point at the
        // SPA reset page, not a (non-existent) `password.reset` web route — otherwise
        // the default ResetPassword notification throws RouteNotFoundException.
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $base = rtrim((string) config('app.frontend_url'), '/');

            return $base.'/reset-password?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });

        // Constrain every {uuid} route param to the canonical UUID shape. A
        // malformed identifier otherwise reaches a Postgres uuid-column query and
        // surfaces as a 500 ("invalid input syntax for type uuid"); with the
        // pattern it simply fails to match the route and returns a clean 404.
        \Illuminate\Support\Facades\Route::pattern('uuid', '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');

        RateLimiter::for('auth-register', fn (Request $request) => Limit::perMinute(3)->by($request->ip()));
        RateLimiter::for('auth-verify', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('auth-login', fn (Request $request) => Limit::perMinute(5)->by($request->ip().'|'.$request->input('email')));

        // Global API limiter. The media proxy (image loads) and payment webhooks
        // are exempt so normal browsing and provider callbacks are never throttled.
        RateLimiter::for('api', function (Request $request) {
            if ($request->is('api/v1/media/*') || $request->is('api/v1/payments/webhooks/*') || $request->is('api/v1/health')) {
                return Limit::none();
            }

            return $request->user()
                ? Limit::perMinute(300)->by('u:'.$request->user()->id)
                : Limit::perMinute(120)->by('ip:'.$request->ip());
        });

        Gate::define('viewApiDocs', function () {
            if (app()->environment(['local', 'development', 'staging'])) {
                return true;
            }

            return in_array(request()->getHost(), [
                'dev.modelizmclub.ru',
                'api.modelizmclub.ru',
            ], true);
        });

        Scramble::configure()
            ->routes(fn (Route $route) => Str::startsWith($route->uri, 'api/'))
            ->withDocumentTransformers(function (OpenApi $openApi): void {
                $openApi->secure(
                    SecurityScheme::http('bearer', 'Sanctum'),
                );
            });
    }
}
