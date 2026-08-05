// Inline SVG illustrations for equipment (currentColor so cards can tint them).
// Keys match the equipment ids in data.js (EQUIPMENT_OPTIONS) plus "bodyweight".

const S = (inner, vb = "0 0 64 64") =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const EQUIP_ICON = {
  dumbbell: S(`
    <line x1="24" y1="32" x2="40" y2="32"/>
    <rect x="16" y="23" width="6" height="18" rx="2" fill="currentColor" stroke="none"/>
    <rect x="42" y="23" width="6" height="18" rx="2" fill="currentColor" stroke="none"/>
    <rect x="10" y="27" width="5" height="10" rx="2" fill="currentColor" stroke="none"/>
    <rect x="49" y="27" width="5" height="10" rx="2" fill="currentColor" stroke="none"/>`),
  barbell: S(`
    <line x1="15" y1="32" x2="49" y2="32"/>
    <rect x="10" y="24" width="5" height="16" rx="2" fill="currentColor" stroke="none"/>
    <rect x="49" y="24" width="5" height="16" rx="2" fill="currentColor" stroke="none"/>
    <rect x="5" y="27" width="4" height="10" rx="1.5" fill="currentColor" stroke="none"/>
    <rect x="55" y="27" width="4" height="10" rx="1.5" fill="currentColor" stroke="none"/>`),
  kettlebells: S(`
    <path d="M25 24a7 7 0 0 1 14 0"/>
    <path d="M24 25h16c4 2 8 7 8 15a16 16 0 0 1-32 0c0-8 4-13 8-15z" fill="currentColor" stroke="none"/>`),
  bands: S(`
    <circle cx="15" cy="20" r="6"/>
    <circle cx="15" cy="44" r="6"/>
    <path d="M21 22q18 4 24 10M21 42q18-4 24-10"/>
    <circle cx="48" cy="32" r="3" fill="currentColor" stroke="none"/>`),
  cable: S(`
    <line x1="14" y1="12" x2="46" y2="12"/>
    <circle cx="40" cy="17" r="4"/>
    <path d="M40 21v13"/>
    <rect x="33" y="34" width="14" height="5" rx="1.5" fill="currentColor" stroke="none"/>
    <path d="M40 39v9"/>`),
  machine: S(`
    <rect x="14" y="12" width="18" height="40" rx="2"/>
    <rect x="18" y="22" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>
    <rect x="18" y="28" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>
    <rect x="18" y="34" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>
    <path d="M32 20h12v30"/>
    <circle cx="44" cy="52" r="3"/>`),
  other: S(`
    <circle cx="32" cy="32" r="16"/>
    <path d="M20 26q12 6 24 0M20 38q12-6 24 0M32 16v32"/>`),
  bodyweight: S(`
    <circle cx="32" cy="15" r="6"/>
    <path d="M32 23v16M32 27l-10-4M32 27l10-4M32 39l-8 13M32 39l8 13"/>`),
};

// Wider illustration for the "Full gym" card (rendered in gold).
export const GYM_ART = S(`
  <line x1="34" y1="26" x2="62" y2="26"/>
  <rect x="26" y="17" width="6" height="18" rx="2" fill="currentColor" stroke="none"/>
  <rect x="64" y="17" width="6" height="18" rx="2" fill="currentColor" stroke="none"/>
  <rect x="19" y="21" width="5" height="10" rx="2" fill="currentColor" stroke="none"/>
  <rect x="72" y="21" width="5" height="10" rx="2" fill="currentColor" stroke="none"/>
  <line x1="14" y1="47" x2="82" y2="47"/>
  <circle cx="27" cy="42" r="5"/><circle cx="41" cy="42" r="5"/><circle cx="55" cy="42" r="5"/><circle cx="69" cy="42" r="5"/>
  <line x1="18" y1="47" x2="18" y2="55"/><line x1="78" y1="47" x2="78" y2="55"/>`, "0 0 96 64");
