<?php

declare(strict_types=1);

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Очистка HTML правовых страниц по белому списку. Решение владельца 04.10.
 *
 * Текст этих страниц приходит из админки и вставляется на сайт как разметка.
 * Значит всё, что туда попало, выполняется в браузере посетителя: скрипт,
 * обработчик события, ссылка `javascript:`, рамка с чужим сайтом. Один
 * человек с правом править документы получает право выполнять свой код у
 * каждого, кто эти документы открывает.
 *
 * Белый список, а не чёрный: перечислить всё опасное нельзя — список
 * атрибутов-обработчиков пополняется с каждой версией браузера, а имена
 * вроде `onbeforetoggle` появляются позже, чем пишется чёрный список.
 * Перечислить же то немногое, что нужно договору, можно целиком.
 *
 * Сделан по образцу `Modules\Media\Services\SvgIconSanitizer`: там тот же
 * подход для загружаемых значков. Второго механизма не заводим — заводим
 * второй список для другого вида содержимого.
 *
 * Чего он намеренно НЕ делает: не чинит вёрстку и не переписывает текст.
 * Узел не из списка удаляется вместе с тегом, но его текст остаётся — иначе
 * очистка молча выкидывала бы куски договора.
 */
final class LegalHtmlSanitizer
{
    /** Теги, нужные договору: заголовки, абзацы, списки, таблицы, выделение. */
    private const РАЗРЕШЁННЫЕ_ТЕГИ = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr', 'span', 'div',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'small',
        'blockquote', 'pre', 'code',
        'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
        'figure', 'figcaption', 'img',
    ];

    /** Атрибуты. `on*` сюда не попадает по построению — его просто нет в списке. */
    private const РАЗРЕШЁННЫЕ_АТРИБУТЫ = [
        'href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'id', 'lang', 'dir',
    ];

    /** Схемы ссылок. `javascript:` и `data:` отсутствуют намеренно. */
    private const РАЗРЕШЁННЫЕ_СХЕМЫ = ['http', 'https', 'mailto', 'tel'];

    /**
     * @return array{html: string, убрано_тегов: int, убрано_атрибутов: int, убрано: list<string>}
     */
    public function очистить(string $html): array
    {
        if (trim($html) === '') {
            return ['html' => '', 'убрано_тегов' => 0, 'убрано_атрибутов' => 0, 'убрано' => []];
        }

        $док = new DOMDocument('1.0', 'UTF-8');
        $былиОшибки = libxml_use_internal_errors(true);

        // Обёртка и явная кодировка: без них DOMDocument читает текст как
        // latin-1 и портит кириллицу, а без контейнера — добавляет свои
        // <html><body>, которые потом пришлось бы вырезать строкой.
        $док->loadHTML(
            '<?xml encoding="UTF-8"?><div id="корень">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($былиОшибки);

        $корень = $док->getElementById('корень') ?? $док->documentElement;

        if (! $корень instanceof DOMElement) {
            return ['html' => '', 'убрано_тегов' => 0, 'убрано_атрибутов' => 0, 'убрано' => []];
        }

        $счёт = ['теги' => 0, 'атрибуты' => 0, 'что' => []];
        $this->пройти($корень, $счёт);

        $итог = '';
        foreach (iterator_to_array($корень->childNodes) as $узел) {
            $итог .= $док->saveHTML($узел);
        }

        return [
            'html' => trim($итог),
            'убрано_тегов' => $счёт['теги'],
            'убрано_атрибутов' => $счёт['атрибуты'],
            'убрано' => array_values(array_unique($счёт['что'])),
        ];
    }

    /** @param array{теги: int, атрибуты: int, что: list<string>} $счёт */
    private function пройти(DOMNode $узел, array &$счёт): void
    {
        foreach (iterator_to_array($узел->childNodes) as $ребёнок) {
            if ($ребёнок instanceof DOMElement) {
                $имя = strtolower($ребёнок->localName ?? '');

                if (! in_array($имя, self::РАЗРЕШЁННЫЕ_ТЕГИ, true)) {
                    $счёт['теги']++;
                    $счёт['что'][] = '<'.$имя.'>';
                    $this->развернуть($ребёнок, $имя);

                    continue;
                }

                $this->почиститьАтрибуты($ребёнок, $счёт);
                $this->пройти($ребёнок, $счёт);

                continue;
            }

            if ($ребёнок->nodeType === XML_COMMENT_NODE) {
                $счёт['теги']++;
                $счёт['что'][] = '<!-- комментарий -->';
                $ребёнок->parentNode?->removeChild($ребёнок);
            }
        }
    }

    /**
     * Убрать тег, сохранив текст внутри.
     *
     * Исключение — `script` и `style`: их содержимое не текст договора, а
     * код, и вынести его в документ значило бы напечатать посетителю кусок
     * скрипта вместо того, чтобы убрать.
     */
    private function развернуть(DOMElement $узел, string $имя): void
    {
        $родитель = $узел->parentNode;

        if ($родитель === null) {
            return;
        }

        if (in_array($имя, ['script', 'style', 'iframe', 'object', 'embed'], true)) {
            $родитель->removeChild($узел);

            return;
        }

        while ($узел->firstChild !== null) {
            $родитель->insertBefore($узел->firstChild, $узел);
        }

        $родитель->removeChild($узел);
    }

    /** @param array{теги: int, атрибуты: int, что: list<string>} $счёт */
    private function почиститьАтрибуты(DOMElement $узел, array &$счёт): void
    {
        foreach (iterator_to_array($узел->attributes ?? []) as $атрибут) {
            $имя = strtolower($атрибут->nodeName);

            if (! in_array($имя, self::РАЗРЕШЁННЫЕ_АТРИБУТЫ, true)) {
                $счёт['атрибуты']++;
                $счёт['что'][] = $имя.'=';
                $узел->removeAttribute($атрибут->nodeName);

                continue;
            }

            if (($имя === 'href' || $имя === 'src') && ! $this->схемаРазрешена($атрибут->nodeValue ?? '')) {
                $счёт['атрибуты']++;
                $счёт['что'][] = $имя.'= со схемой не из списка';
                $узел->removeAttribute($атрибут->nodeName);
            }
        }

        // Внешняя ссылка не должна отдавать чужой странице доступ к нашей.
        if (strtolower($узел->localName ?? '') === 'a' && $узел->hasAttribute('href')) {
            $узел->setAttribute('rel', 'noopener noreferrer');
        }
    }

    private function схемаРазрешена(string $значение): bool
    {
        $значение = trim($значение);

        // Относительный путь и якорь — свои, схемы у них нет.
        if ($значение === '' || str_starts_with($значение, '/') || str_starts_with($значение, '#')) {
            return true;
        }

        $схема = strtolower((string) parse_url($значение, PHP_URL_SCHEME));

        if ($схема === '') {
            return true;
        }

        return in_array($схема, self::РАЗРЕШЁННЫЕ_СХЕМЫ, true);
    }
}
