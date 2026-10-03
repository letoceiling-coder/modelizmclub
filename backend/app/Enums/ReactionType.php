<?php

namespace App\Enums;

/**
 * Допустимые значения реакции — один список, а не три.
 *
 * ЧТО БЫЛО. До 03.10 тип реакции не ограничивался нигде: ни правила, ни
 * приведения, ни списка значений. `PostReactionController` брал
 * `$request->string('type', 'like')` и отдавал в `firstOrCreate`, тот писал
 * в `post_reactions.type varchar(32)`. Из этого выходило два следствия:
 *
 *   1. Любой вошедший заводил реакцию произвольного типа, и она отрисовывалась
 *      всем, кто открывал запись.
 *   2. Строка длиннее колонки доходила до `INSERT`, Postgres отвечал
 *      `value too long for type character varying(32)`, а человек получал
 *      500 вместо 422. У комментариев колонка `varchar(16)` — порог ещё ниже.
 *
 * `VideoService::react` от этого был закрыт, но иначе: неизвестный тип он
 * молча подменял на `like`. Молчание тоже убрано — «lke» теперь 422, а не
 * тихое одобрение.
 *
 * ПОЧЕМУ СПИСКИ РАЗНЫЕ. На боевой базе 03.10: у записей 650 реакций, все
 * `like`; у комментариев 17, все `like`; у обзоров 3 `like` и 2 `dislike`.
 * То есть «не нравится» умеет только обзор — так это и описано ниже, вместо
 * одного общего списка, который разрешил бы `dislike` там, где его никто
 * никогда не ставил и где интерфейс его не показывает.
 */
enum ReactionType: string
{
    case Like = 'like';
    case Dislike = 'dislike';

    /**
     * Запись и комментарий: только одобрение.
     *
     * @return list<string>
     */
    public static function forContent(): array
    {
        return [self::Like->value];
    }

    /**
     * Обзор: и одобрение, и отказ — у него под них два счётчика.
     *
     * @return list<string>
     */
    public static function forVideo(): array
    {
        return [self::Like->value, self::Dislike->value];
    }
}
