<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class Comment extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'commentable_type',
        'commentable_id',
        'user_id',
        'parent_id',
        'root_id',
        'depth',
        'body',
        'status',
        'reactions_count',
        'moderated_at',
    ];

    protected function casts(): array
    {
        return [
            'moderated_at' => 'datetime',
        ];
    }

    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function root(): BelongsTo
    {
        return $this->belongsTo(self::class, 'root_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('created_at');
    }

    public function mediaItems(): HasMany
    {
        return $this->hasMany(CommentMedia::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Attach every published descendant (any depth) as a flat `replies`
     * collection on each root, so a thread stays one visual branch.
     *
     * @param  Collection<int, self>  $roots
     */
    public static function attachPublishedThreadReplies(Collection $roots): void
    {
        $ids = $roots->pluck('id')->filter()->all();
        if ($ids === []) {
            return;
        }

        $byRoot = self::query()
            ->with(['author.profile.avatar', 'mediaItems.media'])
            ->whereIn('root_id', $ids)
            ->where('status', 'published')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('root_id');

        foreach ($roots as $root) {
            $thread = $byRoot->get($root->id, collect());
            foreach ($thread as $reply) {
                $reply->setRelation('replies', collect());
            }
            $root->setRelation('replies', $thread->values());
        }
    }
}
