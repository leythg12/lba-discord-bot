/**
 * Express webhook server
 * phpVMS posts here when a pilot links their Discord account via OAuth
 *
 * phpVMS sends: { discord_id, user_id, pilot_id, event }
 */
const express = require('express');
const crypto  = require('crypto');

module.exports = function startWebhook(client) {
  const app = express();
  app.use(express.json());

  // ── Signature verification ────────────────────────────────────
  function verifySignature(req) {
    const secret    = process.env.WEBHOOK_SECRET;
    const signature = req.headers['x-lba-signature'] || '';
    const payload   = JSON.stringify(req.body);
    const expected  = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  // ── Health check ──────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: client.user?.tag });
  });

  // ── Main webhook endpoint ─────────────────────────────────────
  app.post('/webhook/discord-linked', async (req, res) => {
    // Verify signature
    try {
      if (!verifySignature(req)) {
        console.warn('[WEBHOOK] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Signature error' });
    }

    const { discord_id, user_id, pilot_id, event } = req.body;

    if (event !== 'discord.linked') {
      return res.json({ status: 'ignored', event });
    }

    if (!discord_id) {
      return res.status(400).json({ error: 'Missing discord_id' });
    }

    console.log(`[WEBHOOK] Discord linked: discord_id=${discord_id} pilot_id=${pilot_id}`);

    // Respond immediately — process async
    res.json({ status: 'received' });

    // Process in background
    setImmediate(async () => {
      try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        // Find the Discord member
        let member;
        try {
          member = await guild.members.fetch(discord_id);
        } catch (e) {
          console.warn(`[WEBHOOK] Member ${discord_id} not in guild`);
          return;
        }

        // Get pilot data from phpVMS
        const phpvms = require('./phpvms');
        const roles  = require('./roles');
        const embeds = require('./embeds');

        let pilot = null;
        if (user_id) pilot = await phpvms.getPilotById(user_id);
        if (!pilot && pilot_id) pilot = await phpvms.getPilotByPilotId(pilot_id);
        if (!pilot) pilot = await phpvms.getPilotByDiscordId(discord_id);

        if (!pilot) {
          console.warn(`[WEBHOOK] No pilot found for discord_id=${discord_id}`);
          return;
        }

        // Assign roles
        await roles.assignFromPilot(member, pilot);

        // Send success DM
        try {
          await member.send({ embeds: [embeds.verifySuccess(pilot)] });
        } catch (e) {
          // DMs may be disabled — post in verify channel instead
          const ch = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);
          if (ch) {
            await ch.send({
              content: `<@${discord_id}>`,
              embeds: [embeds.verifySuccess(pilot)],
            });
          }
        }

        // Log
        const logCh = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        logCh?.send(
          `\`${new Date().toISOString()}\` ✅ Verified via OAuth: **${member.user.tag}** → ${pilot.name} (${pilot.pilot_id}) · ${pilot.rank?.name||'?'} · Hub ${pilot.home_airport_id}`
        ).catch(() => {});

      } catch (e) {
        console.error('[WEBHOOK] Processing error:', e.message);
      }
    });
  });

  const port = process.env.WEBHOOK_PORT || 3000;
  app.listen(port, () => {
    console.log(`[WEBHOOK] Listening on port ${port}`);
  });
};
