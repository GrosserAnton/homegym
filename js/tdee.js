// Mifflin-St Jeor BMR -> TDEE -> kcal + macro targets, plus micro reference amounts.

export const ACTIVITY = [
  { id: "sedentary", label: "Sedentary (little/no exercise)", factor: 1.2 },
  { id: "light", label: "Light (1–3×/week)", factor: 1.375 },
  { id: "moderate", label: "Moderate (3–5×/week)", factor: 1.55 },
  { id: "active", label: "Active (6–7×/week)", factor: 1.725 },
  { id: "very_active", label: "Very active (hard training / physical job)", factor: 1.9 },
];

export const WEIGHT_GOALS = [
  { id: "lose", label: "Lose weight", kcal: -500 },
  { id: "maintain", label: "Maintain", kcal: 0 },
  { id: "gain", label: "Gain muscle", kcal: 350 },
];

// Returns { kcal_goal, protein_goal, fat_goal, carb_goal, tdee } or null if inputs incomplete.
export function computeTargets({ weight_kg, height_cm, age, sex, activity, weight_goal }) {
  const w = Number(weight_kg), h = Number(height_cm), a = Number(age);
  if (!(w > 0 && h > 0 && a > 0)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "female" ? -161 : 5);
  const af = (ACTIVITY.find((x) => x.id === activity) || ACTIVITY[2]).factor;
  const tdee = bmr * af;
  const goal = WEIGHT_GOALS.find((x) => x.id === weight_goal) || WEIGHT_GOALS[1];
  const kcal = Math.round((tdee + goal.kcal) / 10) * 10;
  const protein = Math.round(w * 2.0);          // 2 g per kg bodyweight
  const fat = Math.round((kcal * 0.25) / 9);    // 25% of kcal from fat
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal_goal: kcal, protein_goal: protein, fat_goal: fat, carb_goal: carbs, tdee: Math.round(tdee) };
}

// Reference daily amounts for micros (display units). Some are sex-dependent.
export function rdaFor(sex) {
  const female = sex === "female";
  return {
    fiber: 30, sugars: 50, sat_fat: 20, salt: 6,
    iron: female ? 15 : 10, calcium: 1000, potassium: 3500,
    magnesium: female ? 300 : 350, zinc: female ? 8 : 10,
    vitamin_c: 95, vitamin_a: female ? 700 : 850, vitamin_d: 20,
  };
}
