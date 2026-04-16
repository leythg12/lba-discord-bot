/**
 * LBA Approach Briefing System
 * Monitors active flights and sends DM ~15min before arrival
 * with gate assignment, active runway and METAR
 */

const axios = require('axios');

// ── Already notified flights (pirepId → true) ─────────────────────
const notified = new Set();

// ── Airport database ──────────────────────────────────────────────
// runways: [{ hdg, name, length }] — hdg is magnetic heading
// gates: function(distance_nm, aircraft_type) → { terminal, gate }
const AIRPORTS = {

  // ── LBA HUBS ────────────────────────────────────────────────────
  'LFPG': {
    name: 'Paris Charles de Gaulle',
    runways: [
      { hdg: 90,  name: '09L', length: 4215 },
      { hdg: 270, name: '27R', length: 4215 },
      { hdg: 90,  name: '09R', length: 2700 },
      { hdg: 270, name: '27L', length: 2700 },
      { hdg: 80,  name: '08L', length: 4200 },
      { hdg: 260, name: '26R', length: 4200 },
      { hdg: 80,  name: '08R', length: 2700 },
      { hdg: 260, name: '26L', length: 2700 },
    ],
    gates: (dist, type) => {
      // Longhaul (>3000nm) → Terminal 2E, shorthaul → Terminal 2F
      const longhaul = dist > 3000;
      const terminal = longhaul ? '2E' : '2F';
      const gates2E  = ['E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12'];
      const gates2F  = ['F21','F22','F23','F24','F25','F26','F27','F28','F29','F30','F31','F32','F33','F34'];
      const pool     = longhaul ? gates2E : gates2F;
      const gate     = pool[Math.floor(Math.random() * pool.length)];
      return { terminal: `Terminal ${terminal}`, gate };
    },
  },

  'LFBD': {
    name: 'Bordeaux–Mérignac',
    runways: [
      { hdg: 50,  name: '05',  length: 3500 },
      { hdg: 230, name: '23',  length: 3500 },
      { hdg: 110, name: '11',  length: 2090 },
      { hdg: 290, name: '29',  length: 2090 },
    ],
    gates: (dist, type) => {
      const gates = ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20','C21','C22'];
      const gate  = gates[Math.floor(Math.random() * gates.length)];
      return { terminal: 'Hall C', gate };
    },
  },

  // ── MAJOR EUROPEAN ───────────────────────────────────────────────
  'EGLL': {
    name: 'London Heathrow',
    runways: [
      { hdg: 90,  name: '09L', length: 3902 },
      { hdg: 270, name: '27R', length: 3902 },
      { hdg: 90,  name: '09R', length: 3658 },
      { hdg: 270, name: '27L', length: 3658 },
    ],
    gates: (dist, type) => {
      const t = dist > 3000 ? 'Terminal 5' : 'Terminal 2';
      const pool = dist > 3000
        ? ['B01','B02','B03','B04','B05','B06','C01','C02','C03']
        : ['A01','A02','A03','A04','B01','B02','B03','B04','B05'];
      return { terminal: t, gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'EDDF': {
    name: 'Frankfurt',
    runways: [
      { hdg: 70,  name: '07L', length: 4000 },
      { hdg: 250, name: '25R', length: 4000 },
      { hdg: 70,  name: '07C', length: 4000 },
      { hdg: 250, name: '25C', length: 4000 },
      { hdg: 180, name: '18',  length: 4000 },
      { hdg: 360, name: '36',  length: 4000 },
    ],
    gates: (dist, type) => {
      const t = dist > 3000 ? 'Terminal 1 — Concourse Z' : 'Terminal 1 — Concourse B';
      const pool = dist > 3000
        ? ['Z01','Z02','Z03','Z04','Z05','Z06','Z07','Z08']
        : ['B01','B02','B03','B04','B05','B06','B07','B08','B09','B10'];
      return { terminal: t, gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'LEMD': {
    name: 'Madrid Barajas',
    runways: [
      { hdg: 180, name: '18L', length: 4350 },
      { hdg: 360, name: '36R', length: 4350 },
      { hdg: 180, name: '18R', length: 4100 },
      { hdg: 360, name: '36L', length: 4100 },
      { hdg: 140, name: '14L', length: 3500 },
      { hdg: 320, name: '32R', length: 3500 },
      { hdg: 140, name: '14R', length: 3500 },
      { hdg: 320, name: '32L', length: 3500 },
    ],
    gates: () => {
      const pool = ['H01','H02','H03','H04','H05','H06','H07','H08'];
      return { terminal: 'Terminal 4', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'LIRF': {
    name: 'Rome Fiumicino',
    runways: [
      { hdg: 160, name: '16L', length: 3900 },
      { hdg: 340, name: '34R', length: 3900 },
      { hdg: 160, name: '16R', length: 3600 },
      { hdg: 340, name: '34L', length: 3600 },
      { hdg: 70,  name: '07',  length: 3307 },
      { hdg: 250, name: '25',  length: 3307 },
    ],
    gates: (dist) => {
      const t = dist > 3000 ? 'Terminal 3' : 'Terminal 1';
      const pool = dist > 3000
        ? ['G01','G02','G03','G04','G05','G06']
        : ['A01','A02','A03','A04','A05','A06','A07','A08'];
      return { terminal: t, gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'EHAM': {
    name: 'Amsterdam Schiphol',
    runways: [
      { hdg: 180, name: '18R', length: 3800 },
      { hdg: 360, name: '36C', length: 3300 },
      { hdg: 60,  name: '06',  length: 3400 },
      { hdg: 240, name: '24',  length: 3400 },
      { hdg: 90,  name: '09',  length: 3450 },
      { hdg: 270, name: '27',  length: 3450 },
    ],
    gates: () => {
      const pool = ['D01','D02','D03','D04','D05','D06','D07','D08','E01','E02','E03','E04','E05','E06'];
      return { terminal: 'Terminal', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'LSZH': {
    name: 'Zurich',
    runways: [
      { hdg: 100, name: '10',  length: 3300 },
      { hdg: 280, name: '28',  length: 3300 },
      { hdg: 160, name: '16',  length: 3700 },
      { hdg: 340, name: '34',  length: 3700 },
      { hdg: 140, name: '14',  length: 2500 },
      { hdg: 320, name: '32',  length: 2500 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','B01','B02','B03','B04','B05'];
      return { terminal: 'Terminal', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'LFML': {
    name: 'Marseille Provence',
    runways: [
      { hdg: 130, name: '13R', length: 3500 },
      { hdg: 310, name: '31L', length: 3500 },
      { hdg: 130, name: '13L', length: 2370 },
      { hdg: 310, name: '31R', length: 2370 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','B01','B02','B03','B04'];
      return { terminal: 'Hall A/B', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'LFBO': {
    name: 'Toulouse Blagnac',
    runways: [
      { hdg: 140, name: '14L', length: 3500 },
      { hdg: 320, name: '32R', length: 3500 },
      { hdg: 140, name: '14R', length: 2100 },
      { hdg: 320, name: '32L', length: 2100 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','B01','B02','B03','B04','B05'];
      return { terminal: 'Hall B', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── MIDDLE EAST ──────────────────────────────────────────────────
  'OMDB': {
    name: 'Dubai International',
    runways: [
      { hdg: 120, name: '12L', length: 4447 },
      { hdg: 300, name: '30R', length: 4447 },
      { hdg: 120, name: '12R', length: 4000 },
      { hdg: 300, name: '30L', length: 4000 },
    ],
    gates: (dist, type) => {
      const t = dist > 4000 ? 'Terminal 3' : 'Terminal 1';
      const pool = dist > 4000
        ? ['A01','A02','A03','A04','A05','A06','A07','A08','B01','B02','B03','B04']
        : ['C01','C02','C03','C04','C05','C06','C07','C08'];
      return { terminal: t, gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'OMAA': {
    name: 'Abu Dhabi',
    runways: [
      { hdg: 130, name: '13L', length: 4100 },
      { hdg: 310, name: '31R', length: 4100 },
      { hdg: 130, name: '13R', length: 3990 },
      { hdg: 310, name: '31L', length: 3990 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'];
      return { terminal: 'Terminal A', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'OTHH': {
    name: 'Doha Hamad',
    runways: [
      { hdg: 160, name: '16L', length: 4850 },
      { hdg: 340, name: '34R', length: 4850 },
      { hdg: 160, name: '16R', length: 4250 },
      { hdg: 340, name: '34L', length: 4250 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','B01','B02','B03','B04','B05','C01','C02','C03'];
      return { terminal: 'Main Terminal', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── ASIA ─────────────────────────────────────────────────────────
  'WSSS': {
    name: 'Singapore Changi',
    runways: [
      { hdg: 20,  name: '02L', length: 4000 },
      { hdg: 200, name: '20R', length: 4000 },
      { hdg: 20,  name: '02C', length: 4000 },
      { hdg: 200, name: '20C', length: 4000 },
    ],
    gates: (dist, type) => {
      const t = dist > 5000 ? 'Terminal 3' : 'Terminal 1';
      const pool = dist > 5000
        ? ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10']
        : ['A01','A02','A03','A04','A05','A06','A07','A08'];
      return { terminal: t, gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'VHHH': {
    name: 'Hong Kong',
    runways: [
      { hdg: 70,  name: '07L', length: 3800 },
      { hdg: 250, name: '25R', length: 3800 },
      { hdg: 70,  name: '07R', length: 3800 },
      { hdg: 250, name: '25L', length: 3800 },
    ],
    gates: () => {
      const pool = ['G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','G11','G12'];
      return { terminal: 'Terminal 1', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'RJTT': {
    name: 'Tokyo Haneda',
    runways: [
      { hdg: 50,  name: '05',  length: 3360 },
      { hdg: 230, name: '23',  length: 3360 },
      { hdg: 160, name: '16L', length: 3000 },
      { hdg: 340, name: '34R', length: 3000 },
      { hdg: 40,  name: '04',  length: 2500 },
      { hdg: 220, name: '22',  length: 2500 },
    ],
    gates: () => {
      const pool = ['64','65','66','67','68','69','70','71','72','73','74','75'];
      return { terminal: 'Terminal 3 (International)', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'ZBAA': {
    name: 'Beijing Capital',
    runways: [
      { hdg: 180, name: '18L', length: 3800 },
      { hdg: 360, name: '36R', length: 3800 },
      { hdg: 180, name: '18R', length: 3200 },
      { hdg: 360, name: '36L', length: 3200 },
      { hdg: 10,  name: '01',  length: 3200 },
      { hdg: 190, name: '19',  length: 3200 },
    ],
    gates: () => {
      const pool = ['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10'];
      return { terminal: 'Terminal 3D', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── NORTH AMERICA ────────────────────────────────────────────────
  'KJFK': {
    name: 'New York JFK',
    runways: [
      { hdg: 40,  name: '04L', length: 2560 },
      { hdg: 220, name: '22R', length: 2560 },
      { hdg: 130, name: '13L', length: 3048 },
      { hdg: 310, name: '31R', length: 3048 },
      { hdg: 40,  name: '04R', length: 3460 },
      { hdg: 220, name: '22L', length: 3460 },
      { hdg: 130, name: '13R', length: 4442 },
      { hdg: 310, name: '31L', length: 4442 },
    ],
    gates: () => {
      const pool = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      return { terminal: 'Terminal 1 (Air France)', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'KLAX': {
    name: 'Los Angeles',
    runways: [
      { hdg: 70,  name: '06L', length: 3135 },
      { hdg: 250, name: '24R', length: 3135 },
      { hdg: 70,  name: '06R', length: 3685 },
      { hdg: 250, name: '24L', length: 3685 },
      { hdg: 70,  name: '07L', length: 3685 },
      { hdg: 250, name: '25R', length: 3685 },
      { hdg: 70,  name: '07R', length: 3135 },
      { hdg: 250, name: '25L', length: 3135 },
    ],
    gates: () => {
      const pool = ['100','101','102','103','104','105','106','107','108','109','110'];
      return { terminal: 'Tom Bradley International (TBIT)', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'KEWR': {
    name: 'New York Newark',
    runways: [
      { hdg: 40,  name: '04L', length: 3048 },
      { hdg: 220, name: '22R', length: 3048 },
      { hdg: 110, name: '11',  length: 3048 },
      { hdg: 290, name: '29',  length: 3048 },
      { hdg: 40,  name: '04R', length: 2073 },
      { hdg: 220, name: '22L', length: 2073 },
    ],
    gates: () => {
      const pool = ['B01','B02','B03','B04','B05','B06','B07','B08','B09','B10'];
      return { terminal: 'Terminal B', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'CYYZ': {
    name: 'Toronto Pearson',
    runways: [
      { hdg: 60,  name: '06L', length: 2770 },
      { hdg: 240, name: '24R', length: 2770 },
      { hdg: 60,  name: '06R', length: 3389 },
      { hdg: 240, name: '24L', length: 3389 },
      { hdg: 150, name: '15L', length: 2956 },
      { hdg: 330, name: '33R', length: 2956 },
      { hdg: 150, name: '15R', length: 3368 },
      { hdg: 330, name: '33L', length: 3368 },
    ],
    gates: () => {
      const pool = ['F01','F02','F03','F04','F05','F06','F07','F08'];
      return { terminal: 'Terminal 1', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── SOUTH AMERICA ────────────────────────────────────────────────
  'SBGR': {
    name: 'São Paulo Guarulhos',
    runways: [
      { hdg: 100, name: '10L', length: 3700 },
      { hdg: 280, name: '28R', length: 3700 },
      { hdg: 100, name: '10R', length: 3000 },
      { hdg: 280, name: '28L', length: 3000 },
    ],
    gates: () => {
      const pool = ['E01','E02','E03','E04','E05','E06','E07','E08'];
      return { terminal: 'Terminal 3', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'SAEZ': {
    name: 'Buenos Aires Ezeiza',
    runways: [
      { hdg: 110, name: '11',  length: 3300 },
      { hdg: 290, name: '29',  length: 3300 },
      { hdg: 170, name: '17',  length: 2600 },
      { hdg: 350, name: '35',  length: 2600 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','A06'];
      return { terminal: 'Terminal A', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── AFRICA ───────────────────────────────────────────────────────
  'DNMM': {
    name: 'Lagos Murtala Muhammed',
    runways: [
      { hdg: 190, name: '19L', length: 3900 },
      { hdg: 10,  name: '01R', length: 3900 },
      { hdg: 190, name: '19R', length: 2743 },
      { hdg: 10,  name: '01L', length: 2743 },
    ],
    gates: () => {
      const pool = ['01','02','03','04','05','06','07','08'];
      return { terminal: 'International Terminal', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'HAAB': {
    name: 'Addis Ababa Bole',
    runways: [
      { hdg: 70,  name: '07L', length: 3800 },
      { hdg: 250, name: '25R', length: 3800 },
      { hdg: 70,  name: '07R', length: 3800 },
      { hdg: 250, name: '25L', length: 3800 },
    ],
    gates: () => {
      const pool = ['A01','A02','A03','A04','A05','A06','B01','B02','B03'];
      return { terminal: 'Terminal 2', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  // ── AUSTRALIA ────────────────────────────────────────────────────
  'YSSY': {
    name: 'Sydney Kingsford Smith',
    runways: [
      { hdg: 160, name: '16L', length: 3962 },
      { hdg: 340, name: '34R', length: 3962 },
      { hdg: 70,  name: '07',  length: 2438 },
      { hdg: 250, name: '25',  length: 2438 },
      { hdg: 160, name: '16R', length: 2530 },
      { hdg: 340, name: '34L', length: 2530 },
    ],
    gates: () => {
      const pool = ['50','51','52','53','54','55','56','57','58','59','60'];
      return { terminal: 'Terminal 1 (International)', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

  'YMML': {
    name: 'Melbourne',
    runways: [
      { hdg: 160, name: '16',  length: 3657 },
      { hdg: 340, name: '34',  length: 3657 },
      { hdg: 270, name: '27',  length: 2286 },
      { hdg: 90,  name: '09',  length: 2286 },
    ],
    gates: () => {
      const pool = ['E01','E02','E03','E04','E05','E06','E07','E08'];
      return { terminal: 'Terminal 2 (International)', gate: pool[Math.floor(Math.random()*pool.length)] };
    },
  },

};

// ── Generic gate generator for unknown airports ───────────────────
function genericGate(icao, dist) {
  const letters = ['A','B','C','D','E','F','G','H'];
  const letter  = letters[icao.charCodeAt(0) % letters.length];
  const num     = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
  return { terminal: 'Main Terminal', gate: `${letter}${num}` };
}

// ── Calculate active runway from wind ────────────────────────────
function getActiveRunway(runways, windDir, windSpeed) {
  if (!runways || runways.length === 0) return null;
  if (windSpeed < 3) {
    // Calm wind — use longest runway
    return runways.reduce((a, b) => a.length > b.length ? a : b);
  }
  // Find runway most into wind
  return runways.reduce((best, rwy) => {
    const diff     = Math.abs(((windDir - rwy.hdg) + 180) % 360 - 180);
    const bestDiff = Math.abs(((windDir - best.hdg) + 180) % 360 - 180);
    return diff < bestDiff ? rwy : best;
  });
}

// ── Fetch METAR ────────────────────────────────────────────────────
async function fetchMetar(icao) {
  try {
    const res = await axios.get(
      `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`,
      { timeout: 5000 }
    );
    const m = res.data?.[0];
    if (!m) return null;
    return {
      raw:       m.rawOb,
      windDir:   m.wdir ?? 0,
      windSpeed: m.wspd ?? 0,
      windGust:  m.wgst ?? null,
      vis:       m.visib,
      temp:      m.temp,
      dewpoint:  m.dewp,
      altimeter: m.altim,
      wx:        m.wxString || '',
      clouds:    m.clouds?.map(c => `${c.cover}${c.base}`).join(' ') || 'CAVOK',
      flightCat: m.fltcat || 'VFR',
    };
  } catch (e) {
    console.warn(`[APPROACH] METAR fetch failed for ${icao}:`, e.message);
    return null;
  }
}

// ── Calculate distance between two lat/lon points (nm) ────────────
function distanceNm(lat1, lon1, lat2, lon2) {
  const R    = 3440.065; // Earth radius in nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 +
               Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
               Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Build the DM embed ─────────────────────────────────────────────
function buildApproachEmbed(flight, metar, runway, gateInfo, distToArr) {
  const { EmbedBuilder } = require('discord.js');

  const GOLD  = 0xC8A96E;
  const NAVY  = 0x0A1628;
  const GREEN = 0x34D399;
  const AMBER = 0xFBBF24;
  const RED   = 0xF87171;

  const catColor = {
    'VFR':   GREEN,
    'MVFR':  AMBER,
    'IFR':   RED,
    'LIFR':  0x9333EA,
  };
  const color = catColor[metar?.flightCat] || GOLD;

  const windStr = metar
    ? `${String(metar.windDir).padStart(3,'0')}° / ${metar.windSpeed}kt${metar.windGust ? ` (gusts ${metar.windGust}kt)` : ''}`
    : 'N/A';

  const visStr   = metar ? `${metar.vis} SM` : 'N/A';
  const tempStr  = metar ? `${metar.temp}°C / DP ${metar.dewpoint}°C` : 'N/A';
  const altStr   = metar ? `${metar.altimeter} hPa` : 'N/A';
  const cloudStr = metar ? metar.clouds : 'N/A';
  const wxStr    = metar?.wx || 'None';
  const catStr   = metar?.flightCat || 'N/A';

  const arrAirport = AIRPORTS[flight.arr_airport_id];
  const arrName    = arrAirport?.name || flight.arr_airport_id;
  const rwyStr     = runway ? `Runway **${runway.name}** (${runway.length}m)` : 'Check ATIS';
  const etaMin     = Math.round(distToArr / (flight.gs || 450) * 60);

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🛬  Approach Briefing — ${flight.arr_airport_id}`)
    .setDescription(
      `**${flight.callsign || `LBA${flight.flight_number}`}** · ${flight.dpt_airport_id} → ${flight.arr_airport_id}\n` +
      `${arrName} · ETA ~${etaMin} min`
    )
    .addFields(
      // Gate assignment
      {
        name: '🚪 Gate Assignment',
        value: `**${gateInfo.terminal}**\nGate **${gateInfo.gate}**`,
        inline: true,
      },
      // Active runway
      {
        name: '🛬 Active Runway',
        value: rwyStr,
        inline: true,
      },
      // Flight category
      {
        name: '📊 Flight Category',
        value: `**${catStr}**`,
        inline: true,
      },
      // Wind
      {
        name: '💨 Wind',
        value: windStr,
        inline: true,
      },
      // Visibility
      {
        name: '👁 Visibility',
        value: visStr,
        inline: true,
      },
      // Temp / Dew
      {
        name: '🌡 Temp / Dew',
        value: tempStr,
        inline: true,
      },
      // Clouds
      {
        name: '☁️ Clouds',
        value: cloudStr,
        inline: true,
      },
      // Weather
      {
        name: '🌧 Wx',
        value: wxStr,
        inline: true,
      },
      // QNH
      {
        name: '🔵 QNH',
        value: altStr,
        inline: true,
      },
      // Raw METAR
      {
        name: '📡 METAR',
        value: metar?.raw ? `\`${metar.raw}\`` : 'Unavailable',
        inline: false,
      },
    )
    .setFooter({ text: 'Liberté Air Virtual · LBA · Bon atterrissage !' })
    .setTimestamp();
}

// ── Main export ────────────────────────────────────────────────────
module.exports = function startApproachMonitor(client) {
  const cron = require('node-cron');

  // Poll every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      const api = require('axios').create({
        baseURL: process.env.PHPVMS_URL,
        headers: { 'X-API-Key': process.env.PHPVMS_API_KEY, 'Accept': 'application/json' },
        timeout: 10000,
      });

      const res    = await api.get('/api/acars');
      const active = res.data?.data || [];

      if (!active.length) return;

      const guild = client.guilds.cache.first();
      if (!guild) return;

      for (const flight of active) {
        const pirepId = flight.pirep_id || flight.id;
        if (!pirepId) continue;

        // Skip already notified
        if (notified.has(pirepId)) continue;

        // Need position data
        const lat = flight.lat ?? flight.current_lat;
        const lon = flight.lon ?? flight.current_lon;
        const gs  = flight.gs  ?? flight.groundspeed ?? 450;
        if (!lat || !lon) continue;

        // Get destination airport coords
        const arrRes  = await api.get(`/api/airports/${flight.arr_airport_id}`).catch(() => null);
        const arrData = arrRes?.data?.data || arrRes?.data;
        if (!arrData?.lat || !arrData?.lon) continue;

        // Distance to destination
        const dist = distanceNm(lat, lon, parseFloat(arrData.lat), parseFloat(arrData.lon));

        // ETA in minutes
        const etaMin = (dist / gs) * 60;

        // Trigger between 12 and 20 minutes out
        if (etaMin > 20 || etaMin < 5) continue;

        console.log(`[APPROACH] ${flight.callsign || flight.flight_number} → ${flight.arr_airport_id} ETA ${Math.round(etaMin)}min`);

        // Mark as notified immediately to prevent duplicates
        notified.add(pirepId);

        // Get pilot's Discord ID
        const userRes  = await api.get(`/api/users/${flight.user_id}`).catch(() => null);
        const userData = userRes?.data?.data || userRes?.data;
        if (!userData?.discord_id) continue;

        // Fetch METAR
        const metar = await fetchMetar(flight.arr_airport_id);

        // Get active runway
        const airport  = AIRPORTS[flight.arr_airport_id];
        const runways  = airport?.runways;
        const runway   = runways && metar
          ? getActiveRunway(runways, metar.windDir, metar.windSpeed)
          : runways?.[0] || null;

        // Gate assignment
        const routeDist = flight.distance?.nmi || flight.distance || 0;
        const gateInfo  = airport
          ? airport.gates(routeDist, flight.aircraft_type)
          : genericGate(flight.arr_airport_id, routeDist);

        // Build embed
        const embed = buildApproachEmbed({ ...flight, gs }, metar, runway, gateInfo, dist);

        // DM the pilot
        try {
          const member = await guild.members.fetch(userData.discord_id);
          await member.send({ embeds: [embed] });
          console.log(`[APPROACH] DM sent to ${member.user.tag} for ${flight.arr_airport_id}`);
        } catch (e) {
          console.warn(`[APPROACH] Could not DM pilot:`, e.message);
        }
      }
    } catch (e) {
      console.error('[APPROACH] Error:', e.message);
    }
  });

  // Clean up notified set every 12 hours
  cron.schedule('0 */12 * * *', () => {
    notified.clear();
    console.log('[APPROACH] Cleared notified flights cache');
  });

  console.log('[APPROACH] Monitor started — checking every 2 minutes');
};
