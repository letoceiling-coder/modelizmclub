<?php

namespace App\Enums;

enum LegalPageStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
