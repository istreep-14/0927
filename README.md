Chess.com Fetcher (Archives → NDJSON/Parquet)

Overview
This small Python CLI fetches a Chess.com user's monthly game archives via the Published Data API, normalizes key fields, and computes useful derived fields. It outputs NDJSON and optionally Parquet for efficient analytics.

Features
- Polite rate limiting and retries (handles 429, backoff). 
- Iterates monthly archives listed by Chess.com. 
- Normalizes fields from the API payload. 
- Computes derived fields (see below). 
- Writes NDJSON lines; optional Parquet export via pandas/pyarrow. 
 - Optional player profile enrichment (`--enrich-profiles`) adds country/title/status/etc. with caching.

Derived fields (examples)
- user_color: "white" or "black" as played by the requested username.
- opponent_username/opponent_rating.
- is_win/is_loss/is_draw from result.
- result_reason parsed from "result" and "termination".
- time_class (bullet/blitz/rapid/daily) and time_control_mode (e.g., "3+0", "10+0", "600+0").
- time_control_seconds: initial seconds; increment_seconds.
- eco (opening code) and opening_name if present; eco_family from ECO prefix.
- pgn_move_count estimated from PGN; end_by_checkmate/resignation/stalemate.
- rating_delta (if both pre/post or inferred from stats fields when available).
- end_ts_utc (game end time), duration_seconds (if derived from PGN clock tags when available).
 - winner, points_user, timeout/abandoned/threefold/50move/insufficient flags.
 - variant flags: is_daily, is_chess960, has_initial_fen, has_clock_increment.
 - accuracies (accuracy_white/accuracy_black) when present in the payload.

PGN tags harvested
- Event, Site, Date, Round, White, Black, Result, UTCDate, UTCTime, StartTime, EndTime, TimeControl, Termination, ECO, Opening, Variation, CurrentPosition, SetUp, FEN, Link, Annotator, Title, EventDate.

Enrichment (optional via --enrich-profiles)
- user_title, user_status, user_name_full, user_location, user_country_code, user_joined, user_last_online, user_fide, user_verified.
- opponent_title, opponent_status, opponent_name_full, opponent_location, opponent_country_code, opponent_joined, opponent_last_online, opponent_fide, opponent_verified.

Install
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Usage
```bash
python chesscom_fetcher.py --username <chesscom_user> \
  --out ndjson:/path/to/games.ndjson \
  --parquet /path/to/games.parquet \
  --sleep 0.5 --user-agent "your-tool/0.1 (email@example.com)" \
  --enrich-profiles
```

Notes
- Chess.com PubAPI is read-only and cached up to every 12 hours. Avoid heavy parallelism; respect 429 and retry with backoff.
- For large histories, prefer NDJSON then convert to Parquet after.
- The API may omit some fields; derived fields are best-effort.
 - Profile enrichment performs additional API calls per unique player; a small cache is used to limit repeats.

Maximal per-game schema (reference)
This is a union of fields that may be present or derived. Availability varies by game/time control and Chess.com payloads.

- Core (API)
  - url, uuid, pgn, rated, rules, time_class, time_control, start_time, end_time, fen (final), tcn, initial_setup, accuracies.white, accuracies.black
- Players (API)
  - white.username, white.rating, white.result; black.username, black.rating, black.result
- PGN tags (harvested)
  - Event, Site, Date, Round, White, Black, Result, UTCDate, UTCTime, StartTime, EndTime, TimeControl, Termination, ECO, Opening, Variation, CurrentPosition, SetUp, FEN, Link, Annotator, Title, EventDate
- Derived (time control and timing)
  - time_control_mode (e.g., "180+2"), time_control_seconds, increment_seconds, is_daily, start_ts_utc, end_ts_utc, duration_seconds
- Derived (openings)
  - eco, opening_name, opening_variation, eco_family
- Derived (results and flags)
  - user_color, opponent_username, user_rating, opponent_rating, rating_delta
  - user_result, winner, is_win, is_loss, is_draw, result_reason
  - is_timeout, is_abandoned, is_agreed_draw, is_threefold, is_50move, is_insufficient_material
  - points_user, points_opponent
  - end_by_checkmate, end_by_resignation, end_by_stalemate
  - pgn_move_count
