// App state + all Supabase reads/writes.
import { supa } from "./supabase.js";
import { loadExercises } from "./data.js";

export const state = {
  user: null,
  profile: null,
  plans: [],
  exercises: [],
  exIndex: new Map(),
  currentWorkout: null, // { planId, planName, dayName, entries:[{exerciseId, exerciseName, sets:[{weight,reps,done}]}] }
};

export async function initExercises() {
  if (state.exercises.length) return;
  state.exercises = await loadExercises();
  state.exIndex = new Map(state.exercises.map((e) => [e.id, e]));
}
export function getExercise(id) {
  return state.exIndex.get(id);
}

// ---------- auth ----------
export async function refreshUser() {
  const { data } = await supa.auth.getSession();
  state.user = data.session?.user ?? null;
  return state.user;
}
// signIn/signUp only authenticate. Setting state.user + bootstrapping happens
// exclusively in app.js onAuthStateChange, so the "user changed" guard there
// stays correct and the login screen re-renders to the app.
export async function signUp(email, password, username) {
  const { data, error } = await supa.auth.signUp({
    email, password, options: { data: { username } },
  });
  if (error) throw error;
  return data; // caller inspects data.session (null => needs email confirmation)
}
// Login by username: resolve username -> account email server-side, then sign in.
export async function signInWithUsername(username, password) {
  const uname = (username || "").trim();
  const { data: email, error: rpcErr } = await supa.rpc("gym_email_for_username", { uname });
  if (rpcErr) throw rpcErr;
  if (!email) throw new Error("Username not found. Have you registered yet?");
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Wrong username or password.");
}
export async function usernameAvailable(username) {
  const { data, error } = await supa.rpc("gym_username_available", { uname: (username || "").trim() });
  if (error) throw error;
  return data === true;
}
export async function signOut() {
  await supa.auth.signOut();
  state.user = null; state.profile = null; state.plans = []; state.currentWorkout = null;
}

