<?php
namespace App\Listeners;

use App\Events\UserStateChanged;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DiscordLinkedListener
{
    public function handle($event): void
    {
        // Only fire when a Discord ID is set/updated
        $user = $event->user ?? $event;
        if (!$user || !$user->discord_id) return;

        $webhookUrl    = config('lba.discord_webhook_url');
        $webhookSecret = config('lba.discord_webhook_secret');

        if (!$webhookUrl) return;

        $payload = json_encode([
            'event'      => 'discord.linked',
            'discord_id' => (string) $user->discord_id,
            'user_id'    => $user->id,
            'pilot_id'   => $user->pilot_id,
        ]);

        $signature = 'sha256=' . hash_hmac('sha256', $payload, $webhookSecret);

        try {
            Http::withHeaders([
                'Content-Type'    => 'application/json',
                'X-LBA-Signature' => $signature,
            ])->timeout(5)->post($webhookUrl, json_decode($payload, true));

            Log::info('[LBA] Discord webhook fired for user '.$user->id);
        } catch (\Exception $e) {
            Log::error('[LBA] Discord webhook failed: '.$e->getMessage());
        }
    }
}