- Derived (variants/board)
  - is_chess960, has_initial_fen, has_clock_increment, fen_final, initial_setup, tcn
- Accuracies (if present)
  - accuracy_white, accuracy_black
- Enrichment (optional via --enrich-profiles)
  - user_title, user_status, user_name_full, user_location, user_country_code, user_joined, user_last_online, user_fide, user_verified
  - opponent_title, opponent_status, opponent_name_full, opponent_location, opponent_country_code, opponent_joined, opponent_last_online, opponent_fide, opponent_verified

Flattened JSON example (illustrative)
```json
{
  "username": "sampleuser",
  "user_color": "white",
  "opponent_username": "rival",
  "url": "https://www.chess.com/game/live/1234567890",
  "uuid": "abcd-efgh-1234-5678",
  "rated": true,
  "rules": "chess",
  "time_class": "blitz",
  "time_control": "180+2",
  "time_control_mode": "180+2",
  "time_control_seconds": 180,
  "increment_seconds": 2,
  "is_daily": false,

  "user_rating": 1450,
  "opponent_rating": 1488,
  "rating_delta": 8,

  "user_result": "win",
  "winner": "white",
  "is_win": true,
  "is_loss": false,
  "is_draw": false,
  "result_reason": "win",
  "is_timeout": false,
  "is_abandoned": false,
  "is_agreed_draw": false,
  "is_threefold": false,
  "is_50move": false,
  "is_insufficient_material": false,
  "points_user": 1.0,
  "points_opponent": 0.0,

  "eco": "C50",
  "opening_name": "Italian Game",
  "opening_variation": "Giuoco Piano",
  "eco_family": "C",

  "start_time": 1727300000,
  "end_time": 1727300700,
  "start_ts_utc": "2024-09-26T15:33:20+00:00",
  "end_ts_utc": "2024-09-26T15:45:00+00:00",
  "duration_seconds": 700,

  "pgn_move_count": 36,
  "end_by_checkmate": true,
  "end_by_resignation": false,
  "end_by_stalemate": false,

  "is_chess960": false,
  "has_initial_fen": false,
  "has_clock_increment": true,
  "fen_final": null,
  "initial_setup": null,
  "tcn": null,

  "accuracy_white": 86.3,
  "accuracy_black": 72.1,

  "pgn_tags": {
    "Event": "Live Chess",
    "Site": "Chess.com",
    "Date": "2024.09.26",
    "Round": "-",
    "White": "sampleuser",
    "Black": "rival",
    "Result": "1-0",
    "UTCDate": "2024.09.26",
    "UTCTime": "15:33:20",
    "TimeControl": "180+2",
    "Termination": "sampleuser won by checkmate",
    "ECO": "C50",
    "Opening": "Italian Game",
    "Variation": "Giuoco Piano"
  },

  "user_title": null,
  "user_status": "basic",
  "user_name_full": "Sample User",
  "user_location": null,
  "user_country_code": "US",
  "user_joined": 1500000000,
  "user_last_online": 1727300800,
  "user_fide": null,
  "user_verified": false,

  "opponent_title": null,
  "opponent_status": "basic",
  "opponent_name_full": null,
  "opponent_location": null,
  "opponent_country_code": "CA",
  "opponent_joined": 1490000000,
  "opponent_last_online": 1727300900,
  "opponent_fide": null,
  "opponent_verified": false
}
```

Apps Script (Google Sheets/Drive) notes
- Use `UrlFetchApp.fetch` with polite `Utilities.sleep` delays (e.g., 500–800 ms).
- Iterate the `archives` list endpoint, then fetch each monthly `games` URL.
- Derive fields as shown above; PGN tag extraction uses regex against the PGN header.
- For large accounts, paginate work across triggers (execution time limits ~6 minutes per run).
- Output either to a Sheet (flatten object → columns) or to Drive as NDJSON.

