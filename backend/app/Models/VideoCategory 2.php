<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VideoCategory extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'slug',
        'title',
        'sort_order',
    ];

    public function videos(): HasMany
    {
        return $this->hasMany(Video::class, 'category_id');
    }
}
