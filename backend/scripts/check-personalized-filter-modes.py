#!/usr/bin/env python3

import argparse
import itertools
import json
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional

UI_GENRES = [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Sports",
    "Racing",
    "Indie",
    "Casual",
    "Horror",
]


@dataclass
class ScenarioResult:
    label: str
    path: str
    count: int
    app_ids: list[int]
    names: list[str]
    error: Optional[str] = None


def fetch_json(base_url: str, path: str) -> Any:
    url = f"{base_url}{path}"
    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code != 429 or attempt == 2:
                raise
        except Exception as error:
            last_error = error
            if attempt == 2:
                raise
        time.sleep(1.0 * (attempt + 1))

    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def run_scenario(base_url: str, label: str, path: str) -> ScenarioResult:
    try:
        payload = fetch_json(base_url, path)
        if not isinstance(payload, list):
            raise RuntimeError(f"{label} did not return a JSON array: {payload}")

        return ScenarioResult(
            label=label,
            path=path,
            count=len(payload),
            app_ids=[int(item.get("appId")) for item in payload if "appId" in item],
            names=[str(item.get("name")) for item in payload if "name" in item],
        )
    except Exception as error:
        return ScenarioResult(
            label=label,
            path=path,
            count=0,
            app_ids=[],
            names=[],
            error=str(error),
        )


def print_scenario(result: ScenarioResult) -> None:
    preview = ", ".join(result.names[:5]) if result.names else "(none)"
    print(f"[{result.label}]")
    print(f"  path:  {result.path}")
    print(f"  count: {result.count}")
    print(f"  top5:  {preview}")
    if result.error:
        print(f"  error: {result.error}")
    print("")


def compare_top_ids(a: ScenarioResult, b: ScenarioResult) -> bool:
    return a.app_ids[:5] != b.app_ids[:5]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check generic vs personalized recommendation modes."
    )
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--steam-id", default="76561198393551255")
    parser.add_argument("--genres", default="Action,Horror")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--sweep-ui-pairs", action="store_true")
    parser.add_argument("--require-different", action="store_true")
    parser.add_argument(
        "--min-personalized-count-when-generic-has-five",
        type=int,
        default=5,
        help="During pair sweep, fail if generic has >=5 but personalized has fewer than this many.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    genres = args.genres
    encoded_genres = urllib.parse.quote(genres)

    scenarios = [
        (
            "Steam ID Only",
            f"/api/recommend/user/{args.steam_id}?limit={args.limit}",
        ),
        (
            "Steam ID + Genres",
            f"/api/recommend/user/{args.steam_id}?limit={args.limit}&genres={encoded_genres}",
        ),
        (
            "No Steam ID",
            f"/api/search",
        ),
        (
            "No Steam ID + Genres",
            f"/api/search?genres={encoded_genres}",
        ),
    ]

    results = [run_scenario(base_url, label, path) for label, path in scenarios]

    print("")
    print(f"Target: {base_url}")
    print(f"Steam ID: {args.steam_id}")
    print(f"Genres: {genres}")
    print("")

    for result in results:
        print_scenario(result)

    steam_only, steam_with_genres, no_steam, no_steam_with_genres = results

    differs = compare_top_ids(steam_with_genres, no_steam_with_genres)
    print(
        "Diff check (Steam ID + Genres vs No Steam ID + Genres):",
        "DIFFERENT" if differs else "SAME TOP 5",
    )
    print("")

    failures: list[str] = []
    if steam_only.count == 0:
        failures.append("Steam ID only returned 0 results")
    if no_steam.count == 0:
        failures.append("No Steam ID returned 0 results")
    if no_steam_with_genres.count > 0 and steam_with_genres.count == 0:
        failures.append("Steam ID + genres returned 0 results while generic filtered search returned results")
    for result in results:
        if result.error:
            failures.append(f"{result.label} failed: {result.error}")
    if args.require_different and not differs:
        failures.append("Steam ID + genres did not differ from No Steam ID + genres")

    if args.sweep_ui_pairs:
        print("Pair sweep:")
        suspicious_pairs: list[str] = []
        identical_pairs: list[str] = []
        errored_pairs: list[str] = []
        for genre_a, genre_b in itertools.combinations(UI_GENRES, 2):
            pair = f"{genre_a},{genre_b}"
            encoded_pair = urllib.parse.quote(pair)
            generic_pair = run_scenario(
                base_url,
                f"Generic {pair}",
                f"/api/search?genres={encoded_pair}",
            )
            personalized_pair = run_scenario(
                base_url,
                f"Personalized {pair}",
                f"/api/recommend/user/{args.steam_id}?limit={args.limit}&genres={encoded_pair}",
            )

            if generic_pair.error or personalized_pair.error:
                errored_pairs.append(
                    f"{pair}: generic_error={generic_pair.error!r}, personalized_error={personalized_pair.error!r}"
                )
                continue

            if (
                generic_pair.count >= 5
                and personalized_pair.count < args.min_personalized_count_when_generic_has_five
            ):
                suspicious_pairs.append(
                    f"{pair}: generic={generic_pair.count}, personalized={personalized_pair.count}"
                )

            if (
                generic_pair.count >= 5
                and personalized_pair.count >= 5
                and not compare_top_ids(personalized_pair, generic_pair)
            ):
                identical_pairs.append(pair)

        print(
            f"  suspicious personalized shortfalls: {len(suspicious_pairs)}"
        )
        for entry in suspicious_pairs[:20]:
            print(f"    - {entry}")
        print(f"  identical top-5 pairs: {len(identical_pairs)}")
        for pair in identical_pairs[:10]:
            print(f"    - {pair}")
        print(f"  errored pairs: {len(errored_pairs)}")
        for pair in errored_pairs[:10]:
            print(f"    - {pair}")
        print("")

        if suspicious_pairs:
            failures.append(
                f"{len(suspicious_pairs)} genre pairs still show personalized shortfalls"
            )
        if args.require_different and identical_pairs:
            failures.append(
                f"{len(identical_pairs)} genre pairs still match generic top-5 ordering"
            )
        if errored_pairs:
            failures.append(
                f"{len(errored_pairs)} genre pairs failed to execute cleanly"
            )

    if failures:
        print("FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
