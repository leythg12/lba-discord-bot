/**
 * LBA Bot — Webhook Server
 * Handles: discord.linked, rank.changed
 * Nickname format: Firstname - LBA0001
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
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch(e) { return false; }
  }

  // ── Nickname builder ──────────────────────────────────────────
  // Format: "Firstname - LBA0001"
  function buildNickname(fullName, pilotId) {
    const firstName = (fullName || '').split(' ')[0] || fullName;
    return `${firstName} - ${pilotId}`;
  }

  // ── Role assignment ───────────────────────────────────────────
  async function assignRoles(member, pilot) {
    const phpvms = require('./phpvms');

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

    const rankRole = phpvms.rankToRoleId(pilot.rank?.name ?? pilot.rank);
    if (rankRole) add.push(rankRole);

    const hubRole = phpvms.hubToRoleId(pilot.home_airport_id ?? pilot.hub);
    if (hubRole) add.push(hubRole);

    if (process.env.ROLE_PILOT) add.push(process.env.ROLE_PILOT);

    await member.roles.remove(remove.filter(r => member.roles.cache.has(r))).catch(() => {});
    await member.roles.add(add.filter(r => !member.roles.cache.has(r))).catch(() => {});

    // Set nickname: Firstname - LBA0001
    const nick = buildNickname(pilot.name, pilot.pilot_id ?? pilot.pilot_id);
    await member.setNickname(nick).catch(() => {});

    return { rankRole, hubRole, nick };
  }

  // ── Health check ──────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: client.user?.tag || 'starting' });
  });

  // ── Main webhook endpoint ─────────────────────────────────────
  app.post('/webhook/discord-linked', async (req, res) => {
    if (!verifySignature(req)) {
      console.warn('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { discord_id, event, pilot_id, name, rank, hub, flights, flight_time, balance } = req.body;

    if (!['discord.linked', 'rank.changed'].includes(event)) {
      return res.json({ status: 'ignored', event });
    }

    if (!discord_id) return res.status(400).json({ error: 'Missing discord_id' });

    console.log(`[WEBHOOK] Event: ${event} | discord_id=${discord_id} | pilot_id=${pilot_id} | rank=${rank}`);

    res.json({ status: 'received' });

    setImmediate(async () => {
      try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        let member;
        try {
          member = await guild.members.fetch(discord_id);
        } catch (e) {
          console.warn(`[WEBHOOK] Member ${discord_id} not in guild`);
          return;
        }

        const pilot = { pilot_id, name, rank: { name: rank }, home_airport_id: hub, flights, flight_time, balance };
        const { nick } = await assignRoles(member, pilot);

        const embeds = require('./embeds');
        const logCh  = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

        if (event === 'discord.linked') {
          // Send welcome DM
          try {
            await member.send({ embeds: [embeds.verifySuccess(pilot)] });
          } catch (e) {
            const ch = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);
            if (ch) await ch.send({ content: `<@${discord_id}>`, embeds: [embeds.verifySuccess(pilot)] });
          }
          logCh?.send(`\`${new Date().toISOString()}\` ✅ Verified: **${member.user.tag}** → ${name} (${pilot_id}) · ${rank} · Hub ${hub} · Nick: ${nick}`).catch(() => {});

        } else if (event === 'rank.changed') {
          // Send rank change DM
          try {
            await member.send({
              embeds: [new (require('discord.js').EmbedBuilder)()
                .setColor(0xC8A96E)
                .setTitle('🎖  Promotion — Air Liberté Virtual')
                .setDescription(`Félicitations **${name}** ! Vous avez été promu au grade de **${rank}**.`)
                .addFields(
                  { name: '🪪 Pilot ID',  value: pilot_id,                          inline: true },
                  { name: '🏅 New Rank',   value: rank,                              inline: true },
                  { name: '✈  Flights',    value: String(flights ?? 0),              inline: true },
                )
                .setFooter({ text: 'Air Liberté Virtual · LBA · newhorisons.com' })
                .setTimestamp()
              ]
            });
          } catch (e) {
            console.warn('[WEBHOOK] Could not DM pilot for rank change:', e.message);
          }
          logCh?.send(`\`${new Date().toISOString()}\` 🎖 Rank change: **${member.user.tag}** → ${rank} · Nick: ${nick}`).catch(() => {});
        }

      } catch (e) {
        console.error('[WEBHOOK] Processing error:', e.message);
      }
    });
  });

  const port = process.env.WEBHOOK_PORT || 3000;
  app.listen(port, () => console.log(`[WEBHOOK] Listening on port ${port}`));
};
