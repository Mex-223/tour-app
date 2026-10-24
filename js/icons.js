// Line icons as inline SVG, so the app needs no icon files or internet.
const svg = (paths, size = 22, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const icons = {
  today: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  schedule: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', s),
  people: (s) => svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>', s),
  money: (s) => svg('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>', s),
  docs: (s) => svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>', s),
  chevronDown: (s = 16) => svg('<path d="M6 9l6 6 6-6"/>', s, 'class="chev"'),
  chevronLeft: (s = 22) => svg('<path d="M15 5l-7 7 7 7"/>', s),
  chevronRight: (s = 22) => svg('<path d="M9 5l7 7-7 7"/>', s),
  check: (s = 16) => svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', s),
  warn: (s = 18) => svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>', s),
  info: (s = 14) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.01"/>', s),
  pin: (s = 20) => svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', s),
  phone: (s = 20) => svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', s),
  mail: (s = 20) => svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', s),
  plus: (s = 16) => svg('<path d="M12 5v14M5 12h14"/>', s),
  lock: (s = 16) => svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', s),
  close: (s = 22) => svg('<path d="M6 6l12 12M18 6L6 18"/>', s),
  // Event types
  show: (s = 16) => svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', s),
  rehearsal: (s = 16) => svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', s),
  travel: (s = 16) => svg('<path d="M3 16V8a2 2 0 0 1 2-2h9l4 4h1a2 2 0 0 1 2 2v4"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>', s),
  off: (s = 16) => svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', s),
  promo: (s = 16) => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', s)
};
