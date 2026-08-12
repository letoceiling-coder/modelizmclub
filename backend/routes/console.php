<?php

use Illuminate\Support\Facades\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('notifications:prune')->daily();
Schedule::command('posts:publish-scheduled')->everyMinute();
Schedule::command('videos:publish-scheduled')->everyMinute();
Schedule::command('communities:sync-counters')->daily();
