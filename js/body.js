// Stylized front/back muscle map. Given the muscles a workout day trains,
// it highlights them on two simple silhouettes (front + back view).
// Muscle names match the free-exercise-db strings used in data/exercises.json.

const BASE = "#3d4358";        // resting muscle (visible on the dark card)
const PRIMARY = "#3f7bf0";     // primary muscle worked
const SECONDARY = "#2a4d8f";   // secondary / assisting muscle

function fillFor(m, primary, secondary) {
  if (primary.has(m)) return PRIMARY;
  if (secondary.has(m)) return SECONDARY;
  return BASE;
}

// primary/secondary: Sets of muscle-name strings.
export function muscleFigures(primary, secondary) {
  const f = (m) => fillFor(m, primary, secondary);

  const front = `<svg class="bodyfig" viewBox="0 0 120 240" aria-hidden="true">
    <ellipse cx="60" cy="22" rx="13" ry="15" fill="${BASE}"/>
    <rect x="53" y="33" width="14" height="10" rx="4" fill="${f("neck")}"/>
    <path d="M47 40 L60 44 L60 50 L44 48 Z" fill="${f("traps")}"/>
    <path d="M73 40 L60 44 L60 50 L76 48 Z" fill="${f("traps")}"/>
    <ellipse cx="37" cy="52" rx="12" ry="11" fill="${f("shoulders")}"/>
    <ellipse cx="83" cy="52" rx="12" ry="11" fill="${f("shoulders")}"/>
    <path d="M46 46 Q46 62 59 64 L59 47 Q53 45 46 46 Z" fill="${f("chest")}"/>
    <path d="M74 46 Q74 62 61 64 L61 47 Q67 45 74 46 Z" fill="${f("chest")}"/>
    <rect x="28" y="58" width="13" height="26" rx="6.5" fill="${f("biceps")}"/>
    <rect x="79" y="58" width="13" height="26" rx="6.5" fill="${f("biceps")}"/>
    <rect x="24" y="85" width="12" height="26" rx="6" fill="${f("forearms")}"/>
    <rect x="84" y="85" width="12" height="26" rx="6" fill="${f("forearms")}"/>
    <rect x="50" y="66" width="20" height="34" rx="7" fill="${f("abdominals")}"/>
    <path d="M45 104 L58 104 L56 156 L47 156 Z" fill="${f("quadriceps")}"/>
    <path d="M75 104 L62 104 L64 156 L73 156 Z" fill="${f("quadriceps")}"/>
    <path d="M58 106 L62 106 L61 150 L59 150 Z" fill="${f("adductors")}"/>
    <rect x="47" y="160" width="11" height="46" rx="5" fill="${BASE}"/>
    <rect x="62" y="160" width="11" height="46" rx="5" fill="${BASE}"/>
  </svg>`;

  const back = `<svg class="bodyfig" viewBox="0 0 120 240" aria-hidden="true">
    <ellipse cx="60" cy="22" rx="13" ry="15" fill="${BASE}"/>
    <rect x="53" y="33" width="14" height="10" rx="4" fill="${f("neck")}"/>
    <path d="M45 40 L60 43 L75 40 L68 62 L60 66 L52 62 Z" fill="${f("traps")}"/>
    <ellipse cx="37" cy="52" rx="12" ry="11" fill="${f("shoulders")}"/>
    <ellipse cx="83" cy="52" rx="12" ry="11" fill="${f("shoulders")}"/>
    <rect x="28" y="58" width="13" height="26" rx="6.5" fill="${f("triceps")}"/>
    <rect x="79" y="58" width="13" height="26" rx="6.5" fill="${f("triceps")}"/>
    <rect x="24" y="85" width="12" height="26" rx="6" fill="${f("forearms")}"/>
    <rect x="84" y="85" width="12" height="26" rx="6" fill="${f("forearms")}"/>
    <path d="M45 60 L54 64 L52 88 L44 78 Z" fill="${f("lats")}"/>
    <path d="M75 60 L66 64 L68 88 L76 78 Z" fill="${f("lats")}"/>
    <rect x="54" y="64" width="12" height="20" rx="4" fill="${f("middle back")}"/>
    <rect x="52" y="85" width="16" height="16" rx="5" fill="${f("lower back")}"/>
    <path d="M48 102 Q47 122 59 122 L59 103 Z" fill="${f("glutes")}"/>
    <path d="M72 102 Q73 122 61 122 L61 103 Z" fill="${f("glutes")}"/>
    <path d="M43 104 L48 103 L48 118 L44 116 Z" fill="${f("abductors")}"/>
    <path d="M77 104 L72 103 L72 118 L76 116 Z" fill="${f("abductors")}"/>
    <path d="M47 124 L59 124 L57 162 L49 162 Z" fill="${f("hamstrings")}"/>
    <path d="M73 124 L61 124 L63 162 L71 162 Z" fill="${f("hamstrings")}"/>
    <path d="M48 166 L58 166 L56 208 L50 208 Z" fill="${f("calves")}"/>
    <path d="M72 166 L62 166 L64 208 L70 208 Z" fill="${f("calves")}"/>
  </svg>`;

  return `<div class="bodyfigs">${front}${back}</div>`;
}
