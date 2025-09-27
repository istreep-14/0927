## Chess.com data spec — canonical (single source of truth)

This document defines names, mappings, and field groups for all outputs. Generators and sheets MUST follow this spec. For the machine-readable schema (names, types, origin, scope), use `game-fields.csv`.

### Naming rules
- Keep flat, human-friendly names.
- Do not use drv_ or pgn_ prefixes. Use `hdr_` only where PGN collides with JSON (e.g., `hdr_time_control`, `hdr_white_elo`).
- Color-based player fields: `white.*`, `black.*` use Published Data JSON.
- Identity-based fields: `my_*`, `opp_*` after resolving identity from configured username.
- Time control parts: `tc_base`, `tc_inc`, `tc_corr`.
- Datetimes: `start_dt`, `end_dt`; dates `start_date`, `end_date`; clocks `start_clock`, `end_clock`; ISO `end_iso`.
- Arrays: `san_moves`, `clock_times`, `time_spent` (single-quoted JSON strings for Sheets compatibility).

### Player identity model
- Resolve identity at runtime: if username matches JSON `white.username` → `my_color = white` (else black). The other side is `opp`.
- Identity outputs mirror color-based properties (username, uuid, rating, result, outcome, score, expected_score, id/link).

### Result mapping (outcome/score)
- outcome (per-player):
  - win → `win`
  - draw family → `draw`: {draw, stalemate, agreed, repetition, insufficient, 50move, timevsinsufficient}
  - loss family → `lose`: {lose, checkmated, resigned, timeout, abandoned, kingofthehill, threecheck, bughousepartnerlose}
- score (per-player): win=1, draw=0.5, lose=0.
- end_reason (game-level): if a side is `win`, reason is the other side’s result; for draws use either draw reason (they are identical).

### Time control parsing
- Inputs: `BASE`, `BASE+INC`, `1/SECONDS`.
- Derived:
  - `tc_base = BASE` (seconds); `tc_inc = INC` (defaults 0); `tc_corr = SECONDS` for daily.

### Time class, type, and format
- `time_class`: bullet, blitz, rapid, daily.
- `type`: derived: daily if `time_class` is daily; else live.
- `format` mapping:
  - rules=chess → `format = time_class`
  - rules=chess960 → daily → `daily960`, else `live960`
  - rules in {bughouse, crazyhouse, kingofthehill, threecheck, oddschess} → that rule name
- Note: `oddschess` games are typically unrated and won’t affect ratings.

### Expected score (Elo logistic)
- Four decimals. For player A vs B (ratings R_A and R_B): `E_A = 1 / (1 + 10^((R_B - R_A)/400))`.
- Provide color-based (`white_expected_score`, `black_expected_score`) and identity-based (`my_expected_score`, `opp_expected_score`).

### Arrays and movetext
- `san_moves`: full-game SAN moves array (single-quoted JSON string).
- `clock_times`: post-move times aligned to SAN (if available), single-quoted JSON string.
- `time_spent`: per-move spend aligned to SAN (if available), single-quoted JSON string.
- `movetext`: full PGN movetext (headers separate).

### Field categories
Use `game-fields.csv` for the canonical list (names/types/origin/scope). High-level groupings:
- Core game: `game_uuid`, `game_url`, `rules`, `time_class`, `type`, `format`, `eco_url`, `tournament_link`, `match_link`, `tcn`.
- Players (color-based): `white.username`, `white.uuid`, `white.rating`, `white.result`, `white_outcome`, `white_score`, `white_expected_score`; mirror for `black.*`.
- Players (identity): `my_*`, `opp_*` variants for username/uuid/rating/result/outcome/score/expected_score, plus `my_color`, `opp_color`, `my_id`, `opp_id`.
- Results and end: `rated`, `accuracies.white`, `accuracies.black`, `end_reason`.
- Time control: `time_control`, `tc_base`, `tc_inc`, `tc_corr`.
- Dates/times: `start_time`, `end_time`, `start_dt`, `start_date`, `start_clock`, `end_dt`, `end_date`, `end_clock`, `end_iso`, `duration`.
- PGN headers (selected): `event`, `site`, `date`, `round`, `hdr_white`, `hdr_black`, `result_code`, `eco_code`, `hdr_time_control`, `termination_text`, `hdr_start_time`, `hdr_end_date`, `hdr_end_time`, `viewer_link`, `opening`, `variation`, `current_fen`, `timezone`, `utc_date`, `utc_time`, `hdr_white_elo`, `hdr_black_elo`, `hdr_setup`, `hdr_fen`.
- Moves/positions: `movetext`, `san_moves`, `clock_times`, `time_spent`, `start_fen`, `final_fen`, `current_fen`.

### URL numeric id for meta (optional)
- `url_numeric_id`: numeric id parsed from the end of the game `url` (e.g., 142733007366). Use only as supplemental metadata; `game_uuid` remains the primary key.

### Machine-readable schema
- `game-fields.csv` is the canonical schema. Generators read this file to decide column order and to stay aligned with this spec.

