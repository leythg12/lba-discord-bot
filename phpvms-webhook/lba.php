<?php
/**
 * LBA config — add to config/lba.php on your phpVMS server
 * Then add to .env:
 *   LBA_DISCORD_WEBHOOK_URL=https://your-railway-app.railway.app/webhook/discord-linked
 *   LBA_DISCORD_WEBHOOK_SECRET=same_secret_as_bot_WEBHOOK_SECRET
 */
return [
    'discord_webhook_url'    => env('LBA_DISCORD_WEBHOOK_URL'),
    'discord_webhook_secret' => env('LBA_DISCORD_WEBHOOK_SECRET'),
];
