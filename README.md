# LBA Discord Bot v3 — OAuth2 Verification

## How verification works
1. Pilot clicks "Vérifier mon compte" in Discord
2. Bot sends them link to newhorisons.com/login
3. Pilot logs in with Discord OAuth (already configured)
4. phpVMS saves their Discord ID → fires webhook to bot
5. Bot assigns rank + hub roles instantly

---

## Bot Setup

### 1. Discord Developer Portal
- Go to discord.com/developers/applications → your app
- Bot → copy Token
- OAuth2 → URL Generator → scopes: `bot` + `applications.commands`
- Permissions: `Manage Roles`, `Manage Nicknames`, `Send Messages`, `Embed Links`
- Invite bot to server

### 2. Create Discord Roles (top to bottom order)
```
[LBA BOT]            ← auto-created, must be above all managed roles
Chief Pilot
Senior Captain
Captain
Senior First Officer
First Officer
Second Officer
Student Pilot
Hub LFBD
Hub LFPG
Pilote LBA
Non vérifié
```

### 3. Create Discord Channels
```
#bienvenue     ← welcome messages
#verification  ← verification panel (run /setup-verify here)
#pireps        ← auto PIREPs
#annonces      ← auto news
#logs-bot      ← bot activity log
```

### 4. Configure .env
Copy .env.example → .env and fill everything in.
Enable Developer Mode in Discord (Settings → Advanced) then right-click roles/channels to copy IDs.

### 5. Deploy to Railway
1. Push to private GitHub repo
2. railway.app → New Project → GitHub repo
3. Add all .env variables in Railway Variables tab
4. Note your Railway app URL (e.g. https://lba-bot.railway.app)

### 6. Deploy slash commands (once)
```bash
npm install
node src/deploy-commands.js
```

### 7. Post verification panel
In #verification channel:
```
/setup-verify
```

---

## phpVMS Setup

### 1. Add config file
Copy phpvms-webhook/lba.php → ~/public_html/config/lba.php

### 2. Add to .env
```
LBA_DISCORD_WEBHOOK_URL=https://YOUR-RAILWAY-URL.railway.app/webhook/discord-linked
LBA_DISCORD_WEBHOOK_SECRET=same_value_as_WEBHOOK_SECRET_in_bot_env
```

### 3. Add listener
Copy phpvms-webhook/Listeners/DiscordLinkedListener.php → ~/public_html/app/Listeners/
Copy phpvms-webhook/Providers/LBAWebhookServiceProvider.php → ~/public_html/app/Providers/

### 4. Register provider
Add to config/app.php providers array:
```php
App\Providers\LBAWebhookServiceProvider::class,
```

### 5. Clear cache
```bash
php artisan cache:clear && php artisan config:clear
```

---

## Commands
| Command | Description | Access |
|---------|-------------|--------|
| `/verify` | Link Discord to LBA account | All |
| `/stats` | VA statistics | All |
| `/pireps count:5` | Latest PIREPs | All |
| `/pilot pilot_id:LBA0001` | Pilot profile | All |
| `/setup-verify` | Post verification panel | Admin |
| `/sync user:@member pilot_id:LBA0001` | Force sync roles | Admin |
