Chess.com Fetcher (Archives → NDJSON/Parquet)

Overview
This small Python CLI fetches a Chess.com user's monthly game archives via the Published Data API, normalizes key fields, and computes useful derived fields. It outputs NDJSON and optionally Parquet for efficient analytics.

Features
- Polite rate limiting and retries (handles 429, backoff). 
- Iterates monthly archives listed by Chess.com. 
- Normalizes fields from the API payload. 
- Computes derived fields (see below). 
- Writes NDJSON lines; optional Parquet export via pandas/pyarrow. 

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
  --max-workers 2 --sleep 0.5 --user-agent "your-tool/0.1 (email@example.com)" 
```

Notes
- Chess.com PubAPI is read-only and cached up to every 12 hours. Avoid heavy parallelism; respect 429 and retry with backoff.
- For large histories, prefer NDJSON then convert to Parquet after.
- The API may omit some fields; derived fields are best-effort.

