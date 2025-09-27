## Google Sheets schema for Chess.com game archives

### Primary key
- **uuid** (string, required): stable per game; use as the primary key across sheets/files.

### Main sheet: `Games`
- Purpose: user-facing view for analysis and reporting.
- Write rows once (no row-by-row formulas); compute derived fields in script.

| Column | Source | Type | Notes |
|---|---|---|---|
| uuid | JSON | string | Primary key. |
| url | JSON | string | Viewer URL. |
| end_time | JSON | datetime | Convert from epoch seconds. |
| drv_end | Derived | datetime | Local display datetime from `end_time`. |
| drv_end_date | Derived | date | Local date from `end_time`. |
| drv_end_time | Derived | time | Local time from `end_time`. |
| time_class | JSON | string | bullet, blitz, rapid, daily. |
| rules | JSON | string | chess, chess960, etc. |
| drv_type | Derived | string | daily or live from time_class. |
| drv_format | Derived | string | Unified format (bullet, blitz, rapid, daily, live960, daily960, bughouse, crazyhouse, kingofthehill, threecheck, oddschess). |
| white_username | JSON | string | `game.white.username`. |
| black_username | JSON | string | `game.black.username`. |
| white_rating | JSON | number | `game.white.rating`. |
| black_rating | JSON | number | `game.black.rating`. |
| white_result | JSON | string | `game.white.result`. |
| black_result | JSON | string | `game.black.result`. |
| eco | JSON/PGN | string | Prefer PGN header `ECO`; fallback JSON `eco` URL parse if needed. |
| opening | PGN | string | From PGN header `Opening` if present. |
| termination | PGN | string | From PGN header `Termination`. |
| is_rated | JSON | boolean | `game.rated`. |
| accuracy_white | JSON | number? | `accuracies.white` if available. |
| accuracy_black | JSON | number? | `accuracies.black` if available. |
| drv_start | Derived | datetime? | Use JSON `start_time` if present; else PGN `UTCDate`+`UTCTime` localized. |
| drv_start_date | Derived | date? | Local date from `drv_start`. |
| drv_start_time | Derived | time? | Local time from `drv_start`. |
| drv_duration | Derived | number? | `end_time - start_time` (seconds) when both available. |
| drv_base_time | Derived | number? | Live base seconds parsed from time_control. |
| drv_increment_time | Derived | number? | Live increment seconds parsed from time_control. |
| drv_correspondence_time | Derived | number? | Daily response seconds parsed from time_control. |
| drv_my_username | Derived | string | My username (configured). |
| drv_my_color | Derived | string | 'white' or 'black'. |
| drv_my_rating | Derived | number? | My rating at time of game. |
| drv_my_result | Derived | string | My result code. |
| drv_my_outcome | Derived | string | My outcome win/lose/draw. |
| drv_my_score | Derived | number | My score (1/0.5/0). |
| drv_opp_username | Derived | string | Opponent username. |
| drv_opp_color | Derived | string | Opponent color. |
| drv_opp_rating | Derived | number? | Opponent rating at time of game. |
| drv_opp_result | Derived | string | Opponent result code. |
| drv_opp_outcome | Derived | string | Opponent outcome win/lose/draw. |
| drv_opp_score | Derived | number | Opponent score (1/0.5/0). |

Optional derived columns (compute in script):
- **result_category**: win/lose/draw derived from `white_result`/`black_result` and perspective.
- **is_variant**: rules != chess.
- **event**: PGN `Event`.

### Meta sheet: `Games_Meta`
- Purpose: store raw or rarely viewed fields without cluttering `Games`.
- Key: `uuid` (one row per game).

| Column | Source | Type | Notes |
|---|---|---|---|
| uuid | JSON | string | Primary key. |
| time_control | JSON | string | PGN-compliant control (e.g., 600, 180+2). |
| tcn | JSON | string? | Encoded moves; optional. |
| initial_setup | JSON | string? | FEN when non-standard (e.g., Chess960). |
| fen_final | JSON | string | Ending FEN. |
| tournament | JSON | url? | API URL if part of an event. |
| match | JSON | url? | API URL if part of a team match. |
| pgn | JSON | string | Full PGN; store here to keep `Games` lean. |

Notes
- Some meta fields relate to main fields (e.g., `time_control` complements `time_class`). Keeping them in `Games_Meta` is fine; the relationship is via `uuid` only. No separate foreign keys are necessary.
- If you need frequent lookups (e.g., time_control), either expose a hidden column in `Games` or cache a small map in script when building reports.
- For large datasets, consider also writing per-month JSON to Drive for archival and reprocessing.

### Write pattern (Apps Script)
1) Fetch monthly archive (JSON only).
2) For each game: compute `Games` row + `Games_Meta` row.
3) Batch write `Games` rows; batch write `Games_Meta` rows.
4) Set number formats and freeze header rows once.

