#!/usr/bin/env python3
import argparse
import json
import math
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from dateutil import parser as dtparser
from requests.adapters import HTTPAdapter, Retry
from tqdm import tqdm


API_BASE = "https://api.chess.com/pub"


def build_session(user_agent: Optional[str], max_retries: int = 3, backoff_factor: float = 0.6) -> requests.Session:
    session = requests.Session()
    headers = {}
    if user_agent:
        headers["User-Agent"] = user_agent
    session.headers.update(headers)

    retry = Retry(
        total=max_retries,
        read=max_retries,
        connect=max_retries,
        status=max_retries,
        backoff_factor=backoff_factor,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def get_json(session: requests.Session, url: str, sleep_seconds: float) -> Optional[Dict[str, Any]]:
    resp = session.get(url, timeout=30)
    if resp.status_code == 429:
        retry_after = resp.headers.get("Retry-After")
        delay = float(retry_after) if retry_after and retry_after.isdigit() else max(1.0, sleep_seconds * 2)
        time.sleep(delay)
        resp = session.get(url, timeout=30)
    if resp.status_code == 404 or resp.status_code == 410:
        return None
    resp.raise_for_status()
    if sleep_seconds > 0:
        time.sleep(sleep_seconds)
    return resp.json()


def list_archives(session: requests.Session, username: str, sleep_seconds: float) -> List[str]:
    url = f"{API_BASE}/player/{username}/games/archives"
    data = get_json(session, url, sleep_seconds)
    if not data or "archives" not in data:
        return []
    return list(data["archives"])


def fetch_month_games(session: requests.Session, archive_url: str, sleep_seconds: float) -> List[Dict[str, Any]]:
    data = get_json(session, archive_url, sleep_seconds)
    if not data or "games" not in data:
        return []
    return list(data["games"])


def parse_time_control(tc: str) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    # Examples: "60+0", "180+2", "600+5", "1/86400" (daily)
    if not tc:
        return None, None, None
    if "/" in tc:
        try:
            base, per = tc.split("/", 1)
            return int(base), int(per), tc
        except Exception:
            return None, None, tc
    if "+" in tc:
        try:
            base, inc = tc.split("+", 1)
            return int(base), int(inc), f"{int(base)}+{int(inc)}"
        except Exception:
            return None, None, tc
    try:
        base = int(tc)
        return base, 0, f"{base}+0"
    except Exception:
        return None, None, tc


def extract_pgn_field(pgn: str, tag: str) -> Optional[str]:
    if not pgn:
        return None
    m = re.search(rf"\[{re.escape(tag)}\s+\"([^\"]*)\"\]", pgn)
    return m.group(1) if m else None


def estimate_move_count(pgn: str) -> Optional[int]:
    if not pgn:
        return None
    # Count occurrences of a dot following a number (naive but robust). E.g., "1. e4 e5 2. Nf3 ..."
    numbers = re.findall(r"\b(\d+)\.\s", pgn)
    if not numbers:
        return None
    try:
        return int(numbers[-1])
    except Exception:
        return None


def normalize_game(username: str, game: Dict[str, Any]) -> Dict[str, Any]:
    username_lower = username.lower()
    white = game.get("white", {})
    black = game.get("black", {})
    is_white = white.get("username", "").lower() == username_lower
    user_color = "white" if is_white else "black"
    me = white if is_white else black
    opp = black if is_white else white

    # Base fields
    url = game.get("url")
    uuid = game.get("uuid")
    end_time = game.get("end_time")
    end_ts_utc = datetime.fromtimestamp(end_time, tz=timezone.utc).isoformat() if isinstance(end_time, (int, float)) else None
    time_class = game.get("time_class")
    time_control = game.get("time_control")
    base_seconds, inc_seconds, time_control_mode = parse_time_control(time_control)
    pgn = game.get("pgn") or ""

    # PGN-derived
    eco = extract_pgn_field(pgn, "ECO")
    opening_name = extract_pgn_field(pgn, "Opening")
    eco_family = eco[0] if eco else None
    termination = extract_pgn_field(pgn, "Termination") or game.get("termination")
    result_tag = extract_pgn_field(pgn, "Result")
    move_count = estimate_move_count(pgn)

    # Results
    my_result = me.get("result") or result_tag
    is_win = my_result == "win"
    is_loss = my_result in {"checkmated", "resigned", "timeout", "lose", "abandoned"}
    is_draw = my_result in {"agreed", "stalemate", "repetition", "timevsinsufficient", "insufficient", "50move", "draw"}

    # Reason
    result_reason = my_result or termination

    # Opponent details
    opponent_username = opp.get("username")
    opponent_rating = opp.get("rating")
    my_rating = me.get("rating")

    # Sanitize ratings to int when possible
    try:
        opponent_rating = int(opponent_rating) if opponent_rating is not None else None
    except Exception:
        pass
    try:
        my_rating = int(my_rating) if my_rating is not None else None
    except Exception:
        pass

    # Rating delta best-effort (many payloads lack both pre/post; leave None if unavailable)
    rating_delta = None
    if isinstance(me.get("rating_change"), (int, float)):
        rating_delta = int(me["rating_change"])  # some wrappers use this; raw API often does not

    # End-by booleans (from termination or my_result)
    end_by_checkmate = (my_result == "win" and opp.get("result") == "checkmated") or (termination and "checkmate" in termination.lower())
    end_by_resignation = (my_result == "win" and opp.get("result") == "resigned") or (termination and "resign" in termination.lower())
    end_by_stalemate = ("stalemate" in (my_result or "")) or (termination and "stalemate" in termination.lower())

    # Build normalized record
    rec = {
        # Identity
        "username": username,
        "user_color": user_color,
        "opponent_username": opponent_username,
        # Game meta
        "url": url,
        "uuid": uuid,
        "time_class": time_class,
        "time_control": time_control,
        "time_control_mode": time_control_mode,
        "time_control_seconds": base_seconds,
        "increment_seconds": inc_seconds,
        # Ratings
        "user_rating": my_rating,
        "opponent_rating": opponent_rating,
        "rating_delta": rating_delta,
        # Results
        "user_result": my_result,
        "is_win": is_win,
        "is_loss": is_loss,
        "is_draw": is_draw,
        "result_reason": result_reason,
        # Opening
        "eco": eco,
        "eco_family": eco_family,
        "opening_name": opening_name,
        # Timing
        "end_time": end_time,
        "end_ts_utc": end_ts_utc,
        # PGN derivations
        "pgn_move_count": move_count,
        "end_by_checkmate": end_by_checkmate,
        "end_by_resignation": end_by_resignation,
        "end_by_stalemate": end_by_stalemate,
        # Raw passthroughs
        "raw": game,
    }
    return rec


def write_ndjson(path: str, records: Iterable[Dict[str, Any]]) -> int:
    count = 0
    with open(path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def write_parquet(path: str, records: List[Dict[str, Any]]):
    import pandas as pd
    df = pd.json_normalize(records)
    # Convert obvious timestamps
    if "end_ts_utc" in df.columns:
        df["end_ts_utc"] = pd.to_datetime(df["end_ts_utc"], errors="coerce")
    df.to_parquet(path, index=False)


def main():
    ap = argparse.ArgumentParser(description="Fetch Chess.com archives for a user and compute derived fields.")
    ap.add_argument("--username", required=True, help="Chess.com username")
    ap.add_argument("--out", required=True, help="Output NDJSON file path, prefix with ndjson:")
    ap.add_argument("--parquet", help="Optional Parquet output path")
    ap.add_argument("--sleep", type=float, default=0.5, help="Sleep seconds between requests (polite rate limiting)")
    ap.add_argument("--max-retries", type=int, default=3, help="HTTP retry attempts")
    ap.add_argument("--user-agent", default=None, help="Custom User-Agent header")
    args = ap.parse_args()

    if not args.out.startswith("ndjson:"):
        print("--out must be in form ndjson:/path/to/file.ndjson", file=sys.stderr)
        sys.exit(2)
    ndjson_path = args.out.split("ndjson:", 1)[1]

    session = build_session(args.user_agent, max_retries=args.max_retries)

    username = args.username
    archives = list_archives(session, username, args.sleep)
    if not archives:
        print("No archives found or user not found.")
        sys.exit(1)

    all_records: List[Dict[str, Any]] = []
    for url in tqdm(archives, desc="Fetching monthly archives"):
        month_games = fetch_month_games(session, url, args.sleep)
        for g in month_games:
            rec = normalize_game(username, g)
            all_records.append(rec)

    # Write NDJSON
    wrote = write_ndjson(ndjson_path, all_records)
    print(f"Wrote {wrote} games to {ndjson_path}")

    # Optional Parquet
    if args.parquet:
        write_parquet(args.parquet, all_records)
        print(f"Wrote Parquet to {args.parquet}")

    # Preview: print schema of derived fields
    sample = all_records[0] if all_records else {}
    derived_keys = [
        "user_color",
        "opponent_username",
        "opponent_rating",
        "is_win",
        "is_loss",
        "is_draw",
        "result_reason",
        "time_class",
        "time_control_mode",
        "time_control_seconds",
        "increment_seconds",
        "eco",
        "eco_family",
        "opening_name",
        "pgn_move_count",
        "end_by_checkmate",
        "end_by_resignation",
        "end_by_stalemate",
    ]
    print("Derived fields (sample values):")
    for k in derived_keys:
        print(f"  {k}: {sample.get(k)}")


if __name__ == "__main__":
    main()

