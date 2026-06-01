/* Svergold sector tiles — Gemini 2.5 Flash Image (Nano Banana).
 * Reads GEMINI_API_KEY from the Svergold V2 .env, writes optimized JPEGs into
 * SVERGOLD/V2/assets/generated/. Run from the Wines folder so @google/genai +
 * sharp resolve. (A clean copy lives at V2/scripts/gen-sectors.mjs for the record.)
 */
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const V2 = "C:/Users/razg/Desktop/SVERGOLD/V2";

function loadDotenv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotenv(path.join(V2, ".env"));
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!KEY) { console.error("ERROR: GEMINI_API_KEY not found in V2/.env"); process.exit(1); }
console.log(`key present (length=${KEY.length})`);

const OUT = path.join(V2, "assets/generated");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const ai = new GoogleGenAI({ apiKey: KEY });
const MODEL = "gemini-2.5-flash-image";

const STYLE = `
Style (apply to this image, identical across the whole set so the grid reads as ONE campaign):
- Cinematic, high-end EDITORIAL COMMERCIAL photography for a luxury international import & trade house. Photoreal, magazine quality. NOT generic stock, NOT clip-art, NOT a cartoon, NOT a flat 3D render.
- Warm premium palette: ivory / cream / champagne backgrounds, refined GOLD and warm bronze accents, deep graphite shadows. Calm, expensive, restrained.
- Soft natural cinematic light, gentle shallow depth of field, elegant negative space, a quiet low-detail area (for text overlay). Wide landscape ~4:3 composition.
- Absolutely NO text, NO words, NO numbers, NO logos, NO watermark, NO borders, NO captions, NO UI, NO signage.
- High resolution, crisp, photoreal, cohesive warm grade (no teal-orange, no neon, no purple cast).
`.trim();

const PROMPTS = {
  "bentonite": `Industrial bentonite clay and drilling additives for the energy sector — a refined close still-life of fine pale grey-cream mineral powder and raw clay granules on a champagne surface, with the silhouette of an oil & gas drilling rig derrick softly out of focus in warm golden light behind. Premium materials study. ${STYLE}`,
  "polymers": `Industrial polymers and raw minerals — an elegant arrangement of translucent polymer resin pellets and refined mineral aggregates / ore samples on an ivory surface, catching warm gold light, premium manufacturing-grade materials, refined studio still-life. ${STYLE}`,
  "luxury-cars": `Luxury automobile import — a sleek high-end car silhouette partially revealed under a soft champagne dust cover in a minimalist ivory showroom or port terminal, a thin gold rim-light tracing the bodywork, cinematic, exclusive, premium. ${STYLE}`,
  "food-beverage": `Premium imported food & beverage trade — an elegant still-life of fine imported goods: bottles of olive oil and wine, artisanal preserves and gourmet produce in refined crates on an ivory surface, warm champagne light, sophisticated and appetising, high-end. ${STYLE}`,
  "sourcing": `Global sourcing & freight logistics — a cinematic commercial seaport at golden hour: neatly stacked shipping containers and an elegant gantry crane bathed in warm champagne and gold light, calm and refined, a luxury take on international shipping. ${STYLE}`,
  "warehousing": `Warehousing & distribution — a refined modern warehouse interior with neat tall racking of palletised goods and a single forklift, warm golden light streaming through, champagne tones, clean, premium, orderly. ${STYLE}`,
};

async function gen(slug, prompt) {
  console.log(`> ${slug} …`);
  const r = await ai.models.generateContent({ model: MODEL, contents: [{ role: "user", parts: [{ text: prompt }] }] });
  for (const part of r.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData) {
      const raw = Buffer.from(part.inlineData.data, "base64");
      const out = path.join(OUT, `sector-${slug}.jpg`);
      await sharp(raw).resize(960, 720, { fit: "cover", position: "centre" }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
      const { size } = await sharp(out).metadata().then(() => ({ size: readFileSync(out).length }));
      console.log(`  saved sector-${slug}.jpg (${(size/1024).toFixed(0)} KB)`);
      return true;
    }
  }
  console.error(`  no image returned for ${slug}`);
  return false;
}

const only = process.argv.slice(2);
let ok = 0;
for (const [slug, prompt] of Object.entries(PROMPTS)) {
  if (only.length && !only.includes(slug)) continue;
  try { if (await gen(slug, prompt)) ok++; } catch (e) { console.error(`  ${slug} FAILED:`, e?.message || e); }
}
console.log(`\nDONE — ${ok} image(s)`);
