<?php

$user = getenv('VTB_USER') ?: 'modelizmclub-api';
$pass = getenv('VTB_PASS') ?: 'modelizmclub';
$api = rtrim(getenv('VTB_API') ?: 'https://vtb.rbsuat.com/payment/rest', '/').'/';

$params = [
    'userName' => $user,
    'password' => $pass,
    'orderNumber' => 'smoke-'.time(),
    'amount' => 10000,
    'returnUrl' => 'https://modelizmclub.ru/',
    'currency' => 643,
];

$ch = curl_init($api.'registerPreAuth.do');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query($params),
    CURLOPT_TIMEOUT => 30,
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP {$code}\n{$body}\n";
