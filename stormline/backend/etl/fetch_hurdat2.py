"""
Fetch and parse HURDAT2 Atlantic hurricane data.
Downloads the dataset, filters to 2020+ hurricanes, and outputs JSON
compatible with the stormline backend schema.
"""

import json
import re
import urllib.request
from pathlib import Path
from typing import List, Dict, Any, Optional


# --- Constants ---

HURDAT2_URL = "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2024-100824.txt"
HURDAT2_FALLBACK_INDEX = "https://www.nhc.noaa.gov/data/hurdat/"

MIN_YEAR = 2020

EXISTING_IDS = {
    "ida_2021", "ian_2022", "fiona_2022", "typhoon_goni_2020",
    "cyclone_amphan_2020", "cyclone_freddy_2023", "cyclone_yarin_2023",
    "typhoon_chanthu_2021", "typhoon_doksuri_2023", "typhoon_saola_2023",
    "cyclone_tej_2023", "beryl_2024", "milton_2024", "helene_2024",
    "melissa_2025", "erin_2025", "humberto_2025", "gabrielle_2025",
}

# Extract name_year pairs from existing IDs for duplicate detection
EXISTING_NAME_YEARS = set()
for eid in EXISTING_IDS:
    parts = eid.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        # Handle prefixed names like "typhoon_goni_2020" -> ("goni", "2020")
        name_part = parts[0]
        for prefix in ("typhoon_", "cyclone_", "hurricane_"):
            if name_part.startswith(prefix):
                name_part = name_part[len(prefix):]
                break
        EXISTING_NAME_YEARS.add((name_part.lower(), int(parts[1])))

# Saffir-Simpson scale thresholds (max sustained wind in knots)
def saffir_simpson(wind_kt: int) -> int:
    if wind_kt >= 137:
        return 5
    if wind_kt >= 113:
        return 4
    if wind_kt >= 96:
        return 3
    if wind_kt >= 83:
        return 2
    if wind_kt >= 64:
        return 1
    return 0

# Country bounding boxes: (lat_min, lat_max, lon_min, lon_max)
COUNTRY_BOXES = {
    "United States":      (24, 49, -125, -66),
    "Mexico":             (14, 33, -118, -86),
    "Cuba":               (19.5, 23.5, -85, -74),
    "Jamaica":            (17.5, 18.6, -78.5, -76),
    "Haiti":              (18, 20, -74.5, -71.5),
    "Dominican Republic": (17.5, 20, -72, -68),
    "Puerto Rico":        (17.9, 18.6, -67.3, -65.5),
    "Bahamas":            (20, 27.5, -80, -72),
    "Honduras":           (13, 16.5, -89.5, -83),
    "Nicaragua":          (10.5, 15, -87.5, -83),
    "Belize":             (15.5, 18.5, -89.5, -87.5),
    "Guatemala":          (13.5, 18, -92.5, -88),
    "Canada":             (42, 84, -141, -52),
    "Bermuda":            (32, 32.5, -65, -64.5),
}


# --- Parsing ---

def parse_lat(s: str) -> float:
    """Parse latitude like '18.0N' or '5.2S'."""
    s = s.strip()
    val = float(s[:-1])
    if s[-1] == "S":
        val = -val
    return val


def parse_lon(s: str) -> float:
    """Parse longitude like '84.6W' or '10.0E'."""
    s = s.strip()
    val = float(s[:-1])
    if s[-1] == "W":
        val = -val
    return val


