[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mohu2x/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mohu2x/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — Pre-token valuation board

A token launch radar built from the sealed DefiLlama snapshot (14 Nov 2026): every protocol with no token recorded, ranked by implied value.

**Method.** Each protocol's implied value starts from its TVL multiplied by a peer multiple: the median market-cap/TVL ratio of tokenized protocols in the same category (144 peers; a global median is used when a category has fewer than five peers, and the board says so). The base value is then adjusted for 7-day TVL momentum (25% weight, bounded), track record (days since listing, 0.90×–1.05× over 730 days) and chain breadth (+1% per extra chain, capped). Every row carries a confidence grade (A/B/C) with its reason, the full rationale for each factor, and a farm plan with cost and time notes. Implied value is this model's own claim from the snapshot — not a price prediction.

**Run.** `main.ts` reads `/input/snapshot.json` (override with `INPUT_PATH`) and writes `board.json`, the dashboard with its `data.js`, `screenshots/` and `dossier.json` to `/output` (override with `OUT_DIR`). Runs are deterministic: two runs produce byte-identical outputs.
