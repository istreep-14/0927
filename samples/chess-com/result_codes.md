## Chess.com Published Data API — game result codes

### Codes, outcomes, and opponent effects
| Code | Outcome (this player) | Opponent outcome | Description |
|---|---|---|---|
| win | win | lose | Player won the game. Opponent typically shows the mechanism (e.g., resigned, checkmated, timeout, abandoned). |
| checkmated | lose | win | Player was checkmated. Opponent wins. |
| resigned | lose | win | Player resigned. Opponent wins. |
| timeout | lose | win | Player lost on time. Opponent wins unless draw condition below applies. |
| stalemate | draw | draw | Draw by stalemate. Both sides show stalemate. |
| agreed | draw | draw | Draw by agreement. Both sides show agreed. |
| repetition | draw | draw | Draw by threefold repetition. Both sides show repetition. |
| insufficient | draw | draw | Draw due to insufficient mating material. Both sides show insufficient. |
| 50move | draw | draw | Draw by the fifty-move rule. Both sides show 50move. |
| abandoned | lose | win | Game ended without completion (forfeit/abandon). Opponent wins. |
| timevsinsufficient | draw | draw | Draw: one side timed out while the opponent had insufficient mating material. Both sides show timevsinsufficient. |
| kingofthehill | win | lose | Variant win by reaching the center (King of the Hill). Opponent loses. |
| threecheck | win | lose | Variant win by delivering three checks (Three‑Check). Opponent loses. |
| bughousepartnerlose | lose | win | Variant (Bughouse): player loses because their partner lost. Opponent wins. |

Notes
- The `result` value is per player. A single game will have complementary values for white/black (e.g., white: win, black: resigned).
- For a winner, the code is usually `win`; the losing side carries the specific loss reason (e.g., `resigned`, `checkmated`, `timeout`).
- `timevsinsufficient` is the only timeout case that results in a draw.
- Excluded values: `noresult`, `cheat` — these are not part of the Published Data API’s documented result codes.

