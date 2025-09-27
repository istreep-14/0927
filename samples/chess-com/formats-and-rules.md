## Time class and type

| Field | Values | Description |
|---|---|---|
| time_class | bullet, blitz, rapid, daily | Chess.com time categories. |
| drv_type | live, daily | Derived: if `time_class` is `daily` → `daily`, else `live`. |

## Rules (variants)

| Rule | Description |
|---|---|
| chess | Standard chess. Dominant; uses standard initial setup. Separate ratings by time class. |
| chess960 | Fischer Random (Chess960). Pieces randomized on back rank; different initial setup; second most common. |
| bughouse | 2v2 variant played on two boards; captured pieces passed to partner. |
| crazyhouse | 1v1 variant similar to bughouse; captured pieces can be dropped back onto the board. |
| kingofthehill | Variant where bringing your king to the center squares wins. |
| threecheck | Variant where delivering three checks wins. |
| oddschess | Variant with material/time odds; generally unrated. |

## Format mapping (ratings perspective)

Rules → drv_format

- If rules = `chess` → `drv_format = time_class`
- If rules = `chess960` →
  - If time_class = `daily` → `drv_format = daily960`
  - Else → `drv_format = live960`
- If rules ∈ { `bughouse`, `crazyhouse`, `kingofthehill`, `threecheck`, `oddschess` } → `drv_format = rules`

Constant list of formats: bullet, blitz, rapid, daily, live960, daily960, bughouse, crazyhouse, kingofthehill, threecheck, oddschess.

Note: `oddschess` games are typically unrated; player rating values do not change due to these games.

## Time control parsing

| Input form | Meaning | Derived fields |
|---|---|---|
| BASE | Each side gets BASE seconds. | drv_base_time = BASE; drv_increment_time = 0 |
| BASE+INC | Base seconds plus increment per move. | drv_base_time = BASE; drv_increment_time = INC |
| 1/SECONDS | Correspondence (daily) time: SECONDS to respond per move. | drv_correspondence_time = SECONDS |

Implementation tips:
- For daily games, prefer `drv_correspondence_time`; for live games, prefer `drv_base_time` and `drv_increment_time`.
- Parse as integers; missing increment defaults to 0.
