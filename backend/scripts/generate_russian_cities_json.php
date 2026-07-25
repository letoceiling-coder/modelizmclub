<?php

/**
 * Build backend/database/data/russian_cities.json from russian_towns.csv
 * (epogrebnyak/ru-cities, CC BY 4.0 — Rosstat city list + Wikipedia).
 *
 * Usage: php backend/scripts/generate_russian_cities_json.php
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$csvPath = $root.'/database/data/russian_towns.csv';
$outPath = $root.'/database/data/russian_cities.json';

/** Preserve stable slugs already used in production listings/seeds. */
$legacySlugs = [
    'Москва' => 'moscow',
    'Санкт-Петербург' => 'saint-petersburg',
    'Новосибирск' => 'novosibirsk',
    'Екатеринбург' => 'yekaterinburg',
    'Казань' => 'kazan',
    'Нижний Новгород' => 'nizhny-novgorod',
    'Челябинск' => 'chelyabinsk',
    'Красноярск' => 'krasnoyarsk',
    'Самара' => 'samara',
    'Уфа' => 'ufa',
    'Ростов-на-Дону' => 'rostov-on-don',
    'Омск' => 'omsk',
    'Краснодар' => 'krasnodar',
    'Воронеж' => 'voronezh',
    'Пермь' => 'perm',
    'Волгоград' => 'volgograd',
    'Саратов' => 'saratov',
    'Тюмень' => 'tyumen',
    'Тольятти' => 'tolyatti',
    'Ижевск' => 'izhevsk',
    'Барнаул' => 'barnaul',
    'Ульяновск' => 'ulyanovsk',
    'Иркутск' => 'irkutsk',
    'Хабаровск' => 'khabarovsk',
    'Ярославль' => 'yaroslavl',
    'Владивосток' => 'vladivostok',
    'Махачкала' => 'makhachkala',
    'Томск' => 'tomsk',
    'Оренбург' => 'orenburg',
    'Кемерово' => 'kemerovo',
    'Новокузнецк' => 'novokuznetsk',
    'Рязань' => 'ryazan',
    'Астрахань' => 'astrakhan',
    'Пенза' => 'penza',
    'Липецк' => 'lipetsk',
    'Тула' => 'tula',
    'Киров' => 'kirov',
    'Чебоксары' => 'cheboksary',
    'Калининград' => 'kaliningrad',
    'Брянск' => 'bryansk',
    'Иваново' => 'ivanovo',
    'Магнитогорск' => 'magnitogorsk',
    'Курск' => 'kursk',
    'Тверь' => 'tver',
    'Ставрополь' => 'stavropol',
    'Нижний Тагил' => 'nizhny-tagil',
    'Белгород' => 'belgorod',
    'Архангельск' => 'arkhangelsk',
    'Владимир' => 'vladimir',
    'Сочи' => 'sochi',
    'Курган' => 'kurgan',
    'Смоленск' => 'smolensk',
    'Саранск' => 'saransk',
    'Салават' => 'salavat',
    'Владикавказ' => 'vladikavkaz',
    'Чита' => 'chita',
    'Калуга' => 'kaluga',
    'Орёл' => 'oryol',
    'Стерлитамак' => 'sterlitamak',
    'Грозный' => 'grozny',
    'Мурманск' => 'murmansk',
    'Тамбов' => 'tambov',
    'Петрозаводск' => 'petrozavodsk',
    'Кострома' => 'kostroma',
    'Набережные Челны' => 'naberezhnye-chelny',
    'Нижневартовск' => 'nizhnevartovsk',
    'Йошкар-Ола' => 'yoshkar-ola',
    'Благовещенск' => 'blagoveshchensk',
    'Северодвинск' => 'severodvinsk',
    'Подольск' => 'podolsk',
    'Севастополь' => 'sevastopol',
    'Симферополь' => 'simferopol',
];

function transliterateSlug(string $text): string
{
    $map = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'yo',
        'ж' => 'zh', 'з' => 'z', 'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm',
        'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u',
        'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shch',
        'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        'А' => 'a', 'Б' => 'b', 'В' => 'v', 'Г' => 'g', 'Д' => 'd', 'Е' => 'e', 'Ё' => 'yo',
        'Ж' => 'zh', 'З' => 'z', 'И' => 'i', 'Й' => 'y', 'К' => 'k', 'Л' => 'l', 'М' => 'm',
        'Н' => 'n', 'О' => 'o', 'П' => 'p', 'Р' => 'r', 'С' => 's', 'Т' => 't', 'У' => 'u',
        'Ф' => 'f', 'Х' => 'kh', 'Ц' => 'ts', 'Ч' => 'ch', 'Ш' => 'sh', 'Щ' => 'shch',
        'Ъ' => '', 'Ы' => 'y', 'Ь' => '', 'Э' => 'e', 'Ю' => 'yu', 'Я' => 'ya',
    ];

    $text = strtr($text, $map);
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    $text = trim($text, '-');

    return $text !== '' ? $text : 'city';
}

if (! is_readable($csvPath)) {
    fwrite(STDERR, "Missing CSV: {$csvPath}\n");
    exit(1);
}

$handle = fopen($csvPath, 'rb');
if ($handle === false) {
    fwrite(STDERR, "Cannot open CSV\n");
    exit(1);
}

$header = fgetcsv($handle);
if ($header === false) {
    fwrite(STDERR, "Empty CSV\n");
    exit(1);
}

$rows = [];
while (($row = fgetcsv($handle)) !== false) {
    if (count($row) < 5) {
        continue;
    }
    $name = trim($row[0]);
    $population = (float) $row[1];
    $region = trim($row[4]);
    if ($name === '' || $region === '') {
        continue;
    }
    $rows[] = [
        'name' => $name,
        'region' => $region,
        'population' => $population,
    ];
}
fclose($handle);

usort($rows, static fn (array $a, array $b): int => $b['population'] <=> $a['population']);

$usedSlugs = [];
$cities = [];
foreach ($rows as $index => $row) {
    $name = $row['name'];
    $region = $row['region'];
    $slug = $legacySlugs[$name] ?? transliterateSlug($name.'-'.$region);
    $base = $slug;
    $suffix = 2;
    while (isset($usedSlugs[$slug])) {
        $slug = $base.'-'.$suffix;
        $suffix++;
    }
    $usedSlugs[$slug] = true;

    $cities[] = [
        'name' => $name,
        'region' => $region,
        'slug' => $slug,
        'sort_order' => $index + 1,
    ];
}

$json = json_encode($cities, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false) {
    fwrite(STDERR, "JSON encode failed\n");
    exit(1);
}

file_put_contents($outPath, $json.PHP_EOL);
fwrite(STDOUT, 'Wrote '.count($cities)." cities to {$outPath}\n");
