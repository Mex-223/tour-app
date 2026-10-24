// EXAMPLE DATA for step 1. In step 2 this moves to Firebase,
// so every phone sees the same, live information.
// Anything in [brackets] is a placeholder to replace with real info.

export const ME = 'mex';

export const bands = [
  { id: 'hfar', name: 'HFAR', full: 'Here For A Reason', color: '#F5A524', ink: '#1A1206' },
  { id: 'zascha', name: 'Zascha', full: 'Zascha', color: '#5B8CFF', ink: '#0B1430' },
  { id: 'mmne', name: 'MM & TNE', full: 'Moritz Molnar & The Necessary Evil', color: '#E46AA8', ink: '#2A0A1A' }
];

// role per band: 'mgmt' (can plan and edit) or 'member'
export const people = [
  { id: 'mex', name: 'Mex', instrument: 'Drums', bands: { hfar: 'mgmt', zascha: 'member', mmne: 'member' } },
  { id: 'hfar-voc', name: '[Vocals]', instrument: 'Vocals', bands: { hfar: 'member' } },
  { id: 'hfar-git', name: '[Guitar]', instrument: 'Guitar', bands: { hfar: 'member' } },
  { id: 'hfar-bass', name: '[Bass]', instrument: 'Bass', bands: { hfar: 'member' } },
  { id: 'zascha-voc', name: '[Vocals]', instrument: 'Vocals', bands: { zascha: 'mgmt' } },
  { id: 'zascha-git', name: '[Guitar]', instrument: 'Guitar', bands: { zascha: 'member' } },
  { id: 'zascha-bass', name: '[Bass]', instrument: 'Bass', bands: { zascha: 'member' } },
  { id: 'moritz', name: 'Moritz Molnar', instrument: 'Vocals, Guitar', bands: { mmne: 'mgmt' } },
  { id: 'mmne-git', name: '[Guitar]', instrument: 'Guitar', bands: { mmne: 'member' } },
  { id: 'mmne-bass', name: '[Bass]', instrument: 'Bass', bands: { mmne: 'member' } },
  { id: 'foh', name: '[FOH]', instrument: 'Sound (crew)', bands: { hfar: 'member' } }
];

export const contacts = [
  { name: '[Name]', tag: 'MGMT', bands: ['hfar'], phone: '+43 [number]', email: '[band email]' },
  { name: '[Agency] · [Name]', tag: 'Booking', bands: ['hfar', 'zascha'], phone: '+43 [office number]', email: '[booking email]' },
  { name: '[Name]', tag: 'MGMT', bands: ['zascha'], phone: '+43 [number]', email: '[band email]' },
  { name: '[Name]', tag: 'Booking', bands: ['mmne'], phone: '+43 [number]', email: '[booking email]' }
];

const HFAR = ['mex', 'hfar-voc', 'hfar-git', 'hfar-bass'];
const ZASCHA = ['mex', 'zascha-voc', 'zascha-git', 'zascha-bass'];
const MMNE = ['mex', 'moritz', 'mmne-git', 'mmne-bass'];
const ROOM = 'Proberaum';

