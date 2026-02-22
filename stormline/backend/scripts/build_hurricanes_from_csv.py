#!/usr/bin/env python3
"""
Build hurricanes.json format from atlantic_storms.csv and pacific_storms.csv.
Output: sample_data/hurricanes_from_csv.json
"""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

# Knots to mph
KNOTS_TO_MPH = 1.15078

# Saffir-Simpson scale (mph)
def wind_to_category(mph: float) -> int:
    if mph >= 157:
        return 5
    if mph >= 130:
        return 4
    if mph >= 111:
        return 3
    if mph >= 96:
        return 2
    if mph >= 74:
        return 1
    return 0


def infer_affected_countries(track: list) -> list:
    """Infer countries from track lat/lon (rough heuristics)."""
    countries = set()
    for point in track:
        lat, lon = point["lat"], point["lon"]
        if 25 <= lat <= 50 and -125 <= lon <= -65:
            countries.add("United States")
        if 15 <= lat <= 32 and -118 <= lon <= -86:
            countries.add("Mexico")
        if 18 <= lat <= 25 and -100 <= lon <= -74:
            countries.add("Cuba")
        if 17 <= lat <= 22 and -78 <= lon <= -70:
            countries.add("Jamaica")
        if 18 <= lat <= 20 and -75 <= lon <= -71:
            countries.add("Haiti")
        if 18 <= lat <= 27 and -79 <= lon <= -72:
            countries.add("Bahamas")
        if 10 <= lat <= 19 and -90 <= lon <= -60:
            countries.add("Dominican Republic")
        if 17.5 <= lat <= 18.5 and -67 <= lon <= -65:
            countries.add("Puerto Rico")
        if 12 <= lat <= 25 and -90 <= lon <= -60:
            if "Cuba" not in countries and "Jamaica" not in countries:
                for c in ("Cuba", "Jamaica", "Haiti", "Dominican Republic"):
                    if (c == "Cuba" and 18 <= lat <= 25 and -85 <= lon <= -74) or \
                       (c == "Jamaica" and 17.5 <= lat <= 18.5 and -78.5 <= lon <= -76) or \
                       (c == "Haiti" and 18 <= lat <= 20 and -74.5 <= lon <= -71.5) or \
                       (c == "Dominican Republic" and 17.5 <= lat <= 20 and -72 <= lon <= -68):
                        countries.add(c)
        if 20 <= lat <= 35 and -100 <= lon <= -80:
            countries.add("United States")  # Gulf
        if 8 <= lat <= 28 and 115 <= lon <= 135:
            countries.add("Philippines")
        if 20 <= lat <= 40 and 120 <= lon <= 145:
            countries.add("Japan")
        if 18 <= lat <= 28 and 100 <= lon <= 122:
            countries.add("China")
        if 5 <= lat <= 25 and 70 <= lon <= 95:
            countries.add("India")
        if 15 <= lat <= 25 and 88 <= lon <= 93:
            countries.add("Bangladesh")
        if 20 <= lat <= 25 and 120 <= lon <= 122:
            countries.add("Taiwan")
    return sorted(countries) if countries else ["Unknown"]


def estimate_population(countries: list, max_cat: int) -> int:
    """Rough estimate based on category and region."""
    base = 100000 * max_cat
    if "United States" in countries:
        base *= 3
    if "Philippines" in countries or "India" in countries or "Bangladesh" in countries:
        base *= 2
    return min(base, 50_000_000)


def slugify(name: str, year: int) -> str:
    """Create id like katrina_2005."""
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")
    return f"{clean}_{year}" if clean and clean != "unnamed" else f"storm_{year}"


def load_and_group(csv_path: Path) -> dict:
    """Load CSV and group rows by storm id."""
    storms = defaultdict(list)
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            storms[row["id"]].append(row)
    return storms


def process_storm(rows: list, basin: str) -> dict | None:
    """Convert CSV rows to hurricanes.json format."""
    if not rows:
        return None
    first = rows[0]
    storm_id = first["id"]
    raw_name = first["name"].strip()
    name = raw_name.title() if raw_name.upper() != "UNNAMED" else raw_name
    if name.upper() == "UNNAMED":
        name = f"Storm {storm_id}"
    elif basin == "EP" and not name.upper().startswith("HURRICANE") and not name.upper().startswith("TYPHOON"):
        name = f"Hurricane {name}" if "AL" in storm_id or "EP" in storm_id else f"Typhoon {name}"
    elif basin in ("WP", "IO") and not name.upper().startswith("TYPHOON") and not name.upper().startswith("CYCLONE"):
        name = f"Cyclone {name}" if "IO" in storm_id or "SH" in storm_id else f"Typhoon {name}"
    elif not any(name.upper().startswith(p) for p in ("HURRICANE", "TYPHOON", "CYCLONE", "STORM")):
        name = f"Hurricane {name}"

    year = int(first["date"][:4])
    track = []
    max_wind_mph = 0
    for r in rows:
        try:
            wind_kt = float(r.get("maximum_sustained_wind_knots") or 0)
            lat = float(r.get("latitude") or 0)
            lon = float(r.get("longitude") or 0)
        except (ValueError, TypeError):
            continue
        wind_mph = wind_kt * KNOTS_TO_MPH
        max_wind_mph = max(max_wind_mph, wind_mph)
        track.append({"lat": round(lat, 1), "lon": round(lon, 1), "wind": round(wind_mph)})

    if not track:
        return None

    max_category = wind_to_category(max_wind_mph)
    if max_category == 0 and max_wind_mph < 40:
        return None  # Skip weak depressions

    affected_countries = infer_affected_countries(track)
    pop = estimate_population(affected_countries, max(1, max_category))
    storm_id_slug = slugify(name.replace("Hurricane ", "").replace("Typhoon ", "").replace("Cyclone ", ""), year)

    return {
        "id": storm_id_slug,
        "name": name,
        "year": year,
        "max_category": max(1, max_category),
        "track": track,
        "affected_countries": affected_countries,
        "estimated_population_affected": pop,
    }


def main():
    base = Path(__file__).parent.parent
    atlantic_path = Path("/Users/arnavtaduvayi/Downloads/atlantic_storms.csv")
    pacific_path = Path("/Users/arnavtaduvayi/Downloads/pacific_storms.csv")
    out_path = base / "sample_data" / "hurricanes_from_csv.json"

    if not atlantic_path.exists() or not pacific_path.exists():
        print("CSV files not found. Update paths in script.")
        return

    all_storms = []
    seen_ids = set()

    for csv_path, basin in [(atlantic_path, "AL"), (pacific_path, "EP")]:
        storms = load_and_group(csv_path)
        for sid, rows in storms.items():
            storm = process_storm(rows, basin)
            if storm and storm["id"] not in seen_ids:
                seen_ids.add(storm["id"])
                all_storms.append(storm)

    all_storms.sort(key=lambda s: (s["year"], s["name"]))

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_storms, f, indent=2)

    print(f"Wrote {len(all_storms)} storms to {out_path}")


if __name__ == "__main__":
    main()
