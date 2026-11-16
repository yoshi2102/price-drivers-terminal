# Sector KPI framework: file format

One JSON file per sector in config/sectors/<code>.json. Every field is required unless marked optional.

{
  "code": "cement",                         // kebab-case
  "name": "Cement",
  "group": "Materials",                     // Autos | Materials | Industrials | Consumer | Financials | Healthcare | Tech & Internet | Energy & Utilities | Real assets | Services
  "subsectors": ["Grey cement"],            // optional
  "mofsl_2qfy27": {
    "pages": [16],
    "headline": "MOFSL's sector headline for 2QFY27, as printed",
    "read": "2-3 sentences: what drove the quarter and the guidance, with numbers from the page",
    "surprises": ["TICKER"], "misses": ["TICKER"]
  },
  "buoyant_skill": "anthropic-skills:cement-analysis",  // or null if none
  "unit_economics": "One line: how profit is built, e.g. EBITDA = volume × (realisation/t − cost/t)",
  "price_drivers": [                        // 3-5, most important first
    { "driver": "EBITDA per tonne", "why": "one sentence, concrete", "sign": "+" }
  ],
  "kpis": [                                 // 6-10; core ones first
    {
      "code": "ebitda_per_t",
      "name": "EBITDA per tonne",
      "priority": "core",                   // core | secondary
      "definition": "What it measures, plainly",
      "formula": "EBITDA ÷ sales volume (Rs/t)",   // or "reported" if disclosed directly
      "unit": "Rs/t",
      "frequency": "quarterly",
      "why_it_moves_price": "one or two sentences with the mechanism",
      "history_source": "Where 5+ years of history comes from in Airavat: get_financials field, get_investor_presentation metric filter, broker results tables (name the broker if one is reliable), transcripts",
      "estimate_source": "Where forward estimates come from: broker models (named), company guidance, Bloomberg consensus fields, house model",
      "traps": "What distorts it (one-offs, basis changes, accounting)",
      "examples": ["ULTRACEMCO", "SHREECEM"]
    }
  ],
  "macro_inputs": [ { "series": "Pet coke US$/t", "source": "Airavat get_commodity_prices", "why": "fuel cost" } ],
  "valuation_anchor": "EV/EBITDA and EV/tonne of capacity",
  "watch_next_quarter": "One or two sentences: what to monitor in 3QFY27, from MOFSL's guidance section"
}

Writing rules (apply to every text field): direct and specific; no filler; never use the words delve, tapestry, testament, beacon, foster, realm, landscape, unlock, elevate, empower, pivot, journey, paradigm, supercharge, game-changer, revolutionary, seamlessly; no "it's not just X, it's Y". Every claim specific to the sector, with a number or mechanism where possible.
