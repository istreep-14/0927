## Chess.com Published Data API — game result codes

### Codes, outcomes, and descriptions
| Code | Outcome (this player) | Description |
|---|---|---|
| win | win | Win. (The opponent typically shows the mechanism, e.g., resigned, checkmated, timeout, abandoned.) |
| checkmated | lose | Player was checkmated. |
| agreed | draw | Draw agreed. |
| repetition | draw | Draw by repetition. |
| timeout | lose | Player lost on time. |
| resigned | lose | Player resigned. |
| stalemate | draw | Draw by stalemate. |
| lose | lose | Generic loss. |
| insufficient | draw | Draw due to insufficient mating material. |
| 50move | draw | Draw by 50-move rule. |
| abandoned | lose | Game ended without completion (forfeit/abandoned). |
| kingofthehill | lose | Opponent king reached the hill (variant). |
| threecheck | lose | Opponent delivered the third check (variant). |
| timevsinsufficient | draw | Draw by timeout vs insufficient material. |
| bughousepartnerlose | lose | Bughouse variant: player loses because partner lost. |

Notes
- `result` is per player; one game shows complementary values for white/black.
- Winners usually show `win`; losing side carries the specific reason.
- `kingofthehill` and `threecheck` appear on the losing side in this table (opponent achieved the win condition).
- This list follows the Published Data API “Game results codes”.

