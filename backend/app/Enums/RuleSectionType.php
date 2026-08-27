<?php

namespace App\Enums;

enum RuleSectionType: string
{
    case Intro = 'intro';
    case Section = 'section';
    case Requisites = 'requisites';
    case FooterNote = 'footer_note';
}