def download_hurdat2() -> str:
    """Download HURDAT2 data and return as string."""
    print(f"Downloading HURDAT2 from {HURDAT2_URL} ...")
    try:
        req = urllib.request.Request(HURDAT2_URL, headers={"User-Agent": "stormline-etl/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
        print(f"  Downloaded {len(data):,} bytes")
        return data
    except Exception as e:
        print(f"  Primary URL failed: {e}")
        print(f"  Trying fallback index at {HURDAT2_FALLBACK_INDEX} ...")
        req = urllib.request.Request(HURDAT2_FALLBACK_INDEX, headers={"User-Agent": "stormline-etl/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            index_html = resp.read().decode("utf-8")
        # Find the latest hurdat2 Atlantic file link
        matches = re.findall(r'href="(hurdat2-1851[^"]*\.txt)"', index_html)
        if not matches:
            raise RuntimeError("Could not find HURDAT2 Atlantic file in index page")
        filename = matches[-1]
        url = HURDAT2_FALLBACK_INDEX + filename
        print(f"  Found file: {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "stormline-etl/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
        print(f"  Downloaded {len(data):,} bytes")
        return data


def parse_hurdat2(raw: str) -> List[Dict[str, Any]]:
    """Parse HURDAT2 text into list of storm dicts."""
    storms = []
    lines = raw.strip().split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Header line: "AL092024,                HELENE,     42,"
        if line[0:2] == "AL" or line[0:2] == "EP" or line[0:2] == "CP":
            parts = line.split(",")
            storm_id = parts[0].strip()
            name = parts[1].strip()
            num_entries = int(parts[2].strip())

            year = int(storm_id[4:8])
            track_points = []
            reached_hurricane = False
            landfall_countries = set()

            i += 1
            for _ in range(num_entries):
                if i >= len(lines):
                    break
                dline = lines[i].strip()
                i += 1

                fields = dline.split(",")
                if len(fields) < 8:
                    continue

                date_str = fields[0].strip()
                time_str = fields[1].strip()
                record_id = fields[2].strip()
                status = fields[3].strip()
                lat = parse_lat(fields[4])
                lon = parse_lon(fields[5])
                max_wind = int(fields[6].strip()) if fields[6].strip() else 0
                min_pressure = fields[7].strip()

                if status == "HU" or max_wind >= 64:
                    reached_hurricane = True

                # Check for landfall
                if record_id == "L":
                    countries = countries_for_point(lat, lon)
                    landfall_countries.update(countries)

                # Only keep synoptic times (0000, 0600, 1200, 1800)
                if time_str in ("0000", "0600", "1200", "1800") and record_id in ("", "L"):
                    track_points.append({
                        "lat": lat,
                        "lon": lon,
                        "wind": max_wind,
                    })

            storms.append({
                "storm_id": storm_id,
                "name": name,
                "year": year,
                "reached_hurricane": reached_hurricane,
                "track": track_points,
                "landfall_countries": landfall_countries,
            })
        else:
            i += 1

    return storms


def countries_for_point(lat: float, lon: float) -> List[str]:
    """Return countries whose bounding box contains the given point."""
    matches = []
    for country, (lat_min, lat_max, lon_min, lon_max) in COUNTRY_BOXES.items():
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            matches.append(country)
    return matches


def determine_affected_countries(storm: Dict[str, Any]) -> List[str]:
    """Determine affected countries from landfall records or track points over land."""
    # Use explicit landfall records first
    if storm["landfall_countries"]:
        return sorted(storm["landfall_countries"])

    # Fall back to checking track points over land
    countries = set()
    for pt in storm["track"]:
        matches = countries_for_point(pt["lat"], pt["lon"])
        countries.update(matches)

    if countries:
        return sorted(countries)
    return ["Open Ocean"]


def is_existing_storm(name: str, year: int) -> bool:
    """Check if storm already exists in our dataset."""
    storm_id = f"{name.lower()}_{year}"
    if storm_id in EXISTING_IDS:
        return True
    if (name.lower(), year) in EXISTING_NAME_YEARS:
        return True
    return False


def storms_to_json(storms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert parsed storms to output JSON schema."""
    results = []

    for storm in storms:
        if storm["year"] < MIN_YEAR:
            continue
        if not storm["reached_hurricane"]:
            continue

        name = storm["name"]
        year = storm["year"]

        # Skip unnamed storms
        if not name or name == "UNNAMED":
            continue

        if is_existing_storm(name, year):
            continue

        max_wind = max((pt["wind"] for pt in storm["track"]), default=0)
        category = saffir_simpson(max_wind)

        affected = determine_affected_countries(storm)

        results.append({
            "id": f"{name.lower()}_{year}",
            "name": f"Hurricane {name.title()}",
            "year": year,
            "max_category": category,
            "track": storm["track"],
            "affected_countries": affected,
            "estimated_population_affected": 0,
        })

    return results


# --- Main ---

def main():
    raw = download_hurdat2()
    storms = parse_hurdat2(raw)
    print(f"Parsed {len(storms)} total storms from HURDAT2")

    hurricanes_2020_plus = [s for s in storms if s["year"] >= MIN_YEAR and s["reached_hurricane"]]
    print(f"Found {len(hurricanes_2020_plus)} hurricanes from {MIN_YEAR}+ in dataset")

    new_hurricanes = storms_to_json(storms)

    # Save output
    output_path = Path(__file__).parent / "new_hurricanes_hurdat2.json"
    with open(output_path, "w") as f:
        json.dump(new_hurricanes, f, indent=2)

    print(f"\nSaved {len(new_hurricanes)} new hurricanes to {output_path}")
    print("\n--- Summary ---")
    if new_hurricanes:
        for h in new_hurricanes:
            print(f"  {h['name']} ({h['year']}) - Category {h['max_category']} - {', '.join(h['affected_countries'])}")
    else:
        print("  No new hurricanes found (all already in dataset)")


if __name__ == "__main__":
    main()
