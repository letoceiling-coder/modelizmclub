<?php

namespace App\Enums;

enum ConsentType: string
{
    case Terms = 'terms';
    case Privacy = 'privacy';
    case Ads = 'ads';
    case Cookies = 'cookies';
}
