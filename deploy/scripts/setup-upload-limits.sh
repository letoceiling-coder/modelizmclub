#!/usr/bin/env bash
# Raise PHP/nginx upload limits for review_video (up to 200 MB).
set -euo pipefail

PHP_INI="/etc/php/8.3/fpm/php.ini"
NGINX_API="/etc/nginx/sites-enabled/api.modelizmclub.ru.conf"
NGINX_SITE="/etc/nginx/sites-enabled/modelizmclub.ru"

for f in "$PHP_INI"; do
  if [[ -f "$f" ]]; then
    sed -i 's/^upload_max_filesize = .*/upload_max_filesize = 220M/' "$f"
    sed -i 's/^post_max_size = .*/post_max_size = 220M/' "$f"
    echo "Updated $f"
  fi
done

for f in "$NGINX_API" "$NGINX_SITE"; do
  if [[ -f "$f" ]]; then
    if grep -q 'client_max_body_size' "$f"; then
      sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 220M;/g' "$f"
    else
      sed -i '/server {/a \    client_max_body_size 220M;' "$f"
    fi
    echo "Updated $f"
  fi
done

nginx -t
systemctl reload nginx
systemctl reload php8.3-fpm
echo "Upload limits OK: $(date -Iseconds)"
