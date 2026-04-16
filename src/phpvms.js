const axios = require('axios');

const api = axios.create({
  baseURL: process.env.PHPVMS_URL,
  headers: {
    'X-API-Key': process.env.PHPVMS_API_KEY,
    'Accept':    'application/json',
  },
  timeout: 10000,
});

module.exports = {
  // Get pilot by their Discord ID (stored in phpVMS after OAuth link)
  async getPilotByDiscordId(discordId) {
    try {
      const res = await api.get(`/api/users?discord_id=${discordId}`);
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) return data.find(u => u.discord_id === discordId) || null;
      if (data?.discord_id === discordId) return data;
      return null;
    } catch (e) {
      console.error('[PHPVMS] getPilotByDiscordId error:', e.message);
      return null;
    }
  },

  // Get pilot by pilot ID (e.g. LBA0001)
  async getPilotByPilotId(pilotId) {
    try {
      const res = await api.get(`/api/users?pilot_id=${pilotId}`);
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) return data.find(u => u.pilot_id === pilotId) || null;
      if (data?.pilot_id === pilotId) return data;
      return null;
    } catch (e) {
      console.error('[PHPVMS] getPilotByPilotId error:', e.message);
      return null;
    }
  },

  // Get pilot by internal user ID
  async getPilotById(id) {
    try {
      const res = await api.get(`/api/users/${id}`);
      return res.data?.data || res.data || null;
    } catch (e) {
      console.error('[PHPVMS] getPilotById error:', e.message);
      return null;
    }
  },

  async getLatestPireps(count = 5) {
    try {
      const res = await api.get(`/api/pireps?limit=${count}&state=accepted`);
      return res.data?.data || res.data || [];
    } catch (e) { return []; }
  },

  async getLatestNews(count = 3) {
    try {
      const res = await api.get(`/api/news?limit=${count}`);
      return res.data?.data || res.data || [];
    } catch (e) { return []; }
  },

  async getStats() {
    try {
      const res = await api.get('/api/stats');
      return res.data?.data || res.data || {};
    } catch (e) { return {}; }
  },

  rankToRoleId(rankName) {
    const map = {
      'Student Pilot':        process.env.ROLE_STUDENT,
      'Second Officer':       process.env.ROLE_SECOND_OFFICER,
      'First Officer':        process.env.ROLE_FIRST_OFFICER,
      'Senior First Officer': process.env.ROLE_SENIOR_FO,
      'Captain':              process.env.ROLE_CAPTAIN,
      'Senior Captain':       process.env.ROLE_SENIOR_CAPTAIN,
      'Chief Pilot':          process.env.ROLE_CHIEF_PILOT,
    };
    return map[rankName] || process.env.ROLE_STUDENT;
  },

  hubToRoleId(icao) {
    const map = {
      'LFBD': process.env.ROLE_HUB_LFBD,
      'LFPG': process.env.ROLE_HUB_LFPG,
    };
    return map[icao] || null;
  },
};
