#!/usr/bin/env bash
set -euo pipefail

curl -sG 'https://modelizmclub.ru/api/v1/cities' --data-urlencode 'q=Са' \
  | php -r '$d=json_decode(stream_get_contents(STDIN), true)["data"] ?? []; echo count($d), PHP_EOL; foreach ($d as $c) { echo $c["name"], PHP_EOL; }'
