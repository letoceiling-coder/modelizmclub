# Lighthouse: как повторить замер

Полные отчёты (12 файлов, 5 МБ) в репозиторий не кладутся — в истории они
остались бы навсегда, а ценность в числах, а не в блобах. Числа каждого
прогона — в `lighthouse-baseline-2026-10-04.json`.

Повторить ровно тем же способом:

```bash
for p in "root:/" "feed:/feed" "ads:/ads" "ad:/ads/lego-mindstorms-ev3-31313"; do
  name="${p%%:*}"; path="${p#*:}"
  for i in 1 2 3; do
    lighthouse "https://modelizmclub.ru${path}" \
      --quiet --chrome-flags=--headless=new --only-categories=performance \
      --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate \
      --output=json --output-path="lighthouse/${name}-${i}.json"
  done
done
```

Медиана трёх прогонов — в `../BASELINE.md`, раздел 6.

Абсолютные числа зависят от канала машины, с которой снимали. Сравнение
«было / стало» имеет смысл только при замере тем же способом и желательно
в том же сеансе.
