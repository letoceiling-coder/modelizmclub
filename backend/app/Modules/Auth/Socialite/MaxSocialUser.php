<?php

namespace Modules\Auth\Socialite;

use Laravel\Socialite\Contracts\User as SocialiteUser;

/** Adapter so OAuthService can persist a MAX bot profile. */
class MaxSocialUser implements SocialiteUser
{
    public ?string $token = null;

    public ?string $refreshToken = null;

    public ?int $expiresIn = null;

    /** @param  array<string, mixed>  $raw */
    public function __construct(private readonly array $raw) {}

    public function getId(): string
    {
        return (string) ($this->raw['user_id'] ?? $this->raw['id'] ?? '');
    }

    public function getNickname(): ?string
    {
        $username = $this->raw['username'] ?? null;

        return is_string($username) && $username !== '' ? $username : null;
    }

    public function getName(): ?string
    {
        $first = trim((string) ($this->raw['first_name'] ?? ''));
        $last = trim((string) ($this->raw['last_name'] ?? ''));
        $combined = trim($first.' '.$last);
        if ($combined !== '') {
            return $combined;
        }

        $name = $this->raw['name'] ?? null;

        return is_string($name) && $name !== '' ? $name : ($this->getNickname() ?: 'Пользователь');
    }

    public function getEmail(): ?string
    {
        $email = $this->raw['email'] ?? null;

        return is_string($email) && $email !== '' ? $email : null;
    }

    public function getAvatar(): ?string
    {
        $avatar = $this->raw['avatar'] ?? $this->raw['photo_url'] ?? null;

        return is_string($avatar) && $avatar !== '' ? $avatar : null;
    }

    /** @return array<string, mixed> */
    public function getRaw(): array
    {
        return $this->raw;
    }
}
