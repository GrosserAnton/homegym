// Open Food Facts integration (free, no API key) + native barcode scanning.

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const FIELDS = "code,product_name,product_name_de,brands,nutriments,serving_size,serving_quantity";

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

// Scale per-100g values to a given gram amount.
export function scale(per100, grams) {
  const f = num(grams) / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
  };
}

// ---- barcode scanning (native BarcodeDetector, e.g. Android Chrome) ----
export function barcodeSupported() {
  return "BarcodeDetector" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Streams the rear camera into `video` and calls onCode(rawValue) on first detection.
// Returns a stop() function to cancel.
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
