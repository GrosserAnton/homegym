// Inline SVG illustrations for equipment (currentColor so cards can tint them).
// Keys match the equipment ids in data.js (EQUIPMENT_OPTIONS) plus "bodyweight".

const S = (inner, vb = "0 0 64 64") =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const fill = 'fill="currentColor" stroke="none"';

export const EQUIP_ICON = {
  dumbbell: S(`
    <line x1="25" y1="32" x2="39" y2="32" stroke-width="4"/>
    <rect x="17" y="21" width="7" height="22" rx="3" ${fill}/>
    <rect x="40" y="21" width="7" height="22" rx="3" ${fill}/>
    <rect x="11" y="25" width="5" height="14" rx="2" ${fill}/>
    <rect x="48" y="25" width="5" height="14" rx="2" ${fill}/>`),

  barbell: S(`
    <line x1="17" y1="32" x2="47" y2="32" stroke-width="3.5"/>
    <rect x="12" y="22" width="6" height="20" rx="2.5" ${fill}/>
    <rect x="46" y="22" width="6" height="20" rx="2.5" ${fill}/>
    <rect x="7" y="26" width="4" height="12" rx="1.5" ${fill}/>
    <rect x="53" y="26" width="4" height="12" rx="1.5" ${fill}/>`),

  kettlebells: S(`
    <path d="M25 27c0-9 14-9 14 0" fill="none" stroke-width="3.5"/>
    <path d="M25 26h14c3 2 6 7 6 13a13 13 0 0 1-26 0c0-6 3-11 6-13z" ${fill}/>
    <circle cx="32" cy="38" r="4" fill="none" stroke-width="2" opacity="0.5"/>`),

  bands: S(`
    <path d="M15 46q17-26 34 0" stroke-width="3"/>
    <path d="M15 50q17-24 34 0" stroke-width="3"/>
    <path d="M15 54q17-22 34 0" stroke-width="3"/>`),

  // Clear cable machine: column with a weight stack, top arm, pulley, cable + D-handle.
  cable: S(`
    <rect x="13" y="11" width="13" height="42" rx="2"/>
    <rect x="16" y="17" width="7" height="4" rx="1" ${fill}/>
    <rect x="16" y="22" width="7" height="4" rx="1" ${fill}/>
    <rect x="16" y="27" width="7" height="4" rx="1" ${fill}/>
    <path d="M26 15h16"/>
    <circle cx="42" cy="19" r="3.5"/>
    <path d="M42 22.5v10"/>
    <path d="M42 32a5.5 5.5 0 0 1 0 12" stroke-width="3"/>`),

  // Selectorized machine: weight stack + seat with backrest (distinct from the cable).
  machine: S(`
    <rect x="12" y="13" width="11" height="40" rx="2"/>
    <rect x="15" y="19" width="5" height="4" rx="1" ${fill}/>
    <rect x="15" y="24" width="5" height="4" rx="1" ${fill}/>
    <rect x="15" y="29" width="5" height="4" rx="1" ${fill}/>
    <path d="M23 17h14"/>
    <path d="M42 15v20"/>
    <rect x="30" y="35" width="16" height="4" rx="2" ${fill}/>
    <path d="M31 39v11M45 39v11"/>`),

  // Medicine / slam ball for "other gear".
  other: S(`
    <circle cx="32" cy="32" r="15"/>
    <path d="M20 27q12 6 24 0M20 37q12-6 24 0M32 17v30"/>`),

  bodyweight: S(`
    <circle cx="32" cy="14" r="5" ${fill}/>
    <path d="M32 20v13" stroke-width="4"/>
    <path d="M21 26h22" stroke-width="4"/>
    <path d="M32 33l-8 13M32 33l8 13" stroke-width="4"/>`),
};

// Wider illustration for the "Full gym" card (rendered in gold): dumbbell + rack.
export const GYM_ART = S(`
  <line x1="38" y1="21" x2="58" y2="21" stroke-width="4"/>
  <rect x="30" y="13" width="7" height="16" rx="3" ${fill}/>
  <rect x="59" y="13" width="7" height="16" rx="3" ${fill}/>
  <rect x="23" y="17" width="5" height="8" rx="2" ${fill}/>
  <rect x="68" y="17" width="5" height="8" rx="2" ${fill}/>
  <path d="M16 41h64" stroke-width="3"/>
  <path d="M21 41v13M75 41v13" stroke-width="3"/>
  <circle cx="30" cy="36" r="4" ${fill}/><circle cx="44" cy="36" r="4" ${fill}/>
  <circle cx="58" cy="36" r="4" ${fill}/><circle cx="72" cy="36" r="4" ${fill}/>`, "0 0 96 64");
