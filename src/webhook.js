/**
 * Express webhook server
 * phpVMS posts here when a pilot links their Discord account via OAuth
 */
const express = require('express');
const crypto  = require('crypto');

module.exports = function startWebhook(client) {
  const app = express();
  app.use(express.json());

  function verifySignature(req) {
    const secret    = process.env.WEBHOOK_SECRET;
    const signature = req.headers['x-lba-signature'] || '';
    const payload   = JSON.stringify(req.body);
    const expected  = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch(e) { return false; }
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: client.user?.tag || 'starting' });
  });

  // Main webhook endpoint
  app.post('/webhook/discord-linked', async (req, res) => {
    if (!verifySignature(req)) {
      console.warn('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { discord_id, event, pilot_id, name, rank, hub, flights, flight_time, balance } = req.body;

    if (event !== 'discord.linked') {
      return res.json({ status: 'ignored', event });
    }

    if (!discord_id) {
      return res.status(400).json({ error: 'Missing discord_id' });
    }

    console.log(`[WEBHOOK] Discord linked: discord_id=${discord_id} pilot_id=${pilot_id} name=${name}`);

    // Respond immediately
    res.json({ status: 'received' });

    // Process in background
    setImmediate(async () => {
      try {
        const guild = client.guilds.cache.first();
        if (!guild) { console.warn('[WEBHOOK] No guild found'); return; }

        // Fetch the Discord member
        let member;
        try {
          member = await guild.members.fetch(discord_id);
        } catch (e) {
          console.warn(`[WEBHOOK] Member ${discord_id} not in guild:`, e.message);
          return;
        }

        const embeds = require('./embeds');
        const phpvms = require('./phpvms');

        // Build pilot object from webhook payload directly
        const pilot = {
          pilot_id,
          name,
          rank:            { name: rank || 'Student Pilot' },
          home_airport_id: hub || 'LFBD',
          flights:         flights || 0,
          flight_time:     flight_time || 0,
          balance:         balance || 0,
        };

        // Assign roles
        const allRanks = [
          process.env.ROLE_STUDENT, process.env.ROLE_SECOND_OFFICER,
          process.env.ROLE_FIRST_OFFICER, process.env.ROLE_SENIOR_FO,
          process.env.ROLE_CAPTAIN, process.env.ROLE_SENIOR_CAPTAIN,
          process.env.ROLE_CHIEF_PILOT,
        ].filter(Boolean);

        const allHubs = [
          process.env.ROLE_HUB_LFBD,
          process.env.ROLE_HUB_LFPG,
        ].filter(Boolean);

        const remove = [...allRanks, ...allHubs, process.env.ROLE_UNVERIFIED].filter(Boolean);
        const add    = [];

        const rankRole = phpvms.rankToRoleId(pilot.rank.name);
        if (rankRole) add.push(rankRole);

        const hubRole = phpvms.hubToRoleId(pilot.home_airport_id);
        if (hubRole) add.push(hubRole);

        if (process.env.ROLE_PILOT) add.push(process.env.ROLE_PILOT);

        await member.roles.remove(remove.filter(r => member.roles.cache.has(r))).catch(()=>{});
        await member.roles.add(add.filter(r => !member.roles.cache.has(r))).catch(()=>{});
        await member.setNickname(`${name} | ${pilot_id}`).catch(()=>{});

        console.log(`[WEBHOOK] Roles assigned to ${member.user.tag}`);

        // DM the pilot
        try {
          await member.send({ embeds: [embeds.verifySuccess(pilot)] });
        } catch (e) {
          const ch = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);
          if (ch) await ch.send({ content: `<@${discord_id}>`, embeds: [embeds.verifySuccess(pilot)] });
        }

        // Log
        const logCh = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        logCh?.send(
          `\`${new Date().toISOString()}\` ✅ Verified: **${member.user.tag}** → ${name} (${pilot_id}) · ${rank} · Hub ${hub}`
        ).catch(()=>{});

      } catch (e) {
        console.error('[WEBHOOK] Error:', e.message);
      }
    });
  });

  const port = process.env.WEBHOOK_PORT || 3000;
  app.listen(port, () => console.log(`[WEBHOOK] Listening on port ${port}`));
};
