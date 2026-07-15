<?php

namespace Modules\Media\Services;

use DOMDocument;
use DOMElement;
use Illuminate\Validation\ValidationException;

/**
 * Server-side sanitizer + tokenizer for admin-uploaded SVG icons
 * (backend-endpoints-needed.md §26). Security boundary: whitelists tags and
 * attributes, strips scripts/event handlers/external references, rejects
 * multicolor icons, and rewrites fill/stroke to `currentColor` so the icon
 * can be recolored via CSS tokens.
 */
class SvgIconSanitizer
{
    private const ALLOWED_TAGS = [
        'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line',
        'polyline', 'polygon', 'defs', 'title', 'desc',
    ];

    private const ALLOWED_ATTRS = [
        'viewbox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
        'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
        'stroke-dashoffset', 'fill-rule', 'clip-rule', 'opacity',
        'fill-opacity', 'stroke-opacity', 'd', 'cx', 'cy', 'r', 'rx', 'ry',
        'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'id',
    ];

    /** Values that do not count as a "visual color" when checking monochrome. */
    private const NEUTRAL_COLOR_VALUES = ['', 'none', 'currentcolor', 'transparent', 'inherit'];

    public function sanitize(string $raw): string
    {
        $raw = trim($raw);

        if ($raw === '' || mb_strlen($raw) > 524_288) {
            $this->fail('Файл не распознан как SVG.');
        }

        // XXE guard: reject any document with a DOCTYPE/entity declaration.
        if (preg_match('/<!(DOCTYPE|ENTITY)/i', $raw)) {
            $this->fail('SVG содержит недопустимые декларации.');
        }

        $doc = new DOMDocument();
        $loaded = @$doc->loadXML($raw, LIBXML_NONET | LIBXML_NOBLANKS);

        if (! $loaded || ! $doc->documentElement || strtolower($doc->documentElement->localName) !== 'svg') {
            $this->fail('Файл не распознан как SVG.');
        }

        // Gradients make the icon inherently multicolor — reject up front.
        foreach (['linearGradient', 'radialGradient', 'pattern'] as $tag) {
            if ($doc->getElementsByTagName($tag)->length > 0) {
                $this->fail('Иконка должна быть одноцветной (обнаружен градиент).');
            }
        }

        $this->stripDisallowedNodes($doc->documentElement);

        $colors = [];
        $this->collectColors($doc->documentElement, $colors);

        if (count($colors) > 1) {
            $this->fail('Иконка должна быть одноцветной (найдено несколько цветов).');
        }

        $this->tokenizeColors($doc->documentElement);

        // The root svg scales via CSS; fixed dimensions are dropped.
        $doc->documentElement->removeAttribute('width');
        $doc->documentElement->removeAttribute('height');

        if (! $doc->documentElement->hasAttribute('xmlns')) {
            $doc->documentElement->setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        $svg = $doc->saveXML($doc->documentElement);

        if (! is_string($svg) || $svg === '') {
            $this->fail('Не удалось обработать SVG.');
        }

        return $svg;
    }

    private function stripDisallowedNodes(DOMElement $root): void
    {
        $toRemove = [];

        /** @var \DOMNode $node */
        foreach (iterator_to_array($root->getElementsByTagName('*')) as $node) {
            if (! $node instanceof DOMElement) {
                continue;
            }

            if (! in_array(strtolower($node->localName), self::ALLOWED_TAGS, true)) {
                $toRemove[] = $node;
            }
        }

        foreach ($toRemove as $node) {
            $node->parentNode?->removeChild($node);
        }

        $this->stripDisallowedAttributes($root);

        foreach (iterator_to_array($root->getElementsByTagName('*')) as $node) {
            if ($node instanceof DOMElement) {
                $this->stripDisallowedAttributes($node);
            }
        }
    }

    private function stripDisallowedAttributes(DOMElement $element): void
    {
        $names = [];

        foreach (iterator_to_array($element->attributes) as $attr) {
            $names[] = $attr->nodeName;
        }

        foreach ($names as $name) {
            $lower = strtolower($name);

            // Namespaced attrs (xlink:href, xml:*) and event handlers are
            // never allowed; everything else must be whitelisted.
            if (str_starts_with($lower, 'on')
                || str_contains($lower, ':') && $lower !== 'xmlns'
                || ! in_array($lower, self::ALLOWED_ATTRS, true)) {
                $element->removeAttribute($name);
            }
        }
    }

    /** @param array<string, true> $colors */
    private function collectColors(DOMElement $root, array &$colors): void
    {
        $elements = array_merge([$root], iterator_to_array($root->getElementsByTagName('*')));

        foreach ($elements as $element) {
            if (! $element instanceof DOMElement) {
                continue;
            }

            foreach (['fill', 'stroke'] as $attr) {
                $value = strtolower(trim($element->getAttribute($attr)));

                if (! in_array($value, self::NEUTRAL_COLOR_VALUES, true)) {
                    $colors[$value] = true;
                }
            }
        }
    }

    private function tokenizeColors(DOMElement $root): void
    {
        $elements = array_merge([$root], iterator_to_array($root->getElementsByTagName('*')));

        foreach ($elements as $element) {
            if (! $element instanceof DOMElement) {
                continue;
            }

            foreach (['fill', 'stroke'] as $attr) {
                $value = strtolower(trim($element->getAttribute($attr)));

                if ($value !== '' && $value !== 'none' && $value !== 'currentcolor') {
                    $element->setAttribute($attr, 'currentColor');
                }
            }
        }
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['file' => [$message]]);
    }
}
