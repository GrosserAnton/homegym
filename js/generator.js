// Rule-based training plan generator (goal: muscle building).
// Split adapts to training days/week; exercises are picked from the user's equipment pool.

const B = {
  chest: ["chest"],
  back: ["lats", "middle back"],
  traps: ["traps"],
  shoulders: ["shoulders"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  quads: ["quadriceps"],
  hams: ["hamstrings", "glutes"],
  calves: ["calves"],
  abs: ["abdominals"],
};

function bucket(muscles, count, compound) {
  return { muscles, count, compound: !!compound };
}
function day(name, buckets) {
  return { name, buckets };
}

const PUSH = day("Push", [bucket(B.chest, 2, true), bucket(B.shoulders, 2, true), bucket(B.triceps, 1)]);
const PULL = day("Pull", [bucket(B.back, 2, true), bucket(B.biceps, 2), bucket(B.traps, 1)]);
const LEGS = day("Legs", [bucket(B.quads, 2, true), bucket(B.hams, 2, true), bucket(B.calves, 1), bucket(B.abs, 1)]);
const UPPER = day("Upper", [bucket(B.chest, 1, true), bucket(B.back, 1, true), bucket(B.shoulders, 1, true), bucket(B.biceps, 1), bucket(B.triceps, 1)]);
const LOWER = day("Lower", [bucket(B.quads, 2, true), bucket(B.hams, 1, true), bucket(B.calves, 1), bucket(B.abs, 1)]);

function fullBody(label) {
  return day("Full Body " + label, [
    bucket([...B.quads, ...B.hams], 1, true),
    bucket(B.chest, 1, true),
    bucket(B.back, 1, true),
    bucket(B.shoulders, 1),
    bucket([...B.biceps, ...B.triceps], 1),
    bucket(B.abs, 1),
  ]);
}

function buildSplit(days) {
  const n = Math.max(2, Math.min(6, days || 3));
  switch (n) {
    case 2: return [fullBody("A"), fullBody("B")];
    case 3: return [fullBody("A"), fullBody("B"), fullBody("C")];
    case 4: return [UPPER, LOWER, { ...UPPER, name: "Upper 2" }, { ...LOWER, name: "Lower 2" }];
    case 5: return [PUSH, PULL, LEGS, UPPER, LOWER];
    case 6: return [PUSH, PULL, LEGS, { ...PUSH, name: "Push 2" }, { ...PULL, name: "Pull 2" }, { ...LEGS, name: "Legs 2" }];
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function score(e, b) {
  let s = 0;
  if (b.compound && e.mechanic === "compound") s += 3;
  if (e.mechanic === "compound") s += 1;
  if (e.level === "beginner") s += 1;
  else if (e.level === "intermediate") s += 0.5;
  return s;
}

function selectExercises(pool, b, used) {
  let cands = pool.filter((e) => e.primaryMuscles.some((m) => b.muscles.includes(m)));
  cands = shuffle(cands).sort((x, y) => score(y, b) - score(x, b));
  const out = [];
  for (const e of cands) {
    if (out.length >= b.count) break;
    if (used.has(e.id)) continue;
    out.push(e);
    used.add(e.id);
  }
  // If the pool is too small, allow reuse rather than leaving the slot empty.
  if (out.length < b.count) {
    for (const e of cands) {
      if (out.length >= b.count) break;
      if (out.includes(e)) continue;
      out.push(e);
    }
  }
  return out;
}

// Returns a plan object: { name, source, days: [{ name, exercises: [{exerciseId, exerciseName, sets, reps}] }] }
export function generatePlan(exercises, allowedEquip, daysPerWeek) {
  const pool = exercises.filter(
    (e) =>
      e.category === "strength" &&
      e.images && e.images.length > 0 &&
      (allowedEquip.has(e.equipment) || e.equipment === "body only")
  );

  const template = buildSplit(daysPerWeek);
  const used = new Set();

  const days = template.map((d) => {
    const exs = [];
    for (const b of d.buckets) {
      for (const e of selectExercises(pool, b, used)) {
        const compound = e.mechanic === "compound";
        exs.push({
          exerciseId: e.id,
          exerciseName: e.name,
          sets: compound ? 4 : 3,
          reps: compound ? "6-10" : "10-12",
        });
      }
    }
    return { name: d.name, exercises: exs };
  });

  return { name: `Auto Plan · ${Math.max(2, Math.min(6, daysPerWeek || 3))} days`, source: "auto", days };
}
