## Chess.com Published Data API — Game object reference

### Game object fields
| Field | Type | Description | Example |
|---|---|---|---|
| url | string (URL) | Public viewer URL for the game on chess.com. Viewer link, not a Published Data API URL. | https://www.chess.com/game/live/48100136511 |
| pgn | string (PGN) | Final PGN with headers and moves. Includes headers like Event, Site, Date, TimeControl, ECO, Termination, Link; may include a Tournament link. | [Event "Live Chess"] … |
| time_control | string | PGN-compliant time control. Either total seconds (e.g., 600) or base+increment (e.g., 180+2, 600+0). | 600 |
| end_time | integer (epoch seconds) | UTC timestamp when the game ended. Unix epoch seconds. | 1654360575 |
| rated | boolean | Whether the game affected rating. | true |
| accuracies | object | Engine accuracy stats if available. Optional; may be absent. Values are percentages 0–100. | { "white": 96.6, "black": 91.73 } |
| tcn | string | Encoded move sequence (TCN). Optional compact encoding used internally. | mC0Kgv5Q… |
| uuid | string (UUID) | Unique game identifier. Often present. | 59c9a1b0-e422-11ec-85a4-78ac4409ff3c |
| initial_setup | string (FEN) | Starting position FEN. For Chess960/variants, this differs from the standard initial FEN. | rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 |
| fen | string (FEN) | Final position FEN. Ending position of the game. | 6Q1/5B2/5ppk/1K2b2p/3qP3/7P/2q3P1/1r6 w - - |
| time_class | string | Time category of the game. Derived from time control; daily = correspondence. | rapid |
| rules | string | Game rules/variant. Most archives are chess or chess960. | chess |
| white | object (PlayerRef) | White player details. See PlayerRef below. | { rating: 2843, result: "win", … } |
| black | object (PlayerRef) | Black player details. See PlayerRef below. | { rating: 2699, result: "50move", … } |
| eco | string (URL) | Opening reference URL (if available). Points to chess.com Opening Explorer; optional. | https://www.chess.com/openings/Reti-Opening... |
| tournament | string (URL) | Published Data API tournament link. Optional; present if part of a tournament. | https://api.chess.com/pub/tournament/rapid-chess-championship-week-17-3178635 |
| match | string (URL) | Published Data API team match link. Optional; present for team matches. | https://api.chess.com/pub/match/{id} |

### PlayerRef (white/black) object
| Field | Type | Description | Example |
|---|---|---|---|
| rating | integer | Player rating at time of game. Pool-specific rating (e.g., rapid/blitz/bullet). | 2843 |
| result | string | Player’s game result code. Perspective of the given player. | win |
| @id | string (URL) | Published Data API player profile URL. Use to fetch player profile. | https://api.chess.com/pub/player/hikaru |
| username | string | Player’s username (canonical case). Case-insensitive in URLs; responses show canonical casing. | Hikaru |
| uuid | string (UUID) | Player unique identifier. Stable member ID. | 6f4deb88-7718-11e3-8016-000000000000 |

### Accuracies object
| Field | Type | Description | Example |
|---|---|---|---|
| white | number | White’s accuracy percentage (0–100). Optional overall field. | 96.6 |
| black | number | Black’s accuracy percentage (0–100). Optional overall field. | 91.73 |

### Field naming convention
- Keep API JSON field names as-is (e.g., `time_class`, `end_time`).
- For values derived from PGN headers, use canonical snake_case keys prefixed with `pgn_` (e.g., `pgn_event`, `pgn_white_elo`).

### PGN headers (derived)
| Key (canonical) | PGN Header | Type | Description | Example |
|---|---|---|---|---|
| pgn_event | Event | string | Event name. Optional. | Live Chess |
| pgn_site | Site | string | Site identifier. | Chess.com |
| pgn_date | Date | string (YYYY.MM.DD) | Local date of game. Use `pgn_utc_date` for UTC. | 2022.06.04 |
| pgn_round | Round | string | Round identifier. Often "-" for live games. | - |
| pgn_white | White | string | White player display name. Case may be canonicalized. | Hikaru |
| pgn_black | Black | string | Black player display name. | Oleksandr_Bortnyk |
| pgn_result | Result | string | PGN result code. Redundant with per-player results. | 1-0 |
| pgn_eco_code | ECO | string | ECO opening code. | C70 |
| pgn_eco_url | ECOUrl | string (URL) | Opening reference URL. Optional. | https://www.chess.com/openings/... |
| pgn_time_control | TimeControl | string | PGN time control. Mirrors JSON `time_control`. | 600 |
| pgn_termination | Termination | string | Result text (human-readable summary). | Hikaru won by resignation |
| pgn_start_time | StartTime | string (HH:MM:SS) | Local start time. May be present. | 16:21:02 |
| pgn_end_date | EndDate | string (YYYY.MM.DD) | Local end date. Optional. | 2022.06.04 |
| pgn_end_time | EndTime | string (HH:MM:SS) | Local end time. Often without TZ; varies. | 16:36:15 |
| pgn_link | Link | string (URL) | Game viewer URL. | https://www.chess.com/game/live/48100136511 |
| pgn_opening | Opening | string | Opening name. Optional. | Ruy Lopez |
| pgn_variation | Variation | string | Opening variation. Optional. | Cozio Defense |
| pgn_current_position | CurrentPosition | string (FEN) | Snapshot position. Non-standard header used by Chess.com. | 2r1k3/... |
| pgn_timezone | Timezone | string | Time zone label. Optional. | UTC |
| pgn_utc_date | UTCDate | string (YYYY.MM.DD) | UTC date. | 2022.06.04 |
| pgn_utc_time | UTCTime | string (HH:MM:SS) | UTC time. | 16:21:02 |
| pgn_white_elo | WhiteElo | integer | White rating. May differ slightly from JSON. | 2846 |
| pgn_black_elo | BlackElo | integer | Black rating. | 2609 |
| pgn_setup | SetUp | string (0/1) | Indicates non-standard initial position. When FEN is provided. | 1 |
| pgn_fen | FEN | string (FEN) | Initial position FEN. Mirrors JSON `initial_setup` when present. | rnbqkbnr/... |
| pgn_moves | (moves) | string | The PGN moves body (full movetext). Extract from PGN after headers and blank line. | 1. e4 e5 2. Nf3 Nc6 ... |
