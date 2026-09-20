/* ═══════════════════════════════════════════════════════════════════════════
   KONFIGURASI GLOBAL — KORSA 2026 BULU TANGKIS
   Sesuai Hasil TM 20 Agustus 2026
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO KONTINGEN
   ═══════════════════════════════════════════════════════════════════════════ */
export const LOGOS = {
  "BIODEX":     "assets/logos/biodex.png?v=20260920-opt",
  "AMONIAK":    "assets/logos/amoniak.png?v=20260920-opt",
  "NPK KAKAO":  "assets/logos/npk-kakao.png?v=20260920-opt",
  "NITREA":     "assets/logos/nitrea.png?v=20260920-opt",
  "NPK JOS":    "assets/logos/npk-jos.png?v=20260920-opt",
  "PRECIPALM":  "assets/logos/precipalm.png?v=20260920-opt",
  "HUMACTIVE":  "assets/logos/humactive.png?v=20260920-opt",
  "ECOFERT":    "assets/logos/ecofert.png?v=20260920-opt",
};

export const KORSA_ON_LIGHT = "assets/logos/korsa-on-light.png?v=20260920-opt";
export const KORSA_ON_DARK  = "assets/logos/korsa-on-dark.png?v=20260920-opt";

/* ═══════════════════════════════════════════════════════════════════════════
   INFO EVENT
   ═══════════════════════════════════════════════════════════════════════════ */
export const EVENT = {
  name: "Bulu Tangkis",
  edition: "KORSA 2026",
  venue: "GOR Pupuk Kaltim",
  dateRange: "21–28 September 2026",
  organizer: "PT Pupuk Kalimantan Timur",
};

/* ═══════════════════════════════════════════════════════════════════════════
   KATEGORI DEFAULT — 7 PARTAI (urutan sesuai TM)
   ═══════════════════════════════════════════════════════════════════════════ */
export const DEFAULT_CATEGORIES = [
  'Ganda Putra Bebas (TKO)',
  'Ganda Putri',
  'Ganda Putra Esselon',
  'Ganda Putra Bebas (TKO)',
  'Ganda Putra 40+',
  'Ganda Putra Bebas (TKO)',
  'Ganda Putra Bebas (Pasangan TKO & TKO)',
];

/* ═══════════════════════════════════════════════════════════════════════════
   ATURAN BULU TANGKIS KORSA
   ═══════════════════════════════════════════════════════════════════════════ */
export const RULES = {
  POINTS_TO_WIN: 15,       // menang set di 15 poin
  WIN_BY: 2,               // selisih minimal 2 poin
  NO_CAP: true,            // tanpa cap (14-14 → lanjut sampai selisih 2)
  GAMES_TO_WIN: 2,         // best of 3
  MAX_GAMES: 3,
  MIN_CATEGORIES: 1,       // minimal kategori supaya bisa diselesaikan
};

/* Skor set yang valid — pemenang otomatis ditentukan */
/* Format: pemenang, jumlah set yang dimainkan */
export const SET_SCORES = [
  { value: '2-0', winner: 'A', games: 2 },
  { value: '2-1', winner: 'A', games: 3 },
  { value: '0-2', winner: 'B', games: 2 },
  { value: '1-2', winner: 'B', games: 3 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   POOL — 2 Pool
   ═══════════════════════════════════════════════════════════════════════════ */
export const POOLS = {
  A: ['BIODEX', 'AMONIAK', 'NPK KAKAO', 'NITREA'],
  B: ['NPK JOS', 'PRECIPALM', 'HUMACTIVE', 'ECOFERT'],
};

/* ═══════════════════════════════════════════════════════════════════════════
   JADWAL PERTANDINGAN — sesuai TM
   ═══════════════════════════════════════════════════════════════════════════ */
export const SCHEDULE = [
  { id:'P1',  date:'21 SEPT', day:'SENIN',  time:'19.00', mejas:[1,2], pool:'A', teamA:'BIODEX',     teamB:'AMONIAK',     phase:'PENYISIHAN' },
  { id:'P2',  date:'21 SEPT', day:'SENIN',  time:'19.00', mejas:[3,4], pool:'B', teamA:'NPK JOS',    teamB:'PRECIPALM',   phase:'PENYISIHAN' },
  { id:'P3',  date:'22 SEPT', day:'SELASA', time:'19.00', mejas:[1,2], pool:'A', teamA:'NPK KAKAO',  teamB:'NITREA',      phase:'PENYISIHAN' },
  { id:'P4',  date:'22 SEPT', day:'SELASA', time:'19.00', mejas:[3,4], pool:'B', teamA:'HUMACTIVE',  teamB:'ECOFERT',     phase:'PENYISIHAN' },
  { id:'P5',  date:'23 SEPT', day:'RABU',   time:'19.00', mejas:[1,2], pool:'A', teamA:'BIODEX',     teamB:'NPK KAKAO',   phase:'PENYISIHAN' },
  { id:'P6',  date:'23 SEPT', day:'RABU',   time:'19.00', mejas:[3,4], pool:'B', teamA:'NPK JOS',    teamB:'HUMACTIVE',   phase:'PENYISIHAN' },
  { id:'P7',  date:'24 SEPT', day:'KAMIS',  time:'19.00', mejas:[1,2], pool:'B', teamA:'PRECIPALM',  teamB:'ECOFERT',     phase:'PENYISIHAN' },
  { id:'P8',  date:'24 SEPT', day:'KAMIS',  time:'19.00', mejas:[3,4], pool:'A', teamA:'AMONIAK',    teamB:'NITREA',      phase:'PENYISIHAN' },
  { id:'P9',  date:'25 SEPT', day:'JUMAT',  time:'19.00', mejas:[1,2], pool:'B', teamA:'ECOFERT',    teamB:'NPK JOS',     phase:'PENYISIHAN' },
  { id:'P10', date:'25 SEPT', day:'JUMAT',  time:'19.00', mejas:[3,4], pool:'A', teamA:'NITREA',     teamB:'BIODEX',      phase:'PENYISIHAN' },
  { id:'P11', date:'26 SEPT', day:'SABTU',  time:'19.00', mejas:[1,2], pool:'B', teamA:'HUMACTIVE',  teamB:'PRECIPALM',   phase:'PENYISIHAN' },
  { id:'P12', date:'26 SEPT', day:'SABTU',  time:'19.00', mejas:[3,4], pool:'A', teamA:'NPK KAKAO',  teamB:'AMONIAK',     phase:'PENYISIHAN' },
  { id:'P13', date:'27 SEPT', day:'MINGGU', time:'19.00', mejas:[1,2], pool:null, teamA:'JUARA POOL A', teamB:'RUNNER UP POOL B', phase:'SEMI FINAL' },
  { id:'P14', date:'27 SEPT', day:'MINGGU', time:'19.00', mejas:[3,4], pool:null, teamA:'JUARA POOL B', teamB:'RUNNER UP POOL A', phase:'SEMI FINAL' },
  { id:'P15', date:'28 SEPT', day:'SENIN',  time:'19.00', mejas:[2,4], pool:null, teamA:'MENANG P13', teamB:'MENANG P14', phase:'GRAND FINAL' },
];

export const MATCH_BY_ID = Object.fromEntries(SCHEDULE.map(m => [m.id, m]));

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS
   ═══════════════════════════════════════════════════════════════════════════ */
export const STATUS_LABEL = {
  waiting:  'Menunggu',
  live:     'Live',
  finished: 'Selesai',
};

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE KEY
   ═══════════════════════════════════════════════════════════════════════════ */
export const STORE_KEY = 'korsa2026_badminton_v2';
