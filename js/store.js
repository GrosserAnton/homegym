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
export async function loadNutrition(logDate) {
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
export async function recentFoods(limit = 12) {
  const { data } = await supa
    .from("gym_nutrition_logs")
    .select("name,brand,code,amount_g,kcal,protein,carbs,fat")
    .order("created_at", { ascending: false })
    .limit(80);
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
