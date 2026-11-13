// Canonical list of GTBIT student societies.
// Shared by database.js (idempotent bootstrap on existing DBs) and seed.js (fresh seed).
// Descriptions are placeholders — admins can edit them from the Societies admin panel.

const GTBIT_SOCIETIES = [
  { name: 'GSGC', category: 'Technical', description: 'Placeholder: GSGC student society — update this description from the admin panel.' },
  { name: 'Technical Society of GTBIT', category: 'Technical', description: 'Placeholder: Flagship technical society running hackathons, workshops and coding events.' },
  { name: "D'Lang Chaps", category: 'Literary', description: 'Placeholder: Language, debating and literary activities society.' },
  { name: 'Google Developer Student Club', category: 'Technical', description: 'Placeholder: Google-backed developer community for learning and building with Google technologies.' },
  { name: 'IEEE', category: 'Technical', description: 'Placeholder: IEEE student branch — technical talks, research and professional networking.' },
  { name: 'NSS', category: 'Social Service', description: 'Placeholder: National Service Scheme unit — community outreach and social service drives.' },
  { name: 'Communiqué', category: 'Literary', description: 'Placeholder: Communication, public speaking and editorial society.' },
  { name: 'Infinity', category: 'Cultural', description: 'Placeholder: Infinity cultural society.' },
  { name: 'G-sharp', category: 'Cultural', description: 'Placeholder: Music society — vocals, instrumentals and band performances.' },
  { name: 'Gaming-Titans', category: 'Sports & Gaming', description: 'Placeholder: E-sports and gaming community.' },
  { name: 'Quantum Quorum', category: 'Technical', description: 'Placeholder: Quantum Quorum society.' },
  { name: 'Jangju Gatka', category: 'Cultural', description: 'Placeholder: Traditional Sikh martial art (Gatka) team.' },
  { name: 'GTBIT Finishing School', category: 'Professional', description: 'Placeholder: Placement readiness, soft skills and career grooming programme.' },
  { name: 'Prisma', category: 'Cultural', description: 'Placeholder: Prisma creative society.' },
  { name: 'Nexus', category: 'Technical', description: 'Placeholder: Nexus society.' },
  { name: 'Mindscape', category: 'Literary', description: 'Placeholder: Mindscape society.' },
  { name: 'Munistry', category: 'Literary', description: 'Placeholder: Model United Nations and diplomacy society.' },
  { name: 'Natya', category: 'Cultural', description: 'Placeholder: Dramatics and theatre society.' },
  { name: 'Technova', category: 'Technical', description: 'Placeholder: Technova technical society.' },
  { name: 'Ashke Bhangra', category: 'Cultural', description: 'Placeholder: Bhangra folk dance team.' },
  { name: 'ET-CETERA', category: 'Cultural', description: 'Placeholder: ET-CETERA society.' },
  { name: 'Divine Circle', category: 'Spiritual', description: 'Placeholder: Divine Circle spiritual and community society.' },
  { name: 'SWAAS', category: 'Social Service', description: 'Placeholder: SWAAS social initiative society.' },
  { name: 'Panorama', category: 'Creative Arts', description: 'Placeholder: Photography and visual arts society.' },
  { name: 'Epicture', category: 'Creative Arts', description: 'Placeholder: Film-making and media production society.' },
  { name: 'Aura', category: 'Cultural', description: 'Placeholder: Aura society.' },
  { name: 'Luna', category: 'Cultural', description: 'Placeholder: Luna society.' },
  { name: 'Elixir', category: 'Cultural', description: 'Placeholder: Elixir society.' },
  { name: 'Entrepreneurship Cell', category: 'Professional', description: 'Placeholder: E-Cell — startup incubation, founder talks and business plan competitions.' }
];

module.exports = { GTBIT_SOCIETIES };

