## Chess.com Published Data API — Game object reference

### Game object fields
| Field | Type | Description | Example | Constants | Notes |
|---|---|---|---|---|---|
| url | string (URL) | Public viewer URL for the game on chess.com | https://www.chess.com/game/live/48100136511 | - | Viewer link, not a Published Data API URL. |
| pgn | string (PGN) | Final PGN with headers and moves | [Event "Live Chess"] … | - | Includes headers like Event, Site, Date, TimeControl, ECO, Termination, Link; may include a Tournament link. |
| time_control | string | PGN-compliant time control | 600 | - | Either total seconds (e.g., 600) or base+increment (e.g., 180+2, 600+0). |
| end_time | integer (epoch seconds) | UTC timestamp when the game ended | 1654360575 | - | Unix epoch seconds. |
| rated | boolean | Whether the game affected rating | true | true, false | - |
| accuracies | object | Engine accuracy stats if available | { "white": 96.6, "black": 91.73 } | - | Optional; may be absent. Values are percentages 0–100. |
| tcn | string | Encoded move sequence (TCN) | mC0Kgv5Q… | - | Optional compact encoding used internally. |
| uuid | string (UUID) | Unique game identifier | 59c9a1b0-e422-11ec-85a4-78ac4409ff3c | - | Often present. |
| initial_setup | string (FEN) | Starting position FEN | rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 | - | For Chess960/variants, this differs from the standard initial FEN. |
| fen | string (FEN) | Final position FEN | 6Q1/5B2/5ppk/1K2b2p/3qP3/7P/2q3P1/1r6 w - - | - | Ending position of the game. |
| time_class | string | Time category of the game | rapid | bullet, blitz, rapid, daily | Derived from time control; daily = correspondence. |
| rules | string | Game rules/variant | chess | chess, chess960 | Most archives are chess or chess960. |
| white | object (PlayerRef) | White player details | { rating: 2843, result: "win", … } | - | See PlayerRef below. |
| black | object (PlayerRef) | Black player details | { rating: 2699, result: "50move", … } | - | See PlayerRef below. |
| eco | string (URL) | Opening reference URL (if available) | https://www.chess.com/openings/Reti-Opening... | - | Points to chess.com Opening Explorer; optional. |
| tournament | string (URL) | Published Data API tournament link | https://api.chess.com/pub/tournament/rapid-chess-championship-week-17-3178635 | - | Optional; present if part of a tournament. |
| match | string (URL) | Published Data API team match link | https://api.chess.com/pub/match/{id} | - | Optional; present for team matches. |

### PlayerRef (white/black) object
| Field | Type | Description | Example | Constants | Notes |
|---|---|---|---|---|---|
| rating | integer | Player rating at time of game | 2843 | - | Pool-specific rating (e.g., rapid/blitz/bullet). |
| result | string | Player’s game result code | win | See list below | Perspective of the given player. |
| @id | string (URL) | Published Data API player profile URL | https://api.chess.com/pub/player/hikaru | - | Use to fetch player profile. |
| username | string | Player’s username (canonical case) | Hikaru | - | Case-insensitive in URLs; responses show canonical casing. |
| uuid | string (UUID) | Player unique identifier | 6f4deb88-7718-11e3-8016-000000000000 | - | Stable member ID. |

### Accuracies object
| Field | Type | Description | Example | Constants | Notes |
|---|---|---|---|---|---|
| white | number | White’s accuracy percentage | 96.6 | - | 0–100; optional overall field. |
| black | number | Black’s accuracy percentage | 91.73 | - | 0–100; optional overall field. |

### Constant lists
- **time_class**: bullet, blitz, rapid, daily
- **rules**: chess, chess960
- **result (PlayerRef.result)**:
  - win, lose, draw
  - checkmated, resigned, timeout, stalemate
  - agreed, repetition, insufficient, 50move, abandoned
  - timevsinsufficient
  - kingofthehill, threecheck
  - noresult, cheat
  - bughousepartnerlose

### Field naming convention
- Keep API JSON field names as-is (e.g., `time_class`, `end_time`).
- For values derived from PGN headers, use canonical snake_case keys prefixed with `pgn_` (e.g., `pgn_event`, `pgn_white_elo`).

### PGN headers (derived)
| Key (canonical) | PGN Header | Type | Description | Example | Notes |
|---|---|---|---|---|---|
| pgn_event | Event | string | Event name | Live Chess | Optional. |
| pgn_site | Site | string | Site identifier | Chess.com | - |
| pgn_date | Date | string (YYYY.MM.DD) | Local date of game | 2022.06.04 | Use `pgn_utc_date` for UTC. |
| pgn_round | Round | string | Round identifier | - | Often "-" for live games. |
| pgn_white | White | string | White player display name | Hikaru | Case may be canonicalized. |
| pgn_black | Black | string | Black player display name | Oleksandr_Bortnyk | - |
| pgn_result | Result | string | PGN result code | 1-0 | Redundant with per-player results. |
| pgn_eco_code | ECO | string | ECO opening code | C70 | - |
| pgn_eco_url | ECOUrl | string (URL) | Opening reference URL | https://www.chess.com/openings/... | Optional. |
| pgn_time_control | TimeControl | string | PGN time control | 600 | Mirrors JSON `time_control`. |
| pgn_termination | Termination | string | Result text | Hikaru won by resignation | Human-readable summary. |
| pgn_start_time | StartTime | string (HH:MM:SS) | Local start time | 16:21:02 | May be present. |
| pgn_end_date | EndDate | string (YYYY.MM.DD) | Local end date | 2022.06.04 | Optional. |
| pgn_end_time | EndTime | string (HH:MM:SS) | Local end time | 16:36:15 | Often without TZ; varies. |
| pgn_link | Link | string (URL) | Game viewer URL | https://www.chess.com/game/live/48100136511 | - |
| pgn_opening | Opening | string | Opening name | Ruy Lopez | Optional. |
| pgn_variation | Variation | string | Opening variation | Cozio Defense | Optional. |
| pgn_current_position | CurrentPosition | string (FEN) | Snapshot position | 2r1k3/... | Non-standard header used by Chess.com. |
| pgn_timezone | Timezone | string | Time zone label | UTC | Optional. |
| pgn_utc_date | UTCDate | string (YYYY.MM.DD) | UTC date | 2022.06.04 | - |
| pgn_utc_time | UTCTime | string (HH:MM:SS) | UTC time | 16:21:02 | - |
| pgn_white_elo | WhiteElo | integer | White rating | 2846 | May differ slightly from JSON. |
| pgn_black_elo | BlackElo | integer | Black rating | 2609 | - |
| pgn_setup | SetUp | string (0/1) | Indicates non-standard initial position | 1 | When FEN is provided. |
| pgn_fen | FEN | string (FEN) | Initial position FEN | rnbqkbnr/... | Mirrors JSON `initial_setup` when present. |
| pgn_moves | (moves) | string | The PGN moves body (full movetext) | 1. e4 e5 2. Nf3 Nc6 ... | Extract from PGN after headers and blank line. |
