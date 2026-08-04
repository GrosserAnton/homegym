// Exercise data (yuhonas/free-exercise-db, public domain) + helpers.

let _exercises = null;

export async function loadExercises() {
  if (_exercises) return _exercises;
  const res = await fetch("./data/exercises.json");
  if (!res.ok) throw new Error("Could not load exercise database");
  _exercises = await res.json();
  return _exercises;
}

// Exercise images live in the free-exercise-db repo, served via jsDelivr CDN.
const IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
export function imageUrl(path) {
  return IMAGE_BASE + path;
}

// Equipment options shown in the profile -> which DB `equipment` values they unlock.
// Bodyweight ("body only") is always available and not listed here.
export const EQUIPMENT_OPTIONS = [
  { id: "dumbbell",    label: "Dumbbells",        db: ["dumbbell"] },
  { id: "barbell",     label: "Barbell",          db: ["barbell", "e-z curl bar"] },
  { id: "kettlebells", label: "Kettlebell",       db: ["kettlebells"] },
  { id: "bands",       label: "Resistance Bands", db: ["bands"] },
  { id: "cable",       label: "Cable",            db: ["cable"] },
  { id: "machine",     label: "Machines",         db: ["machine"] },
  { id: "other",       label: "Other gear",       db: ["other", "medicine ball", "exercise ball", "foam roll"] },
];

export const ALWAYS_EQUIPMENT = ["body only"];

// Set of DB equipment strings the user can currently use.
export function allowedDbEquipment(selectedIds) {
  const set = new Set(ALWAYS_EQUIPMENT);
  for (const opt of EQUIPMENT_OPTIONS) {
    if (selectedIds && selectedIds.includes(opt.id)) opt.db.forEach((d) => set.add(d));
  }
  return set;
}

export function prettyMuscle(m) {
  if (!m) return "";
  return m.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Muscle-group chips for the exercise library.
export const MUSCLE_FILTERS = [
  { id: "all",       label: "All",       muscles: null },
  { id: "chest",     label: "Chest",     muscles: ["chest"] },
  { id: "back",      label: "Back",      muscles: ["lats", "middle back", "lower back", "traps"] },
  { id: "shoulders", label: "Shoulders", muscles: ["shoulders", "neck"] },
  { id: "arms",      label: "Arms",      muscles: ["biceps", "triceps", "forearms"] },
  { id: "legs",      label: "Legs",      muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { id: "abs",       label: "Abs",       muscles: ["abdominals"] },
];
