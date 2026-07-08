<?php

use Illuminate\Support\Facades\Route;
use Modules\Delivery\Http\Controllers\Api\V1\CancelShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\CdekCitiesController;
use Modules\Delivery\Http\Controllers\Api\V1\CdekOrderStatusWebhookController;
use Modules\Delivery\Http\Controllers\Api\V1\CdekPickupPointsController;
use Modules\Delivery\Http\Controllers\Api\V1\CdekQuoteController;
use Modules\Delivery\Http\Controllers\Api\V1\ConfirmShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\DestroySellerDeliveryProfileController;
use Modules\Delivery\Http\Controllers\Api\V1\IndexSellerDeliveryProfileController;
use Modules\Delivery\Http\Controllers\Api\V1\IndexShipmentsController;
use Modules\Delivery\Http\Controllers\Api\V1\QuoteShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\RequestShipmentSellerController;
use Modules\Delivery\Http\Controllers\Api\V1\ShowShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\StoreSellerDeliveryProfileController;
use Modules\Delivery\Http\Controllers\Api\V1\StoreShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\SyncShipmentStatusController;
use Modules\Delivery\Http\Controllers\Api\V1\UpdateSellerDeliveryProfileController;
use Modules\Delivery\Http\Controllers\Api\V1\UpdateShipmentController;
use Modules\Delivery\Http\Controllers\Api\V1\YandexDeliveryStatusWebhookController;
use Modules\Delivery\Http\Controllers\Api\V1\YandexDetectLocationController;
use Modules\Delivery\Http\Controllers\Api\V1\YandexPickupPointsController;
use Modules\Delivery\Http\Controllers\Api\V1\YandexQuoteController;

Route::prefix('webhooks')->group(function (): void {
    Route::post('cdek/order-status', CdekOrderStatusWebhookController::class);
    Route::post('yandex/delivery-status', YandexDeliveryStatusWebhookController::class);
});

Route::prefix('delivery')->group(function (): void {
    Route::prefix('cdek')->group(function (): void {
        Route::get('pickup-points', CdekPickupPointsController::class);
        Route::get('cities', CdekCitiesController::class);
        Route::post('quote', CdekQuoteController::class);
    });

    Route::prefix('yandex')->group(function (): void {
        Route::get('pickup-points', YandexPickupPointsController::class);
        Route::post('location/detect', YandexDetectLocationController::class);
        Route::post('quote', YandexQuoteController::class);
    });
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('users/me/delivery-profile', IndexSellerDeliveryProfileController::class);
    Route::post('users/me/delivery-profile', StoreSellerDeliveryProfileController::class);
    Route::patch('users/me/delivery-profile/{seller_delivery_profile}', UpdateSellerDeliveryProfileController::class)->whereNumber('seller_delivery_profile');
    Route::delete('users/me/delivery-profile/{seller_delivery_profile}', DestroySellerDeliveryProfileController::class)->whereNumber('seller_delivery_profile');

    Route::get('shipments', IndexShipmentsController::class);
    Route::post('shipments', StoreShipmentController::class);
    Route::get('shipments/{shipment}', ShowShipmentController::class);
    Route::patch('shipments/{shipment}', UpdateShipmentController::class);
    Route::post('shipments/{shipment}/quote', QuoteShipmentController::class);
    Route::post('shipments/{shipment}/request-seller', RequestShipmentSellerController::class);
    Route::post('shipments/{shipment}/confirm', ConfirmShipmentController::class);
    Route::post('shipments/{shipment}/cancel', CancelShipmentController::class);
    Route::post('shipments/{shipment}/sync', SyncShipmentStatusController::class);
});
