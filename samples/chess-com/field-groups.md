## Field groups and referencing model

This document organizes all fields into conceptual groups and clarifies how to reference player fields either by color (white/black) or by identity (my/opp).

### Referencing model for player fields
- By color (raw from JSON): `white.*`, `black.*`
- By identity (derived): `drv_my_*`, `drv_opp_*`

Identity resolution: once your username is known, the side that matches becomes "my" and the other side becomes "opp". Avoid hard coding color; use identity fields for user-specific analytics.

Common player properties used across both models:

| Property | Color-based example | Identity-based example | Description |
|---|---|---|---|
| username | `white.username` | `drv_my_username` | Player username |
| uuid | `white.uuid` | `drv_my_uuid` | Member unique ID |
| rating | `white.rating` | `drv_my_rating` | Rating at game time |
| result | `white.result` | `drv_my_result` | Player result code |
| outcome | n/a | `drv_my_outcome` | win/lose/draw (normalized) |
| score | n/a | `drv_my_score` | 1 (win), 0.5 (draw), 0 (loss) |
| @id | `white.@id` | `drv_my_at_id` | Published Data API player URL |
| color | n/a | `drv_my_color` | white or black |
| expected_score | n/a | `drv_my_expected_score` | Expected score [0–1, 4 decimals] |

The same identity fields exist for opponent: `drv_opp_username`, `drv_opp_uuid`, `drv_opp_rating`, `drv_opp_result`, `drv_opp_outcome`, `drv_opp_score`, `drv_opp_at_id`, `drv_opp_color`, `drv_opp_expected_score`.

---

## Core game metadata

| Field | Description |
|---|---|
| uuid | Unique game identifier |
| url | Public game viewer URL |
| pgn | Full PGN (headers + movetext) |
| rules | Variant/ruleset (e.g., chess, chess960) |
| time_class | Time category (bullet, blitz, rapid, daily) |
| drv_type | Derived type: daily if `time_class` is daily, else live |
| drv_format | Unified format (chess → time_class; chess960 → daily960/live960; other variants → variant name) |
| eco | Opening reference URL (if present) |
| tournament | API URL if part of a tournament |
| match | API URL if part of a team match |
| tcn | Encoded move sequence (optional) |

---

## Players (by color)

| Field | Description |
|---|---|
| white.username | White username |
| white.uuid | White member unique ID |
| white.rating | White rating at game time |
| white.result | White result code |
| white.@id | White Published Data API player URL |
| black.username | Black username |
| black.uuid | Black member unique ID |
| black.rating | Black rating at game time |
| black.result | Black result code |
| black.@id | Black Published Data API player URL |

## Players (by identity)

| Field | Description |
|---|---|
| drv_my_username | My username (resolved identity) |
| drv_my_uuid | My member unique ID |
| drv_my_rating | My rating at game time |
| drv_my_result | My result code |
| drv_my_outcome | My outcome win/lose/draw |
| drv_my_score | My score 1/0.5/0 |
| drv_my_at_id | My Published Data API player URL |
| drv_my_color | My color (white/black) |
| drv_my_expected_score | My expected score [0–1, 4 decimals] |
| drv_opp_username | Opponent username |
| drv_opp_uuid | Opponent member unique ID |
| drv_opp_rating | Opponent rating at game time |
| drv_opp_result | Opponent result code |
| drv_opp_outcome | Opponent outcome win/lose/draw |
| drv_opp_score | Opponent score 1/0.5/0 |
| drv_opp_at_id | Opponent Published Data API player URL |
| drv_opp_color | Opponent color |
| drv_opp_expected_score | Opponent expected score [0–1, 4 decimals] |

---

## Results and end

| Field | Description |
|---|---|
| rated | Whether the game affected rating |
| accuracies.white | White accuracy % (if available) |
| accuracies.black | Black accuracy % (if available) |
| drv_white_outcome | White outcome win/lose/draw |
| drv_white_score | White score 1/0.5/0 |
| drv_black_outcome | Black outcome win/lose/draw |
| drv_black_score | Black score 1/0.5/0 |
| drv_end_reason | Reason the game ended (loser's result or shared draw reason) |

---

## Time control and format-related

| Field | Description |
|---|---|
| time_control | PGN-compliant time control (e.g., 600, 180+2, 1/86400) |
| drv_base_time | Live base seconds parsed from `time_control` |
| drv_increment_time | Live increment seconds parsed from `time_control` |
| drv_correspondence_time | Daily response seconds parsed from `time_control` |
| drv_format | Unified format (see Core game metadata) |

---

## Dates and times

| Field | Description |
|---|---|
| start_time | Epoch seconds (Daily only) |
| end_time | Epoch seconds when game ended |
| drv_start | Local start datetime (from `start_time` or PGN UTC headers) |
| drv_start_date | Local start date |
| drv_start_time | Local start time |
| drv_end | Local end datetime |
| drv_end_date | Local end date |
| drv_end_time | Local end time |
| drv_end_iso | ISO 8601 end timestamp |
| drv_duration | Duration in seconds (`end_time - start_time` when available) |

---

## PGN headers (selected)

| Field | Description |
|---|---|
| pgn_event | Event name |
| pgn_site | Site identifier |
| pgn_date | Local date |
| pgn_round | Round id |
| pgn_white | White display name |
| pgn_black | Black display name |
| pgn_result | PGN result code (e.g., 1-0) |
| pgn_eco_code | ECO code |
| pgn_eco_url | Opening reference URL |
| pgn_time_control | PGN TimeControl header |
| pgn_termination | Human-readable termination |
| pgn_start_time | Local start time |
| pgn_end_date | Local end date |
| pgn_end_time | Local end time |
| pgn_link | Viewer URL |
| pgn_opening | Opening name |
| pgn_variation | Opening variation |
| pgn_current_position | Snapshot FEN header |
| pgn_timezone | Timezone label |
| pgn_utc_date | UTC date |
| pgn_utc_time | UTC time |
| pgn_white_elo | WhiteElo |
| pgn_black_elo | BlackElo |
| pgn_setup | SetUp (0/1) |
| pgn_fen | Initial position FEN |

---

## Moves and timing arrays

Array outputs are emitted as single-quoted JSON strings to prevent spreadsheet auto-formatting (e.g., interpreting numbers as scientific notation).

| Field | Description |
|---|---|
| pgn_moves | Movetext string (headers + a blank line + moves) |
| drv_san_moves | SAN moves array for the full game |
| drv_clock_times_seconds | Post-move clock times, seconds, aligned to SAN moves (when available) |
| drv_time_spent_seconds | Per-move time spent, seconds, aligned to SAN moves (when available) |

---

## Board positions

| Field | Description |
|---|---|
| initial_setup | Starting FEN (non-standard for Chess960) |
| fen | Final FEN |
| pgn_current_position | Snapshot FEN in PGN header |

