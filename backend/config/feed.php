<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Auto-publish posts after submit for moderation
    |--------------------------------------------------------------------------
    |
    | When true, posts skip the moderation queue and go straight to published.
    | Useful on local/dev. Production should keep this false.
    |
    */

    'auto_publish' => (bool) env('FEED_AUTO_PUBLISH', false),

    'max_comment_depth' => (int) env('FEED_MAX_COMMENT_DEPTH', 5),

];
