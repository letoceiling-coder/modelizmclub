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

    /*
    |--------------------------------------------------------------------------
    | Maximum comment nesting
    |--------------------------------------------------------------------------
    |
    | Two levels: a root comment and replies under it. The API flattens every
    | descendant into the root's `replies` anyway, and a third indent leaves no
    | readable text column at 375px — so the client posts a reply-to-a-reply
    | against the root with a leading «@имя» instead of nesting deeper.
    |
    */

    'max_comment_depth' => (int) env('FEED_MAX_COMMENT_DEPTH', 2),

];
