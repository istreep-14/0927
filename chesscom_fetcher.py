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


def get_profile(session: requests.Session, username: str, sleep_seconds: float) -> Optional[Dict[str, Any]]:
    if not username:
        return None
    url = f"{API_BASE}/player/{username}"
    return get_json(session, url, sleep_seconds)


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


def extract_pgn_tags(pgn: str) -> Dict[str, Optional[str]]:
    if not pgn:
        return {}
    tags = [
        "Event","Site","Date","Round","White","Black","Result",
        "UTCDate","UTCTime","StartTime","EndTime","TimeControl","Termination",
        "ECO","Opening","Variation","CurrentPosition","SetUp","FEN","Link",
        "Annotator","Title","EventDate"
    ]
    out: Dict[str, Optional[str]] = {}
    for t in tags:
        out[t] = extract_pgn_field(pgn, t)
    return out


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
    rated = game.get("rated")
    rules = game.get("rules")  # e.g., "chess", "chess960"
    start_time = game.get("start_time")
    end_time = game.get("end_time")
    end_ts_utc = datetime.fromtimestamp(end_time, tz=timezone.utc).isoformat() if isinstance(end_time, (int, float)) else None
    start_ts_utc = datetime.fromtimestamp(start_time, tz=timezone.utc).isoformat() if isinstance(start_time, (int, float)) else None
    time_class = game.get("time_class")
    time_control = game.get("time_control")
    base_seconds, inc_seconds, time_control_mode = parse_time_control(time_control)
    pgn = game.get("pgn") or ""
    fen_final = game.get("fen")
    initial_setup = game.get("initial_setup")
    tcn = game.get("tcn")
    accuracies = game.get("accuracies") or {}
    accuracy_white = accuracies.get("white")
    accuracy_black = accuracies.get("black")

    # PGN-derived
    eco = extract_pgn_field(pgn, "ECO")
    opening_name = extract_pgn_field(pgn, "Opening")
    opening_variation = extract_pgn_field(pgn, "Variation")
    eco_family = eco[0] if eco else None
    termination = extract_pgn_field(pgn, "Termination") or game.get("termination")
    result_tag = extract_pgn_field(pgn, "Result")
    move_count = estimate_move_count(pgn)
    pgn_tags = extract_pgn_tags(pgn)

    # Results
    my_result = me.get("result") or result_tag
    is_win = my_result == "win"
    is_loss = my_result in {"checkmated", "resigned", "timeout", "lose", "abandoned"}
    is_draw = my_result in {"agreed", "stalemate", "repetition", "timevsinsufficient", "insufficient", "50move", "draw"}

    # Opponent result for winner computation
    opp_result = opp.get("result")
    winner = None
    if (white.get("result") == "win"):
        winner = "white"
    elif (black.get("result") == "win"):
        winner = "black"
    elif is_draw or (result_tag in {"1/2-1/2", "*"}):
        winner = None

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

    # More result categories
    is_timeout = ("timeout" in (my_result or "")) or (termination and "timeout" in termination.lower())
    is_abandoned = ("abandoned" in (my_result or "")) or (termination and "abandon" in termination.lower())
    is_agreed_draw = (my_result == "agreed")
    is_threefold = (my_result == "repetition")
    is_50move = (my_result == "50move")
    is_insufficient_material = (my_result in {"insufficient", "timevsinsufficient"})

    # Points (from perspective of requested username)
    points_user = 1.0 if is_win else (0.5 if is_draw else 0.0)
    points_opponent = 1.0 - points_user if not math.isclose(points_user, 0.5) else 0.5

    # Variants/time controls
    is_daily = ("/" in (time_control or ""))
    is_chess960 = (rules == "chess960") or ((pgn_tags.get("SetUp") == "1") and (pgn_tags.get("FEN") not in (None, "")))
    has_initial_fen = bool(initial_setup or pgn_tags.get("FEN"))
    has_clock_increment = (inc_seconds is not None and inc_seconds > 0)

    # Duration if both timestamps present
    duration_seconds = None
    if isinstance(start_time, (int, float)) and isinstance(end_time, (int, float)):
        duration_seconds = max(0, int(end_time - start_time))

    # Build normalized record
    rec = {
        # Identity
        "username": username,
        "user_color": user_color,
        "opponent_username": opponent_username,
        # Game meta
        "url": url,
        "uuid": uuid,
        "rated": rated,
        "rules": rules,
        "time_class": time_class,
        "time_control": time_control,
        "time_control_mode": time_control_mode,
        "time_control_seconds": base_seconds,
        "increment_seconds": inc_seconds,
        "is_daily": is_daily,
        "is_chess960": is_chess960,
        "has_initial_fen": has_initial_fen,
        "has_clock_increment": has_clock_increment,
        # Ratings
        "user_rating": my_rating,
        "opponent_rating": opponent_rating,
        "rating_delta": rating_delta,
        # Results
        "user_result": my_result,
        "winner": winner,
        "is_win": is_win,
        "is_loss": is_loss,
        "is_draw": is_draw,
        "result_reason": result_reason,
        "is_timeout": is_timeout,
        "is_abandoned": is_abandoned,
        "is_agreed_draw": is_agreed_draw,
        "is_threefold": is_threefold,
        "is_50move": is_50move,
        "is_insufficient_material": is_insufficient_material,
        "points_user": points_user,
        "points_opponent": points_opponent,
        # Opening
        "eco": eco,
        "eco_family": eco_family,
        "opening_name": opening_name,
        "opening_variation": opening_variation,
        # Timing
        "start_time": start_time,
        "end_time": end_time,
        "end_ts_utc": end_ts_utc,
        "start_ts_utc": start_ts_utc,
        "duration_seconds": duration_seconds,
        # PGN derivations
        "pgn_move_count": move_count,
        "end_by_checkmate": end_by_checkmate,
        "end_by_resignation": end_by_resignation,
        "end_by_stalemate": end_by_stalemate,
        # PGN tags harvested
        "pgn_tags": pgn_tags,
        # Board state
        "fen_final": fen_final,
        "initial_setup": initial_setup,
        "tcn": tcn,
        # Accuracies (if present)
        "accuracy_white": accuracy_white,
        "accuracy_black": accuracy_black,
        # Raw passthroughs
        "raw": game,
    }
    return rec


