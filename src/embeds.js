const { EmbedBuilder } = require('discord.js');
const GOLD=0xC8A96E, NAVY=0x0A1628, GREEN=0x34D399, RED=0xF87171, YELLOW=0xFBBF24;
const FOOTER = { text: 'Liberté Air Virtual · LBA · newhorisons.com' };

module.exports = {
  verifyPanel: () => new EmbedBuilder()
    .setColor(NAVY)
    .setTitle('🔐  Vérification — Liberté Air Virtual')
    .setDescription(
      'Pour accéder aux salons, veuillez lier votre compte **Liberté Air** à Discord.\n\n' +
      '**Comment ça marche ?**\n' +
      '> **1.** Cliquez sur **Vérifier mon compte** ci-dessous\n' +
      '> **2.** Connectez-vous sur le crew center avec **Discord OAuth**\n' +
      '> **3.** Vos rôles sont attribués **instantanément** ✅\n\n' +
      '💡 Si vous n\'avez pas encore de compte, [inscrivez-vous ici](https://newhorisons.com/register) d\'abord.'
    )
    .setFooter(FOOTER),

  welcome: (member) => new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('✈  Bienvenue à bord de Liberté Air Virtual !')
    .setDescription(
      `Bonjour **${member.user.username}**, bienvenue dans notre communauté !\n\n` +
      `**Liberté Air Virtual** est une compagnie aérienne virtuelle française basée à ` +
      `Bordeaux (LFBD) et Paris (LFPG), opérant sur MSFS 2020 & 2024.\n\n` +
      `Rendez-vous dans <#${process.env.VERIFY_CHANNEL_ID}> pour vérifier votre compte.`
    )
    .addFields(
      { name: '🌐 Crew Center', value: '[newhorisons.com](https://newhorisons.com)', inline: true },
      { name: '✈  ICAO',        value: 'LBA',          inline: true },
      { name: '🛫 Hubs',        value: 'LFBD · LFPG',  inline: true },
    )
    .setFooter({ text: 'Au-delà de l\'horizon, la liberté.' }),

  verifySuccess: (pilot) => new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('✅  Compte vérifié !')
    .setDescription(
      `Bienvenue **${pilot.name}** — votre compte Discord est maintenant lié à votre compte Liberté Air.\n` +
      `Vos rôles ont été attribués automatiquement.`
    )
    .addFields(
      { name: '🪪 Pilot ID',  value: pilot.pilot_id,                           inline: true },
      { name: '🏅 Rang',      value: pilot.rank?.name || 'Student Pilot',      inline: true },
      { name: '🛫 Hub',       value: pilot.home_airport_id || 'LFBD',          inline: true },
      { name: '✈  Vols',      value: `${pilot.flights || 0}`,                   inline: true },
      { name: '⏱  Heures',    value: `${Math.floor((pilot.flight_time||0)/60)}h`, inline: true },
      { name: '💰 Solde',     value: `€${Math.round(pilot.balance || 0)}`,    inline: true },
    )
    .setFooter(FOOTER)
    .setTimestamp(),

  verifyNotFound: () => new EmbedBuilder()
    .setColor(RED)
    .setTitle('❌  Compte non trouvé')
    .setDescription(
      'Votre compte Discord n\'est pas encore lié à un compte Liberté Air.\n\n' +
      '**Étapes à suivre :**\n' +
      '> 1. Allez sur [newhorisons.com](https://newhorisons.com/login)\n' +
      '> 2. Connectez-vous avec **Login with Discord**\n' +
      '> 3. Revenez ici et cliquez à nouveau sur **Vérifier mon compte**\n\n' +
      'Si vous n\'avez pas encore de compte : [Inscrivez-vous](https://newhorisons.com/register)'
    )
    .setFooter(FOOTER),

  pirep: (p) => {
    const dur = p.flight_time
      ? `${Math.floor(p.flight_time/60)}h${String(p.flight_time%60).padStart(2,'0')}`
      : '—';
    const sc = p.score ?? '—';
    const lr = p.landing_rate ? `${p.landing_rate} ft/min` : '—';
    const col = typeof sc === 'number'
      ? (sc>=90 ? GREEN : sc>=70 ? GOLD : sc>=50 ? YELLOW : RED)
      : GOLD;
    return new EmbedBuilder()
      .setColor(col)
      .setTitle(`✈  ${p.airline?.icao||'LBA'}${p.flight_number} · ${p.dpt_airport_id} → ${p.arr_airport_id}`)
      .addFields(
        { name: '👤 Pilote',       value: p.user?.name || '—',                  inline: true },
        { name: '🛩  Appareil',    value: p.aircraft?.registration || '—',      inline: true },
        { name: '⏱  Durée',        value: dur,                                   inline: true },
        { name: '🏆 Score',         value: `${sc}/100`,                           inline: true },
        { name: '🛬 Atterrissage',  value: lr,                                    inline: true },
        { name: '⛽ Carburant',     value: p.fuel_used ? `${Math.round(p.fuel_used)} kg` : '—', inline: true },
      )
      .setFooter(FOOTER)
      .setTimestamp(p.submitted_at ? new Date(p.submitted_at) : new Date());
  },

  news: (n) => new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`📢  ${n.title}`)
    .setDescription((n.body||'').substring(0,400) + ((n.body||'').length>400?'…':''))
    .setURL('https://newhorisons.com/news')
    .setFooter({ text: `Liberté Air · ${n.user?.name||'Staff LBA'}` })
    .setTimestamp(n.created_at ? new Date(n.created_at) : new Date()),

  stats: (d) => new EmbedBuilder()
    .setColor(NAVY)
    .setTitle('📊  Statistiques — Liberté Air Virtual')
    .addFields(
      { name: '👥 Pilotes',   value: `${d.pilots||0}`,                         inline: true },
      { name: '✈  Vols',      value: `${d.flights||0}`,                        inline: true },
      { name: '⏱  Heures',    value: `${Math.floor((d.flight_time||0)/60)}h`,  inline: true },
      { name: '🛫 Routes',    value: `${d.routes||0}`,                         inline: true },
      { name: '🛩  Appareils', value: '165',                                    inline: true },
      { name: '🌍 Continents',value: '6',                                      inline: true },
    )
    .setFooter(FOOTER).setTimestamp(),

  pilot: (p) => new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`👤  ${p.name}`)
    .addFields(
      { name: '🪪 Pilot ID',  value: p.pilot_id,                               inline: true },
      { name: '🏅 Rang',      value: p.rank?.name||'—',                        inline: true },
      { name: '🛫 Hub',       value: p.home_airport_id||'—',                   inline: true },
      { name: '✈  Vols',      value: `${p.flights||0}`,                         inline: true },
      { name: '⏱  Heures',    value: `${Math.floor((p.flight_time||0)/60)}h`,  inline: true },
      { name: '📍 Position',  value: p.curr_airport_id||p.home_airport_id||'—', inline: true },
    )
    .setFooter(FOOTER).setTimestamp(),

  error: (msg) => new EmbedBuilder()
    .setColor(RED).setTitle('⚠  Erreur').setDescription(msg).setFooter(FOOTER),
};
