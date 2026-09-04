#!/usr/bin/env bash
php -r "echo json_encode(['email'=>'crandimandi@gmail.com']);" | curl -sS -X POST https://api.modelizmclub.ru/api/v1/auth/forgot-password -H 'Content-Type: application/json' -H 'Accept: application/json' -d @-
