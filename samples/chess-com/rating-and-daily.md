## Ratings and daily rollups — problem, options, and design

### Overview
You want trustworthy per-game rating deltas and per-day ratings by format while:
- Using actual per-game rating changes when available (site callback data)
- Falling back to well-defined estimates when not available
- Handling retroactive corrections (anti-cheat adjustments) that alter ratings between games
- Producing a per-day time series per format, forward-filled on no-game days

Constraints:
- Historic data may miss some callbacks; older games often lack ratingChange values
- Chess.com applies occasional retroactive corrections that change ratings outside games
- You have 5k+ games; performance and idempotency matter

### Data sources
- Published Data API (monthly archives): ratings at game time; results, timestamps, formats
- Site callback (unofficial): ratingChangeWhite/Black for some games; player-level metadata
- Retroactive corrections (manual list): timestamp, format, rating_before, rating_after

### Core problems
1) Missing per-game rating change for older games (ratingChange==0 or absent)
2) Retroactive corrections cause last-based estimates to drift
3) First game in a format has no “previous rating” from game history
4) Opponent’s per-game delta is unknown without their history

### Solution options
1) Actual-first, estimate-second (recommended)
- Use callback ratingChange when nonzero; else estimate.
- Estimation methods:
  - Last-based: my_rating_before := last known rating for format; my_delta := my_rating − my_rating_before
  - Opponent delta (fallback): opp_delta := −my_delta (assumption)
- Retroactive corrections:
  - Maintain a corrections table; at compute time, splice corrections into the timeline; recompute last-based segments downstream
  - Keep a stable “rating timeline” per format; updates can reflow estimates deterministically

2) Pre-game inference check (optional)
- Use a simplified rating response model (Elo-like) to approximate what pregame ratings would have needed to be to get observed postgame ratings and outcome. Mark outliers where inferred pregame deviates from last-based by a threshold.
- Only flag; do not overwrite unless operator approves or callback later confirms

3) First-game bootstrap
- Use Published Data `stats` snapshot (if archived) or a seed table of starting ratings per format
- If missing, leave my_rating_before blank and only compute downstream deltas when possible

### Canonical algorithms
Per format, ordered by end_dt asc:
1) Build a rating timeline with nodes:
   - Game nodes: (game_uuid, end_dt, my_rating, outcome, [actual_delta?])
   - Correction nodes: (timestamp, rating_before, rating_after)
2) Sweep timeline:
   - Maintain current_rating := seed or null
   - For node in time order:
     - If correction: set current_rating := rating_after
     - If game:
       - If actual_delta present and ≠ 0: my_rating_before := my_rating − actual_delta
       - Else if current_rating not null: my_rating_before := current_rating; delta := my_rating − current_rating
       - Else: my_rating_before := '' (unknown), delta := ''
       - Update current_rating := my_rating
       - Store my_rating_before, my_rating_change := delta (or actual)
       - Opponent: opp_rating_before := opp_rating − (actual_opp_delta if present else −delta); opp_rating_change likewise

Per-day rating series (local time):
1) For each format, collect all game nodes and correction nodes
2) Build day buckets (local dates)
3) For each day in range:
   - If any game ends that day, my_rating_eod := my_rating of the last game that day
   - Else my_rating_eod := previous day’s my_rating_eod (forward fill)
4) Write Ratings_By_Format (date_local, format, my_rating_eod, source)

### Schema additions (Meta)
- my_rating_before, my_rating_change, opp_rating_before, opp_rating_change, rating_change_source
- corrections table (separate sheet or JSON): (timestamp_local, format, rating_before, rating_after)

### Idempotency & updates
- On new callback data for a game: overwrite per-game deltas and rerun downstream reflow for that format (optional batch job)
- On new correction records: reflow affected windows

### Performance model
- Keep a Ratings_State per format for fast last-based estimation online
- Do full reflows offline (batch) across archived windows when corrections arrive

### Risks & mitigations
- Callback instability: cache responses; throttle; retry with backoff
- Corrections incomplete: design to accept partial corrections and reflow later
- Inference pitfalls: keep inference as a check/flag, not as an authoritative writer