// type: show | rehearsal | travel | off | promo
export const events = [
  { id: 'e1', band: 'zascha', type: 'rehearsal', date: '2026-11-03', time: '18:00', end: '21:00', title: 'Band rehearsal', place: ROOM, people: ZASCHA },
  { id: 'e2', band: 'mmne', type: 'rehearsal', date: '2026-11-05', time: '19:00', end: '22:00', title: 'Band rehearsal', place: ROOM, people: MMNE },
  { id: 'e3', band: 'hfar', type: 'promo', date: '2026-11-06', time: '10:00', title: 'Radio interview', place: '[Station]', people: ['hfar-voc'] },
  {
    id: 'e4', band: 'mmne', type: 'show', date: '2026-11-07', time: '20:00', title: 'Club show', place: 'Vienna', people: MMNE,
    venue: { name: '[Venue name]', address: '[Street, 1xxx Vienna]', contact: { name: '[Name]', role: 'Promoter', phone: '+43 [number]' } },
    timetable: [['17:00', 'Load-in'], ['18:00', 'Soundcheck'], ['19:30', 'Doors'], ['20:00', 'MM & TNE set · 60 min'], ['23:00', 'Curfew']]
  },
  { id: 'e5', band: 'zascha', type: 'rehearsal', date: '2026-11-10', time: '18:00', end: '21:00', title: 'Band rehearsal', place: ROOM, people: ZASCHA },
  { id: 'e6', band: 'hfar', type: 'rehearsal', date: '2026-11-12', time: '19:00', end: '22:00', title: 'Album set rehearsal', place: ROOM, people: HFAR },
  {
    id: 'e7', band: 'zascha', type: 'show', date: '2026-11-13', time: '21:00', title: 'Club show', place: 'Linz', people: ZASCHA, status: 'advanced',
    venue: { name: '[Venue name]', address: '[Street, 4xxx Linz]', contact: { name: '[Name]', role: 'Stage manager', phone: '+43 [number]' } },
    travel: { depart: '13:00', from: ROOM, method: 'Van', driver: '[Name]', cost: '[€ amount]' },
    timetable: [['16:00', 'Load-in'], ['17:30', 'Soundcheck'], ['20:00', 'Doors'], ['21:00', 'Zascha set · 60 min'], ['23:30', 'Curfew']]
  },
  {
    id: 'e8', band: 'zascha', type: 'show', date: '2026-11-14', time: '21:00', title: 'Club show', place: 'Salzburg', people: ZASCHA,
    venue: { name: '[Venue name]', address: '[Street, 5xxx Salzburg]' },
    hotel: { name: '[Hotel name]', address: '[Address]', checkIn: '15:00' },
    missing: ['times']
  },
  { id: 'e9', band: 'zascha', type: 'travel', date: '2026-11-15', time: '11:00', title: 'Drive home', place: 'Salzburg → Vienna', people: ZASCHA, travel: { depart: '11:00', from: '[Hotel]', method: 'Van', driver: '[Name]', cost: '[€ amount]' } },
  { id: 'e10', band: 'zascha', type: 'rehearsal', date: '2026-11-17', time: '18:00', end: '21:00', title: 'Band rehearsal', place: ROOM, people: ZASCHA },
  { id: 'e11', band: 'hfar', type: 'rehearsal', date: '2026-11-17', time: '19:00', end: '22:00', title: 'Album set rehearsal', place: ROOM, people: HFAR },
  { id: 'e12', band: 'hfar', type: 'rehearsal', date: '2026-11-19', time: '19:00', end: '22:00', title: 'Album set rehearsal', place: ROOM, people: HFAR },
  { id: 'e13', band: 'mmne', type: 'show', date: '2026-11-21', time: '20:30', title: 'Club show', place: 'Graz', people: MMNE, venue: { name: '[Venue name]', address: '[Street, 8xxx Graz]' }, missing: ['hotel'] },
  { id: 'e14', band: 'hfar', type: 'rehearsal', date: '2026-11-24', time: '18:00', end: '22:00', title: 'Production rehearsal', place: ROOM, people: [...HFAR, 'foh'] },
  { id: 'e15', band: 'hfar', type: 'rehearsal', date: '2026-11-26', time: '18:00', end: '21:00', title: 'Final run-through', place: ROOM, people: [...HFAR, 'foh'] },
  {
    id: 'e16', band: 'hfar', type: 'show', date: '2026-11-27', time: '21:15', title: 'Fragments release show', place: 'Vienna', people: [...HFAR, 'foh'], status: 'advanced',
    venue: {
      name: '[Venue name]', address: '[Street, 1xxx Vienna]', loadIn: '[Side entrance, parking for the van]',
      tech: 'House PA · drum riser · 6 monitor mixes', contact: { name: '[Name]', role: 'Promoter', phone: '+43 [number]' }
    },
    travel: { depart: '13:15', from: ROOM, method: 'Van', driver: '[Name]', cost: '[€ amount]' },
    catering: { text: 'Hot meal for 6 · rider drinks backstage', time: '18:00', diet: '2 vegetarian · 1 vegan' },
    guests: { used: 12, total: 20 },
    setlist: 'Fragments, full album',
    timetable: [['14:00', 'Load-in'], ['16:30', 'Soundcheck'], ['18:00', 'Dinner at venue'], ['19:30', 'Doors'], ['20:15', 'Support set'], ['21:15', 'HFAR set · 75 min'], ['23:00', 'Curfew']]
  },
  {
    id: 'e17', band: 'hfar', type: 'show', date: '2026-11-28', time: '21:00', title: 'Club show', place: 'Graz', people: [...HFAR, 'foh'],
    venue: { name: '[Venue name]', address: '[Street, 8xxx Graz]', contact: { name: '[Name]', role: 'Stage manager', phone: '+43 [number]' } },
    travel: { depart: '11:00', from: 'Vienna', method: 'Van', driver: '[Name]', cost: '[€ amount]' },
    timetable: [['16:00', 'Load-in'], ['17:30', 'Soundcheck'], ['20:00', 'Doors'], ['21:00', 'HFAR set · 70 min'], ['23:00', 'Curfew']],
    missing: ['hotel']
  },
  { id: 'e18', band: 'zascha', type: 'rehearsal', date: '2026-11-28', time: '18:00', end: '21:00', title: 'Band rehearsal', place: ROOM, people: ZASCHA },
  { id: 'e19', band: 'hfar', type: 'off', date: '2026-11-29', title: 'Day off', place: 'Home', people: HFAR },
  { id: 'e20', band: 'mmne', type: 'show', date: '2026-12-03', title: 'Club show', place: '[City]', people: MMNE, missing: ['times'] },
  { id: 'e21', band: 'zascha', type: 'rehearsal', date: '2026-12-08', time: '18:00', end: '21:00', title: 'Band rehearsal', place: ROOM, people: ZASCHA }
];

export const TYPE_LABEL = { show: 'Show', rehearsal: 'Rehearsal', travel: 'Travel', off: 'Day off', promo: 'Promo' };
export const MISSING_LABEL = { hotel: 'Hotel missing', times: 'Times not confirmed' };
