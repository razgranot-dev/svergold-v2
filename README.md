# Svergold — Import & Marketing LTD (V2)

Premium marketing site for Svergold, an international import & trade company.
Static site: hand-written HTML / CSS / vanilla JS. No build step.

## Features
- Trilingual **HE / EN / RU** with Hebrew **RTL**
- **Light** (white / ivory / champagne / gold) and **dark** (black / graphite / gold) themes
- Cinematic **Hero** (ship video + animated gold routes) and an **image-sequence scroll Journey**
- Sectors, Services, Why-us, Locations (animated coast map), and a contact form with validation
- Floating WhatsApp / call buttons, fully responsive

## Run locally
```bash
python serve.py
# → http://127.0.0.1:8848
```
`serve.py` is a small Range-capable static server. Any static host (Vercel, Netlify, nginx) also works.

## Deploy
Static deployment — no build command, output is the repository root. A `vercel.json` is included for Vercel.

## Notes
- `assets/` holds images/video; `assets/journey-seq/` holds the 60 Journey frames; `assets/generated/` holds the AI-generated sector/service plates.
- `scripts/gen-sectors.mjs` is a one-off image-generation helper (reads `GEMINI_API_KEY` from a local `.env`, which is gitignored and never committed).
