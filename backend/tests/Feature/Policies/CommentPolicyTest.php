<?php

namespace Tests\Feature\Policies;

use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentPolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_author_deletes_own_comment(): void
    {
        $author = $this->seedUser('author');
        $comment = $this->seedComment($this->seedPost($this->seedUser('poster')), $author);

        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/v1/comments/{$comment->uuid}")
            ->assertOk();
    }

    public function test_moderator_deletes_any_comment(): void
    {
        $comment = $this->seedComment($this->seedPost($this->seedUser('poster')), $this->seedUser('author'));

        $this->actingAs($this->seedUser('mod', UserRole::Moderator), 'sanctum')
            ->deleteJson("/api/v1/comments/{$comment->uuid}")
            ->assertOk();
    }

    public function test_stranger_cannot_delete_comment(): void
    {
        $comment = $this->seedComment($this->seedPost($this->seedUser('poster')), $this->seedUser('author'));

        $this->actingAs($this->seedUser('other'), 'sanctum')
            ->deleteJson("/api/v1/comments/{$comment->uuid}")
            ->assertForbidden();
    }

    public function test_guest_cannot_delete_comment(): void
    {
        $comment = $this->seedComment($this->seedPost($this->seedUser('poster')), $this->seedUser('author'));

        $this->deleteJson("/api/v1/comments/{$comment->uuid}")->assertUnauthorized();
    }

    public function test_any_member_may_react_to_published_comment(): void
    {
        $comment = $this->seedComment($this->seedPost($this->seedUser('poster')), $this->seedUser('author'));

        $this->actingAs($this->seedUser('reader'), 'sanctum')
            ->postJson("/api/v1/comments/{$comment->uuid}/react", ['type' => 'like'])
            ->assertOk();
    }

    public function test_comment_list_carries_can_flags(): void
    {
        $poster = $this->seedUser('poster');
        $author = $this->seedUser('author');
        $post = $this->seedPost($poster);
        $this->seedComment($post, $author);

        $this->actingAs($author, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}/comments")
            ->assertOk()
            ->assertJsonPath('data.0.can.edit', true)
            ->assertJsonPath('data.0.can.delete', true);

        $this->actingAs($this->seedUser('reader'), 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}/comments")
            ->assertOk()
            ->assertJsonPath('data.0.can.edit', false)
            ->assertJsonPath('data.0.can.react', true);
    }

    public function test_post_carries_can_block(): void
    {
        $poster = $this->seedUser('poster');
        $post = $this->seedPost($poster);

        $this->actingAs($poster, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.edit', true)
            ->assertJsonPath('data.can.delete', true)
            ->assertJsonPath('data.can.react', true)
            ->assertJsonPath('data.can.comment', true);

        $this->actingAs($this->seedUser('reader'), 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.edit', false)
            ->assertJsonPath('data.can.comment', true);
    }
}
