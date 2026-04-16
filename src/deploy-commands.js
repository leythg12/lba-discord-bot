require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Lier votre compte Liberté Air à Discord'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Statistiques de Liberté Air Virtual'),

  new SlashCommandBuilder()
    .setName('pireps')
    .setDescription('Derniers PIREPs acceptés')
    .addIntegerOption(o => o
      .setName('count')
      .setDescription('Nombre (1-5)')
      .setMinValue(1).setMaxValue(5)),

  new SlashCommandBuilder()
    .setName('pilot')
    .setDescription('Profil d\'un pilote')
    .addStringOption(o => o
      .setName('pilot_id')
      .setDescription('Pilot ID ex: LBA0001')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('[ADMIN] Poster le panel de vérification')
    .setDefaultMemberPermissions('0'),

  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('[ADMIN] Synchroniser les rôles d\'un membre')
    .setDefaultMemberPermissions('0')
    .addUserOption(o => o.setName('user').setDescription('Membre Discord').setRequired(true))
    .addStringOption(o => o.setName('pilot_id').setDescription('Pilot ID').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Done.');
  } catch (e) { console.error(e); }
})();
