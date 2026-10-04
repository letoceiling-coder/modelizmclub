<?php

namespace Modules\Admin\Http\Requests;

use App\Support\LegalHtmlSanitizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertLegalPageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'slug' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9-]+$/',
                Rule::unique('legal_pages', 'slug')->ignore($id),
            ],
            'title' => ['required', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:320'],
            'content_html' => ['required_without:content_md', 'nullable', 'string'],
            'content_md' => ['nullable', 'string'],
            /*
             * Видео страницы. Пустая строка и null означают «снять»,
             * отсутствие ключа — «не трогать»: админка шлёт страницу
             * целиком, и без этого различия любое сохранение текста
             * снимало бы запись.
             */
            'video_media_uuid' => ['sometimes', 'nullable', 'string', 'uuid', 'exists:media,uuid'],
        ];
    }

    /**
     * Разметка чистится по белому списку до сохранения. Решение владельца 04.10.
     *
     * Текст правовых страниц приходит отсюда и вставляется на сайт как
     * разметка. Значит всё, что сюда попало, выполняется в браузере
     * посетителя: скрипт, обработчик события, ссылка `javascript:`, рамка с
     * чужим сайтом. Один человек с правом править документы иначе получает
     * право выполнять свой код у каждого, кто их открывает.
     *
     * Чистим здесь, а не при показе: при показе пришлось бы чистить в
     * каждом месте, где страница читается, — а их несколько, и первое же
     * забытое стало бы дырой. В базе должно лежать то, что безопасно отдать.
     *
     * Проверка на пяти боевых страницах 05.10: удалено ноль тегов и один
     * атрибут `target`. То есть это сторож от будущего ввода, а не починка
     * существующего — и говорить иначе было бы неправдой.
     *
     * Чистится в `validated()`, а не в `passedValidation()`. Первая редакция
     * делала `merge()` в `passedValidation()` — и не работала вовсе: контроллер
     * читает `validated()`, а тот отдаёт данные, отобранные правилами, и
     * подмену входа не видит. Поймала проверка, сохранявшая страницу через
     * админку; без неё правка существовала бы только на бумаге.
     */
    public function validated($key = null, $default = null): mixed
    {
        $данные = parent::validated();

        if (is_array($данные) && isset($данные['content_html']) && is_string($данные['content_html']) && trim($данные['content_html']) !== '') {
            $данные['content_html'] = app(LegalHtmlSanitizer::class)->очистить($данные['content_html'])['html'];
        }

        if ($key !== null) {
            return data_get($данные, $key, $default);
        }

        return $данные;
    }
}
