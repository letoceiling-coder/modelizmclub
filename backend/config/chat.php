<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Message encryption at rest
    |--------------------------------------------------------------------------
    |
    | When enabled, message bodies are encrypted with the application key
    | before being written to the database (Message::body uses the
    | App\Casts\EncryptedText cast). Decryption on read is automatic and
    | transparently falls back to plaintext for rows written before the
    | feature was turned on, so it can be enabled safely at any time.
    |
    | Transport is already protected by TLS (HTTPS + WSS); this adds
    | protection for data held in the database and backups.
    |
    */

    'encrypt_messages' => (bool) env('CHAT_ENCRYPT_MESSAGES', false),

];
