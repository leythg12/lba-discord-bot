/**
 * Assign phpVMS rank + hub roles to a Discord member
 */
const phpvms = require('./phpvms');

const ALL_RANK_ROLES = () => [
  process.env.ROLE_STUDENT,
  process.env.ROLE_SECOND_OFFICER,
  process.env.ROLE_FIRST_OFFICER,
  process.env.ROLE_SENIOR_FO,
  process.env.ROLE_CAPTAIN,
  process.env.ROLE_SENIOR_CAPTAIN,
  process.env.ROLE_CHIEF_PILOT,
].filter(Boolean);

const ALL_HUB_ROLES = () => [
  process.env.ROLE_HUB_LFBD,
  process.env.ROLE_HUB_LFPG,
].filter(Boolean);

module.exports = {
  async assignFromPilot(member, pilot) {
    const remove = [
      ...ALL_RANK_ROLES(),
      ...ALL_HUB_ROLES(),
      process.env.ROLE_UNVERIFIED,
    ].filter(Boolean);

    const add = [];

    const rankRole = phpvms.rankToRoleId(pilot.rank?.name);
    if (rankRole) add.push(rankRole);

    const hubRole = phpvms.hubToRoleId(pilot.home_airport_id);
    if (hubRole) add.push(hubRole);

    if (process.env.ROLE_PILOT) add.push(process.env.ROLE_PILOT);

    await member.roles.remove(
      remove.filter(r => member.roles.cache.has(r))
    ).catch(e => console.error('[ROLES] remove error:', e.message));

    await member.roles.add(
      add.filter(r => !member.roles.cache.has(r))
    ).catch(e => console.error('[ROLES] add error:', e.message));

    await member.setNickname(`${pilot.name} | ${pilot.pilot_id}`)
      .catch(() => {}); // may fail if member is server owner

    return { rankRole, hubRole };
  },
};
