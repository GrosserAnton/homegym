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
    piece_g: null,
  };
}

// A small set of curated everyday foods (values per 100 g) so staples like eggs
// always carry correct macros — and a sensible piece weight for counting by piece.
// per = [kcal, protein, carbs, fat]. piece_g = grams of one typical piece.
export const COMMON_FOODS = [
  { name: "Ei (S)",              kw: ["ei", "eier", "egg", "hühnerei", "größe", "klein"],  per: [143, 12.6, 1.1, 9.9], piece_g: 55 },
  { name: "Ei (M)",              kw: ["ei", "eier", "egg", "hühnerei", "größe"],           per: [143, 12.6, 1.1, 9.9], piece_g: 70 },
  { name: "Ei (L)",              kw: ["ei", "eier", "egg", "hühnerei", "größe", "groß"],   per: [143, 12.6, 1.1, 9.9], piece_g: 80 },
  { name: "Apfel",               kw: ["apfel", "äpfel", "apple"],                          per: [52, 0.3, 14, 0.2],    piece_g: 150 },
  { name: "Banane",              kw: ["banane", "bananen", "banana"],                      per: [89, 1.1, 23, 0.3],    piece_g: 120 },
  { name: "Kartoffel (gekocht)", kw: ["kartoffel", "kartoffeln", "potato"],                per: [87, 2, 20, 0.1],      piece_g: 120 },
  { name: "Vollkornbrot",        kw: ["vollkornbrot", "brot", "bread"],                    per: [237, 8, 41, 3.3],     piece_g: 45 },
  { name: "Toastbrot",           kw: ["toast", "toastbrot"],                               per: [270, 9, 49, 3.5],     piece_g: 25 },
  { name: "Reiswaffel",          kw: ["reiswaffel", "reiswaffeln"],                        per: [387, 8, 82, 3],       piece_g: 9 },
  { name: "Gouda",               kw: ["gouda", "käse", "cheese"],                          per: [356, 25, 2.2, 27],    piece_g: 25 },
  { name: "Haferflocken",        kw: ["haferflocken", "hafer", "oats", "oatmeal"],         per: [370, 13, 59, 7] },
  { name: "Reis (gekocht)",      kw: ["reis", "rice"],                                     per: [130, 2.7, 28, 0.3] },
  { name: "Nudeln (gekocht)",    kw: ["nudeln", "pasta", "spaghetti"],                     per: [158, 5.8, 31, 0.9] },
  { name: "Milch 3,5%",          kw: ["milch", "milk", "vollmilch"],                       per: [64, 3.4, 4.8, 3.6] },
  { name: "Magerquark",          kw: ["magerquark", "quark"],                              per: [67, 12, 4, 0.3] },
  { name: "Naturjoghurt 3,5%",   kw: ["joghurt", "naturjoghurt", "yogurt", "jogurt"],      per: [61, 3.5, 4.7, 3.3] },
  { name: "Hähnchenbrust",       kw: ["hähnchen", "hühnchen", "chicken", "hähnchenbrust"], per: [165, 31, 0, 3.6] },
  { name: "Thunfisch (Dose)",    kw: ["thunfisch", "tuna"],                                per: [116, 26, 0, 1] },
  { name: "Mandeln",             kw: ["mandeln", "mandel", "almonds"],                     per: [579, 21, 22, 49] },
  { name: "Olivenöl",            kw: ["olivenöl", "olive oil"],                            per: [884, 0, 0, 100] },
  { name: "Butter",              kw: ["butter"],                                           per: [717, 0.7, 0.7, 81] },
];

function commonToFood(c) {
  return {
    code: null, name: c.name, brand: "Basics",
    per100: { kcal: c.per[0], protein: c.per[1], carbs: c.per[2], fat: c.per[3], micros: {} },
    serving_g: c.piece_g || null,
    piece_g: c.piece_g || null,
    common: true,
  };
}
// Forgiving search text: lowercase, umlauts→base letters, drop punctuation,
// collapse spaces. So "Größe M", "groesse m" and "  grosse   m " all match.
function normStr(s) {
  return (s || "").toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u") // "groesse" == "größe"
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function searchCommon(query) {
  const tokens = normStr(query).split(" ").filter(Boolean);
  if (!tokens.length || normStr(query).length < 2) return [];
  return COMMON_FOODS
    .filter((c) => {
      const words = normStr(c.name + " " + c.kw.join(" ")).split(" ").filter(Boolean);
      // every typed word must match a whole word or the start of one (any order)
      return tokens.every((t) => words.some((w) => w === t || w.startsWith(t)));
    })
    .map(commonToFood);
}

export async function searchFoods(query) {
  const q = (query || "").trim().replace(/\s+/g, " "); // tidy up stray spaces
  const common = searchCommon(q); // curated staples first
  if (q.length < 2) return common;
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}&lc=de`;
  try {
    const res = await fetch(url);
    if (!res.ok) return common;
    const data = await res.json();
    // Keep only products that actually list macros — many OFF entries have just
    // energy (that's the "eggs with 0 g protein" bug). If there are kcal but no
    // macros at all, the entry is incomplete, so drop it.
    const off = (data.products || [])
      .map(normalize)
      .filter((f) => f && f.per100.kcal > 0 && f.per100.protein + f.per100.carbs + f.per100.fat > 0);
    return [...common, ...off];
  } catch (e) {
    return common; // Open Food Facts unavailable → still offer the basics
  }
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
