## Fetching archives, structure, and idempotency

### Goals
- Backfill historical monthly archives once
- Keep an Active spreadsheet current via ETag; append-only, idempotent
- Archive older months into a separate spreadsheet
- Support multi-phase enrichment (arrays, callbacks) without re-fetching

### Data flow
1) Backfill: For each YYYY/MM
   - Fetch Published Data JSON (and use embedded PGN per game)
   - Derive Main (minimal) and Meta (full) rows
   - Append to Archive_* or Active_* based on policy
2) Incremental update (current month)
   - GET with If-None-Match ETag; if 304, stop
   - Filter out existing UUIDs via a hidden UUID index
   - Append only new games (sorted by end_dt asc)
3) Enrichment passes (independent)
   - Arrays: compute SAN, clocks, time_spent when needed
   - Callback rating deltas: fetch for games missing actual; update Meta in place

### Sheets structure (Apps Script)
- Active spreadsheet
  - Active_Games (minimal): game_uuid [hidden], url, end_dt, format, my_color, my_rating, opp_username, opp_rating, my_outcome, end_reason
  - Active_Meta (full): all secondary fields including movetext, time_control+tc_base/tc_inc/tc_corr, eco_code, eco_url, start_dt/start_date/start_time, end_date/end_time, duration, rated, time_class, rules, type, url_numeric_id, utc_date/utc_time, links, color-based inputs, identity fields, accuracies, arrays
  - Active_UUID_Index (hidden): game_uuid list for O(1) dedupe
  - Ratings_State (hidden): format → last_my_rating
- Archive spreadsheet
  - Archive_Games, Archive_Meta (same schemas)

### ETag and last-seen pointers
- Store per-month ETag in PropertiesService (etag_YYYY_MM)
- Also store lastSeenUuid_YYYY_MM and lastSeenEndTime_YYYY_MM (for sanity checks)

### Idempotent append algorithm (updateCurrentMonth)
1) HEAD/GET with If-None-Match using etag_YYYY_MM
2) If 200:
   - Parse games; build Set of Active_UUID_Index
   - newGames = monthly.games.filter(g => !set.has(g.uuid))
   - Sort newGames by end_time asc
   - Append rows to Active_Games and Active_Meta
   - Append UUIDs to Active_UUID_Index
   - Update etag_YYYY_MM and lastSeen pointers
3) If 304: exit

### Month rollover
- On 1st of the month (or detection), copy Active_* to Archive_*; clear Active_* and UUID index; set current month

### Enrichment orchestration
- arrays: computeArraysForMonth(YYYY,MM)
- callbacks: fetchRatingChangeForMissing(YYYY,MM)
- Both read/write only Meta; Main stays minimal

### Performance patterns
- Batch setValues (1–5k rows)
- Maintain UUID Set in-memory; write index once
- Avoid per-cell formulas; compute in script
- Separate fetch/append from enrichment passes

### Failure and retry
- Log cursor (last processed UUID) to resume partial writes
- Retry network with exponential backoff and jitter
- Keep a “quarantine” sheet for rows that failed to parse/enrich

### Testing strategy
- Dry-run mode: build rows but don’t write
- Sample-only mode: limit to N latest games
- Compare aggregates across old/new runs (counts per format, last end_dt)