def country_code_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    m = re.search(r"/country/([A-Za-z]{2})$", url)
    return m.group(1) if m else None


def enrich_record_with_profiles(
    session: requests.Session,
    rec: Dict[str, Any],
    sleep_seconds: float,
    cache: Dict[str, Optional[Dict[str, Any]]],
) -> None:
    def cached_profile(name: Optional[str]) -> Optional[Dict[str, Any]]:
        if not name:
            return None
        key = name.lower()
        if key in cache:
            return cache[key]
        prof = get_profile(session, name, sleep_seconds)
        cache[key] = prof
        return prof

    user_name = rec.get("username")
    opp_name = rec.get("opponent_username")
    user_prof = cached_profile(user_name)
    opp_prof = cached_profile(opp_name)

    if user_prof:
        rec["user_title"] = user_prof.get("title")
        rec["user_status"] = user_prof.get("status")
        rec["user_name_full"] = user_prof.get("name")
        rec["user_location"] = user_prof.get("location")
        rec["user_country_code"] = country_code_from_url(user_prof.get("country"))
        rec["user_joined"] = user_prof.get("joined")
        rec["user_last_online"] = user_prof.get("last_online")
        rec["user_fide"] = user_prof.get("fide")
        rec["user_verified"] = user_prof.get("verified")

    if opp_prof:
        rec["opponent_title"] = opp_prof.get("title")
        rec["opponent_status"] = opp_prof.get("status")
        rec["opponent_name_full"] = opp_prof.get("name")
        rec["opponent_location"] = opp_prof.get("location")
        rec["opponent_country_code"] = country_code_from_url(opp_prof.get("country"))
        rec["opponent_joined"] = opp_prof.get("joined")
        rec["opponent_last_online"] = opp_prof.get("last_online")
        rec["opponent_fide"] = opp_prof.get("fide")
        rec["opponent_verified"] = opp_prof.get("verified")


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
    ap.add_argument("--enrich-profiles", action="store_true", help="Enrich records with player profile data (country/title/etc.)")
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
    profile_cache: Dict[str, Optional[Dict[str, Any]]] = {}
    for url in tqdm(archives, desc="Fetching monthly archives"):
        month_games = fetch_month_games(session, url, args.sleep)
        for g in month_games:
            rec = normalize_game(username, g)
            if args.enrich_profiles:
                enrich_record_with_profiles(session, rec, args.sleep, profile_cache)
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
        "opening_variation",
        "pgn_move_count",
        "end_by_checkmate",
        "end_by_resignation",
        "end_by_stalemate",
        "winner",
        "points_user",
        "is_timeout",
        "is_abandoned",
        "is_agreed_draw",
        "is_threefold",
        "is_50move",
        "is_insufficient_material",
        "is_daily",
        "is_chess960",
        "duration_seconds",
        "accuracy_white",
        "accuracy_black",
    ]
    print("Derived fields (sample values):")
    for k in derived_keys:
        print(f"  {k}: {sample.get(k)}")


if __name__ == "__main__":
    main()

