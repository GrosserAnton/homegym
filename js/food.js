// Open Food Facts integration (free, no API key) + native barcode scanning.

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function has(v) {
  return v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));
}

const FIELDS = "code,product_name,product_name_de,brands,nutriments,serving_size,serving_quantity";

// Micronutrients we try to read from Open Food Facts.
// `off` = key in nutriments (per 100g, stored in grams); `factor` converts grams -> display unit.
// `limit: true` marks values you want to stay UNDER (sugar, sat fat, salt).
export const MICRO_SPEC = [
  { key: "fiber", off: "fiber_100g", label: "Fiber", unit: "g", factor: 1 },
  { key: "sugars", off: "sugars_100g", label: "Sugar", unit: "g", factor: 1, limit: true },
  { key: "sat_fat", off: "saturated-fat_100g", label: "Saturated fat", unit: "g", factor: 1, limit: true },
  { key: "salt", off: "salt_100g", label: "Salt", unit: "g", factor: 1, limit: true },
  { key: "iron", off: "iron_100g", label: "Iron", unit: "mg", factor: 1000 },
  { key: "calcium", off: "calcium_100g", label: "Calcium", unit: "mg", factor: 1000 },
  { key: "potassium", off: "potassium_100g", label: "Potassium", unit: "mg", factor: 1000 },
  { key: "magnesium", off: "magnesium_100g", label: "Magnesium", unit: "mg", factor: 1000 },
  { key: "zinc", off: "zinc_100g", label: "Zinc", unit: "mg", factor: 1000 },
  { key: "vitamin_c", off: "vitamin-c_100g", label: "Vitamin C", unit: "mg", factor: 1000 },
  { key: "vitamin_a", off: "vitamin-a_100g", label: "Vitamin A", unit: "µg", factor: 1000000 },
  { key: "vitamin_d", off: "vitamin-d_100g", label: "Vitamin D", unit: "µg", factor: 1000000 },
];

function readMicros(n) {
  const out = {};
  for (const m of MICRO_SPEC) {
    let v = n[m.off];
    if (m.key === "salt" && !has(v) && has(n["sodium_100g"])) v = num(n["sodium_100g"]) * 2.5; // salt = sodium × 2.5
    if (has(v)) out[m.key] = Math.round(num(v) * m.factor * 1000) / 1000; // per 100g, in display unit
  }
  return out;
}

function normalize(p) {
  if (!p) return null;
  const name = (p.product_name_de || p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments || {};
  return {
    code: p.code || null,
    name,
    brand: (p.brands || "").split(",")[0].trim(),
    per100: {
      kcal: num(n["energy-kcal_100g"]),
      protein: num(n["proteins_100g"]),
      carbs: num(n["carbohydrates_100g"]),
      fat: num(n["fat_100g"]),
      micros: readMicros(n),
    },
    serving_g: num(p.serving_quantity) || null,
  };
}

export async function searchFoods(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}&lc=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Food search failed");
  const data = await res.json();
  return (data.products || []).map(normalize).filter((f) => f && f.per100.kcal > 0);
}

export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 0 || !data.product) return null;
  return normalize(data.product);
}

// Scale per-100g values (macros + micros) to a gram amount.
export function scale(per100, grams) {
  const f = num(grams) / 100;
  const micros = {};
  for (const [k, v] of Object.entries(per100.micros || {})) {
    micros[k] = Math.round(v * f * 1000) / 1000;
  }
  return {
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
    micros,
  };
}

// ---- barcode scanning (native BarcodeDetector, e.g. Android Chrome) ----
export function barcodeSupported() {
  return "BarcodeDetector" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function runScanner(video, onCode) {
  const detector = new BarcodeDetector();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
  video.srcObject = stream;
  await video.play();
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
  };
  const tick = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(video);
      if (codes && codes.length) {
        stop();
        onCode(codes[0].rawValue);
        return;
      }
    } catch (e) { /* keep trying */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return stop;
}
