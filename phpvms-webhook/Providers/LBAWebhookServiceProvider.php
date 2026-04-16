<?php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Event;

class LBAWebhookServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Fire webhook whenever a user model is saved with a discord_id
        \App\Models\User::updated(function ($user) {
            if ($user->isDirty('discord_id') && $user->discord_id) {
                (new \App\Listeners\DiscordLinkedListener())->handle($user);
            }
        });
    }
}
