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

