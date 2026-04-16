require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags,
} = require('discord.js');
const cron     = require('node-cron');
const phpvms   = require('./phpvms');
const embeds   = require('./embeds');
const roles    = require('./roles');
const startWebhook = require('./webhook');
const startApproachMonitor = require('./approach');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let lastPirepId = null;
let lastNewsId  = null;

// ── Helpers ────────────────────────────────────────────────────────
async function log(guild, msg) {
  if (!process.env.LOG_CHANNEL_ID) return;
  guild?.channels?.cache?.get(process.env.LOG_CHANNEL_ID)
    ?.send(`\`${new Date().toISOString()}\` ${msg}`)
    .catch(() => {});
}

function verifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_oauth')
      .setLabel('Vérifier mon compte')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✈')
  );
}

// ── Ready ───────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log(`[LBA BOT] Online as ${client.user.tag}`);
  client.user.setActivity('Liberté Air Virtual · LBA', { type: 3 });

  // Seed last IDs to avoid re-posting old content
  const pireps = await phpvms.getLatestPireps(1);
  if (pireps[0]) lastPirepId = pireps[0].id;
  const news = await phpvms.getLatestNews(1);
  if (news[0]) lastNewsId = news[0].id;

  // Start webhook server
  startWebhook(client);
  startApproachMonitor(client);

  console.log(`[LBA BOT] Ready. Webhook on port ${process.env.WEBHOOK_PORT || 3000}`);
});

// ── New member ──────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (process.env.ROLE_UNVERIFIED)
    await member.roles.add(process.env.ROLE_UNVERIFIED).catch(() => {});

  const ch = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  ch?.send({ embeds: [embeds.welcome(member)] });

  await log(member.guild, `👋 Nouveau membre : **${member.user.tag}** (${member.id})`);
});

// ── Interactions ────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  // ── BUTTON: verify ───────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'verify_oauth') {
    const loginUrl = `${process.env.PHPVMS_URL}/login`;
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        embeds.verifyNotFound().setDescription(
          '**Étapes pour vérifier votre compte :**\n\n' +
          `> **1.** Cliquez sur ce lien : [Connexion avec Discord](${loginUrl})\n` +
          '> **2.** Connectez-vous avec votre compte **Discord**\n' +
          '> **3.** Vos rôles seront attribués **automatiquement** ✅\n\n' +
          '💡 Pas encore de compte ? [Inscrivez-vous ici](https://newhorisons.com/register)'
        )
      ],
    });
  }

  if (!interaction.isChatInputCommand()) return;

  // ── /verify ──────────────────────────────────────────────────────
  if (interaction.commandName === 'verify') {
    const loginUrl = `${process.env.PHPVMS_URL}/login`;
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `Pour vérifier votre compte, connectez-vous avec Discord ici :\n👉 ${loginUrl}\n\nVos rôles seront attribués automatiquement après connexion.`,
    });
  }

  // ── /stats ───────────────────────────────────────────────────────
  if (interaction.commandName === 'stats') {
    await interaction.deferReply();
    const data = await phpvms.getStats();
    await interaction.editReply({ embeds: [embeds.stats(data)] });
  }

  // ── /pireps ──────────────────────────────────────────────────────
  if (interaction.commandName === 'pireps') {
    await interaction.deferReply();
    const count  = interaction.options.getInteger('count') || 5;
    const pireps = await phpvms.getLatestPireps(count);
    if (!pireps.length) return interaction.editReply('Aucun PIREP trouvé.');
    await interaction.editReply({ embeds: pireps.slice(0,5).map(embeds.pirep) });
  }

  // ── /pilot ───────────────────────────────────────────────────────
  if (interaction.commandName === 'pilot') {
    await interaction.deferReply();
    const rawId = interaction.options.getString('pilot_id').trim().toUpperCase();
    const pilot = await phpvms.getPilotByPilotId(rawId);
    if (!pilot) return interaction.editReply({ embeds: [embeds.error(`Pilote ${rawId} introuvable.`)] });
    await interaction.editReply({ embeds: [embeds.pilot(pilot)] });
  }

  // ── /setup-verify ────────────────────────────────────────────────
  if (interaction.commandName === 'setup-verify') {
    await interaction.channel.send({
      embeds: [embeds.verifyPanel()],
      components: [verifyRow()],
    });
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '✅ Panel posté.',
    });
  }

  // ── /sync (admin) ────────────────────────────────────────────────
  if (interaction.commandName === 'sync') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const target = interaction.options.getMember('user');
    const rawId  = interaction.options.getString('pilot_id').trim().toUpperCase();
    const pilot  = await phpvms.getPilotByPilotId(rawId);
    if (!pilot) return interaction.editReply({
      embeds: [embeds.error(`Pilote ${rawId} introuvable.`)]
    });
    await roles.assignFromPilot(target, pilot);
    await interaction.editReply({
      content: `✅ Rôles synchronisés pour **${target.user.tag}** → ${pilot.name}`
    });
    await log(interaction.guild,
      `🔄 Sync par ${interaction.user.tag} : **${target.user.tag}** → ${rawId}`
    );
  }
});

// ── PIREP polling ───────────────────────────────────────────────────
cron.schedule(`*/${process.env.PIREP_POLL_INTERVAL||5} * * * *`, async () => {
  const guild = client.guilds.cache.first();
  const ch    = guild?.channels?.cache?.get(process.env.PIREP_CHANNEL_ID);
  if (!ch) return;

  const pireps = await phpvms.getLatestPireps(5);
  if (!pireps.length) return;

  if (lastPirepId === null) { lastPirepId = pireps[0].id; return; }

  const fresh = pireps.filter(p => p.id > lastPirepId);
  if (fresh.length) {
    lastPirepId = pireps[0].id;
    for (const p of fresh.reverse())
      await ch.send({ embeds: [embeds.pirep(p)] }).catch(() => {});
  }
});

// ── News polling ────────────────────────────────────────────────────
cron.schedule(`*/${process.env.NEWS_POLL_INTERVAL||30} * * * *`, async () => {
  const guild = client.guilds.cache.first();
  const ch    = guild?.channels?.cache?.get(process.env.NEWS_CHANNEL_ID);
  if (!ch) return;

  const news = await phpvms.getLatestNews(3);
  if (!news.length) return;

  if (lastNewsId === null) { lastNewsId = news[0].id; return; }

  const fresh = news.filter(n => n.id > lastNewsId);
  if (fresh.length) {
    lastNewsId = news[0].id;
    for (const n of fresh.reverse())
      await ch.send({ embeds: [embeds.news(n)] }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