// ---------- profile ----------
export async function loadProfile() {
  if (!state.user) return null;
  const { data, error } = await supa.from("gym_profiles").select("*").eq("user_id", state.user.id).maybeSingle();
  if (error) throw error;
  state.profile = data;
  return data;
}
export async function ensureProfile() {
  await loadProfile();
  if (!state.profile && state.user) {
    const uname = state.user.user_metadata?.username || (state.user.email || "athlete").split("@")[0];
    await saveProfile({ username: uname, equipment: ["dumbbell"], goal: "muscle", days_per_week: 3 });
  }
  return state.profile;
}
export async function saveProfile(patch) {
  const payload = { user_id: state.user.id, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supa.from("gym_profiles").upsert(payload).select().maybeSingle();
  if (error) throw error;
  state.profile = data;
  return data;
}

// ---------- plans ----------
export async function loadPlans() {
  const { data, error } = await supa.from("gym_plans").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  state.plans = data || [];
  return state.plans;
}
export async function savePlan(plan) {
  const payload = {
    name: plan.name || "My Plan",
    source: plan.source || "manual",
    days: plan.days || [],
    updated_at: new Date().toISOString(),
  };
  if (plan.id) payload.id = plan.id;
  if (state.user) payload.user_id = state.user.id;
  const { data, error } = await supa.from("gym_plans").upsert(payload).select().maybeSingle();
  if (error) throw error;
  await loadPlans();
  return data;
}
export async function deletePlan(id) {
  const { error } = await supa.from("gym_plans").delete().eq("id", id);
  if (error) throw error;
  await loadPlans();
}

// ---------- workout logs ----------
export async function lastLog(exerciseId) {
  const { data } = await supa
    .from("gym_logs").select("sets")
    .eq("exercise_id", exerciseId)
    .order("performed_at", { ascending: false })
    .limit(1).maybeSingle();
  return data?.sets || null;
}
export async function saveWorkout(session) {
  const sid = crypto.randomUUID();
  const rows = session.entries
    .map((en) => ({
      session_id: sid,
      plan_id: session.planId || null,
      day_name: session.dayName || null,
      exercise_id: en.exerciseId,
      exercise_name: en.exerciseName,
      sets: en.sets
        .filter((s) => (s.reps || s.weight))
        .map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      user_id: state.user.id,
    }))
    .filter((r) => r.sets.length > 0);
  if (!rows.length) return { count: 0 };
  const { error } = await supa.from("gym_logs").insert(rows);
  if (error) throw error;
  return { count: rows.length, sessionId: sid };
}
export async function loadHistory() {
  const { data, error } = await supa
    .from("gym_logs").select("*")
    .order("performed_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const map = new Map();
  for (const r of data || []) {
    if (!map.has(r.session_id)) {
      map.set(r.session_id, { session_id: r.session_id, day_name: r.day_name, performed_at: r.performed_at, items: [] });
    }
    map.get(r.session_id).items.push(r);
  }
  return [...map.values()];
}
export async function workoutCount() {
  const { count } = await supa.from("gym_logs").select("session_id", { count: "exact", head: true });
  return count || 0;
}

// ---------- nutrition ----------
const FOOD_FIELDS = "name,brand,code,amount_g,meal,kcal,protein,carbs,fat,micros";

function rowFromItem(it, logDate, meal, source = "manual", recurringId = null) {
  return {
    user_id: state.user.id, log_date: logDate, meal: meal || it.meal || "breakfast",
    source, recurring_id: recurringId,
    name: it.name, brand: it.brand || null, code: it.code || null, amount_g: it.amount_g || null,
    kcal: it.kcal || 0, protein: it.protein || 0, carbs: it.carbs || 0, fat: it.fat || 0, micros: it.micros || {},
  };
}

export async function loadNutrition(logDate) {
  await ensureRecurringForDate(logDate);
  const { data, error } = await supa
    .from("gym_nutrition_logs").select("*")
    .eq("log_date", logDate)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function addNutrition(entry) {
  const payload = { ...entry, user_id: state.user.id };
  const { data, error } = await supa.from("gym_nutrition_logs").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}
export async function deleteNutrition(id) {
  const { error } = await supa.from("gym_nutrition_logs").delete().eq("id", id);
  if (error) throw error;
}
export async function updateNutrition(id, patch) {
  const { data, error } = await supa.from("gym_nutrition_logs").update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}
export async function loadNutritionRange(from, to) {
  const { data, error } = await supa
    .from("gym_nutrition_logs").select("log_date,kcal")
    .gte("log_date", from).lte("log_date", to);
  if (error) throw error;
  return data || [];
}
export async function copyEntriesToDates(entries, dates, mealOverride) {
  const rows = [];
  for (const dt of dates) for (const e of entries) rows.push(rowFromItem(e, dt, mealOverride || e.meal));
  if (!rows.length) return 0;
  const { error } = await supa.from("gym_nutrition_logs").insert(rows);
  if (error) throw error;
  return rows.length;
}
export async function recentFoods(limit = 15) {
  const { data } = await supa
    .from("gym_nutrition_logs").select(FOOD_FIELDS)
    .order("created_at", { ascending: false }).limit(120);
  const seen = new Set();
  const out = [];
  for (const r of data || []) {
    const k = (r.name + "|" + (r.brand || "")).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------- saved meals ----------
export async function loadMeals() {
  const { data, error } = await supa.from("gym_meals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function saveMeal(name, items) {
  const { data, error } = await supa.from("gym_meals").insert({ user_id: state.user.id, name, items }).select().maybeSingle();
  if (error) throw error;
  return data;
}
export async function deleteMeal(id) {
  const { error } = await supa.from("gym_meals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- recurring meals ----------
export async function loadRecurring() {
  const { data, error } = await supa.from("gym_recurring").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function saveRecurring(rule) {
  const payload = {
    user_id: state.user.id, name: rule.name || null, meal: rule.meal || "breakfast",
    items: rule.items || [], freq: rule.freq || "daily", weekday: rule.weekday ?? null,
    start_date: rule.start_date || new Date().toISOString().slice(0, 10), active: rule.active !== false,
  };
  if (rule.id) payload.id = rule.id;
  const { data, error } = await supa.from("gym_recurring").upsert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}
export async function deleteRecurring(id) {
  const { error } = await supa.from("gym_recurring").delete().eq("id", id);
  if (error) throw error;
}
export async function skipRecurringForDate(recurringId, logDate) {
  const { data } = await supa.from("gym_recurring").select("skips").eq("id", recurringId).maybeSingle();
  const skips = new Set(data?.skips || []);
  skips.add(logDate);
  await supa.from("gym_recurring").update({ skips: [...skips] }).eq("id", recurringId);
}

// Materialize recurring meals into a day's log (once), respecting per-day skips.
async function ensureRecurringForDate(logDate) {
  const rules = await loadRecurring();
  const active = rules.filter((r) => r.active);
  if (!active.length) return;
  const weekday = new Date(logDate + "T00:00:00").getDay();
  const applicable = active.filter((r) =>
    logDate >= r.start_date &&
    (r.freq === "daily" || (r.freq === "weekly" && r.weekday === weekday)) &&
    !(r.skips || []).includes(logDate)
  );
  if (!applicable.length) return;
  const { data: existing } = await supa
    .from("gym_nutrition_logs").select("recurring_id")
    .eq("log_date", logDate).not("recurring_id", "is", null);
  const done = new Set((existing || []).map((r) => r.recurring_id));
  const rows = [];
  for (const r of applicable) {
    if (done.has(r.id)) continue;
    for (const it of r.items || []) rows.push(rowFromItem(it, logDate, r.meal, "recurring", r.id));
  }
  if (rows.length) await supa.from("gym_nutrition_logs").insert(rows);
}

// ---------- body weight ----------
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export async function loadWeights() {
  const { data, error } = await supa.from("gym_weight_logs").select("*").order("log_date", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function addWeight(logDate, kg) {
  const { data, error } = await supa.from("gym_weight_logs")
    .upsert({ user_id: state.user.id, log_date: logDate, weight_kg: kg }, { onConflict: "user_id,log_date" })
    .select().maybeSingle();
  if (error) throw error;
  if (logDate === localToday()) { try { await saveProfile({ weight_kg: kg }); } catch (e) {} }
  return data;
}
export async function deleteWeight(id) {
  const { error } = await supa.from("gym_weight_logs").delete().eq("id", id);
  if (error) throw error;
}
