from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import date
import json
import csv
from pathlib import Path

app = FastAPI(title="HurriCare API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load hurricanes data
hurricanes_file = Path(__file__).parent / "sample_data" / "hurricanes.json"
with open(hurricanes_file, 'r') as f:
    hurricanes_data = json.load(f)

# Load severity data
severity_file = Path(__file__).parent / "sample_data" / "severity.csv"
severity_data = []
with open(severity_file, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        severity_data.append({
            "hurricane_id": row["hurricane_id"],
            "admin1": row["admin1"],
            "severity_index": float(row["severity_index"]),
            "estimated_people_in_need": int(row["estimated_people_in_need"])
        })

# Load projects data
projects_data = []
projects_file = Path(__file__).parent / "sample_data" / "projects.csv"
if projects_file.exists():
    with open(projects_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            projects_data.append({
                "project_id": row["project_id"],
                "hurricane_id": row["hurricane_id"],
                "country": row["country"],
                "admin1": row["admin1"],
                "cluster": row["cluster"],
                "budget_usd": float(row["budget_usd"]),
                "beneficiaries": int(row["beneficiaries"]),
                "pooled_fund": row["pooled_fund"].lower() in ("true", "1", "yes"),
                "implementing_partner": row["implementing_partner"]
            })

# Daily leaderboard (resets each day)
_leaderboard: dict = {}


def _today_key() -> str:
    return date.today().isoformat()


def _get_daily_scores() -> dict:
    key = _today_key()
    if key not in _leaderboard:
        _leaderboard[key] = {}
    return _leaderboard[key]


@app.get("/")
def root():
    return {"message": "HurriCare API - Hurricanes Only", "version": "1.0.0"}


@app.get("/hurricanes")
def get_hurricanes():
    """Get all hurricanes."""
    return hurricanes_data


@app.get("/hurricanes/match")
def find_matching_hurricane(region: str, category: int, direction: Optional[str] = None):
    """Find the hurricane that most closely matches the given region, category, and optional direction."""
    hurricanes = hurricanes_data
    region_lower = region.lower().strip() if region else ""

    scored_hurricanes = []
    for h in hurricanes:
        score = 0
        category_diff = abs(h.get("max_category", 0) - category)
        if category_diff == 0:
            score += 100
        elif category_diff == 1:
            score += 50
        elif category_diff == 2:
            score += 25

        countries_lower = [c.lower() for c in h.get("affected_countries", [])]
        region_found = False
        for country in countries_lower:
            if region_lower and region_lower == country:
                score += 100
                region_found = True
                break
            if region_lower and (region_lower in country or country in region_lower):
                score += 50
                region_found = True
                break

        region_aliases = {
            "us": ["united states", "usa"],
            "usa": ["united states", "us"],
            "united states": ["us", "usa"],
            "caribbean": ["jamaica", "bahamas", "cuba", "haiti", "dominican republic", "puerto rico"],
            "gulf coast": ["united states", "mexico"],
            "east coast": ["united states"],
            "philippines": ["philippines"],
            "china": ["china", "hong kong", "taiwan"],
            "japan": ["japan"],
            "india": ["india", "bangladesh", "sri lanka"],
        }
        if not region_found and region_lower:
            for alias, countries in region_aliases.items():
                if region_lower == alias.lower():
                    for country in countries_lower:
                        if country in countries:
                            score += 75
                            region_found = True
                            break
                    if region_found:
                        break

        direction_match = False
        if direction:
            direction_lower = direction.lower().strip()
            track = h.get("track", [])
            if len(track) >= 2:
                start_idx = max(0, len(track) // 5)
                end_idx = min(len(track) - 1, len(track) - len(track) // 5)
                if end_idx > start_idx:
                    start_point = track[start_idx]
                    end_point = track[end_idx]
                    lat_diff = end_point.get("lat", 0) - start_point.get("lat", 0)
                    lon_diff = end_point.get("lon", 0) - start_point.get("lon", 0)
                    abs_lat, abs_lon = abs(lat_diff), abs(lon_diff)
                    hurricane_direction = None
                    if abs_lat > abs_lon:
                        hurricane_direction = "north" if lat_diff > 0 else "south"
                    else:
                        hurricane_direction = "east" if lon_diff > 0 else "west"
                    if hurricane_direction and direction_lower == hurricane_direction:
                        score += 50
                        direction_match = True
                    elif hurricane_direction:
                        opposite_map = {"north": "south", "south": "north", "east": "west", "west": "east"}
                        if direction_lower == opposite_map.get(hurricane_direction):
                            score += 25

        year_bonus = max(0, (h.get("year", 2000) - 2000) * 0.5)
        score += year_bonus

        scored_hurricanes.append({
            "hurricane": h,
            "score": score,
            "category_match": category_diff == 0,
            "region_match": region_found,
            "direction_match": direction_match
        })

    scored_hurricanes.sort(key=lambda x: x["score"], reverse=True)
    if not scored_hurricanes:
        return {"error": "No hurricanes found"}

    best = scored_hurricanes[0]
    return {
        "match": best["hurricane"],
        "score": best["score"],
        "category_match": best["category_match"],
        "region_match": best["region_match"],
        "alternatives": [s["hurricane"] for s in scored_hurricanes[1:4]]
    }


@app.get("/coverage")
def get_coverage(hurricane_id: Optional[str] = None):
    """Get coverage data for regions."""
    filtered = severity_data
    if hurricane_id:
        filtered = [s for s in severity_data if s["hurricane_id"] == hurricane_id]
    
    coverage = []
    for severity in filtered:
        # Calculate estimated need budget (severity * people_in_need * unit_cost)
        unit_cost = 500  # USD per person
        estimated_need_budget = severity["severity_index"] * severity["estimated_people_in_need"] * unit_cost
        
        # For now, assume no pooled fund budget (can be enhanced later)
        pooled_fund_budget = 0
        
        coverage.append({
            "hurricane_id": severity["hurricane_id"],
            "admin1": severity["admin1"],
            "pooled_fund_budget": pooled_fund_budget,
            "estimated_need_budget": estimated_need_budget,
            "coverage_ratio": pooled_fund_budget / estimated_need_budget if estimated_need_budget > 0 else 0,
            "severity_index": severity["severity_index"],
            "people_in_need": severity["estimated_people_in_need"]
        })
    
    return coverage


@app.post("/simulate_allocation")
def simulate_allocation(request: dict):
    """
    Simulate allocation impact with humanitarian priorities and constraints.
    
    Hard priorities (non-negotiable):
    - Prevent avoidable deaths
    - Prevent severe human suffering
    - Protect vulnerable populations
    
    Soft priorities (trade-offs allowed):
    - Economic loss reduction
    - Speed vs completeness
    - Resource efficiency
    
    Constraints:
    - Logistics
    - Political feasibility
    - Funding
    - Access/security
    """
    hurricane_id = request.get("hurricane_id")
    allocations = request.get("allocations", {})
    
    # Get severity data for this hurricane
    hurricane_severity = [s for s in severity_data if s["hurricane_id"] == hurricane_id]
    
    # Hard priorities metrics
    total_lives_saved = 0  # Prevent avoidable deaths
    total_suffering_reduced = 0  # Prevent severe human suffering
    vulnerable_protected = 0  # Protect vulnerable populations
    
    # Soft priorities metrics
    economic_loss_reduction = 0
    resource_efficiency_score = 0
    
    # Constraints penalties
    logistics_penalty = 0
    access_penalty = 0
    
    unit_cost = 500  # USD per person (base cost)
    vulnerable_multiplier = 1.3  # Vulnerable populations need 30% more resources
    
    total_budget = sum(allocations.values())
    
    for severity in hurricane_severity:
        admin1 = severity["admin1"]
        allocated_budget = allocations.get(admin1, 0)
        people_in_need = severity["estimated_people_in_need"]
        severity_index = severity["severity_index"]
        
        # Calculate coverage
        effective_budget = allocated_budget
        coverage = min(effective_budget / unit_cost, people_in_need) / people_in_need if people_in_need > 0 else 0
        
        # HARD PRIORITIES (non-negotiable)
        # 1. Prevent avoidable deaths (higher severity = more critical)
        deaths_prevented = coverage * people_in_need * severity_index * 0.1  # 10% mortality risk at max severity
        total_lives_saved += deaths_prevented
        
        # 2. Prevent severe human suffering (proportional to severity and coverage gap)
        suffering_reduced = coverage * severity_index * people_in_need
        total_suffering_reduced += suffering_reduced
        
        # 3. Protect vulnerable populations (assume 30% of population is vulnerable)
        vulnerable_pop = people_in_need * 0.3
        vulnerable_coverage = min(coverage * 1.3, 1.0)  # Vulnerable need more resources
        vulnerable_protected += vulnerable_coverage * vulnerable_pop
        
        # SOFT PRIORITIES (trade-offs)
        # Economic loss reduction (prevented losses proportional to coverage)
        # Higher severity = higher economic impact
        economic_loss_prevented = coverage * severity_index * people_in_need * 2000  # $2000 per person economic impact
        economic_loss_reduction += economic_loss_prevented
        
        # Resource efficiency (penalize over-allocation, reward optimal allocation)
        optimal_budget = people_in_need * unit_cost
        if allocated_budget > 0:
            efficiency = min(optimal_budget / allocated_budget, 1.0) if allocated_budget > optimal_budget else allocated_budget / optimal_budget
            resource_efficiency_score += efficiency * allocated_budget / 1000000  # Normalize by million
    
    # CONSTRAINTS (penalties)
    # Logistics penalty: More regions = higher logistics complexity
    num_regions = len([a for a in allocations.values() if a > 0])
    logistics_penalty = num_regions * 0.05  # 5% penalty per additional region
    
    # Access/security penalty: Higher severity regions may have access issues
    high_severity_regions = len([s for s in hurricane_severity if s["severity_index"] > 0.8])
    access_penalty = high_severity_regions * 0.03  # 3% penalty per high-severity region
    
    # Calculate impact score with priorities
    # Hard priorities get very high weights (non-negotiable)
    hard_priority_score = (
        1000 * total_lives_saved +  # Prevent deaths (highest priority)
        100 * total_suffering_reduced +  # Prevent suffering
        50 * vulnerable_protected  # Protect vulnerable
    )
    
    # Soft priorities get moderate weights (trade-offs allowed)
    soft_priority_score = (
        0.1 * economic_loss_reduction +  # Economic benefits
        10 * resource_efficiency_score  # Efficiency
    )
    
    # Apply constraint penalties
    constraint_penalty = (logistics_penalty + access_penalty) * hard_priority_score
    
    impact_score = hard_priority_score + soft_priority_score - constraint_penalty
    
    # Calculate unmet need (critical metric)
    total_unmet_need = sum(
        max(0, s["estimated_people_in_need"] - min(allocations.get(s["admin1"], 0) / unit_cost, s["estimated_people_in_need"]))
        for s in hurricane_severity
    )
    
    return {
        "impact_score": impact_score,
        "lives_covered": total_lives_saved,
        "vulnerability_reduction": total_suffering_reduced,
        "unmet_need": total_unmet_need,
        "hard_priorities": {
            "lives_saved": total_lives_saved,
            "suffering_reduced": total_suffering_reduced,
            "vulnerable_protected": vulnerable_protected
        },
        "soft_priorities": {
            "economic_loss_reduction": economic_loss_reduction,
            "resource_efficiency": resource_efficiency_score
        },
        "constraints": {
            "logistics_penalty": logistics_penalty,
            "access_penalty": access_penalty,
            "total_penalty": logistics_penalty + access_penalty
        },
        "comparison": {
            "current_lives_covered": 0,
            "simulated_lives_covered": total_lives_saved,
            "improvement": total_lives_saved
        }
    }


# Leaderboard endpoints
@app.post("/leaderboard/submit")
def submit_leaderboard_score(data: dict):
    """Submit a simulation score. Adds to player's daily total."""
    player_name = (data.get("player_name") or "Anonymous").strip() or "Anonymous"
    score = float(data.get("score", 0))
    if score < 0:
        score = 0
    daily = _get_daily_scores()
    daily[player_name] = daily.get(player_name, 0) + score
    return {
        "ok": True,
        "player_name": player_name,
        "score_added": score,
        "total_today": daily[player_name],
    }


@app.get("/leaderboard/daily")
def get_daily_leaderboard(limit: int = 10):
    """Get top players for today. Resets each day."""
    daily = _get_daily_scores()
    sorted_entries = sorted(
        daily.items(),
        key=lambda x: x[1],
        reverse=True
    )[:limit]
    return {
        "date": _today_key(),
        "entries": [{"rank": i + 1, "player_name": name, "score": s} for i, (name, s) in enumerate(sorted_entries)],
    }


# Simulation engine endpoints (simplified for main_simple)
@app.get("/simulation/total-budget/{hurricane_id}")
def get_total_budget(hurricane_id: str):
    """Get total pooled fund budget for a hurricane."""
    total = sum(p["budget_usd"] for p in projects_data if p["hurricane_id"] == hurricane_id and p["pooled_fund"])
    return {"total_budget": float(total) if total > 0 else 50000000}


def _make_coverage_estimate(people_in_need: int, severity_index: float, budget: float) -> dict:
    unit_cost = 500
    people_covered = min(int(budget / unit_cost), people_in_need)
    coverage_ratio = people_covered / people_in_need if people_in_need > 0 else 0
    return {
        "people_covered": people_covered,
        "coverage_ratio": coverage_ratio,
        "unmet_need": people_in_need - people_covered,
        "severity_weighted_impact": coverage_ratio * severity_index * people_in_need,
    }


@app.post("/simulation/stage1/user-plan")
def create_user_plan(request: dict):
    """Stage 1: Create user-designed response plan (simplified)."""
    hurricane_id = request.get("hurricane_id")
    allocations = request.get("allocations", {})
    total_budget = request.get("total_budget", 50000000)
    response_window_hours = request.get("response_window_hours", 72)

    hurricane_severity = [s for s in severity_data if s["hurricane_id"] == hurricane_id]
    plan_allocations = []
    for s in hurricane_severity:
        region = s["admin1"]
        budget = allocations.get(region, 0)
        cov = _make_coverage_estimate(
            s["estimated_people_in_need"],
            s["severity_index"],
            budget,
        )
        plan_allocations.append({
            "region": region,
            "budget": float(budget),
            "resources": {"shelters": 0, "hospital_beds": 0, "responder_units": 0, "evac_vehicles": 0, "food_days": 0, "power_units": 0},
            "coverage_estimate": cov,
        })

    return {
        "plan_type": "user",
        "hurricane_id": hurricane_id,
        "total_budget": total_budget,
        "response_window_hours": response_window_hours,
        "allocations": plan_allocations,
        "constraints_used": {},
        "objective_scores": None,
        "explanation": None,
    }


@app.post("/simulation/stage2/ml-ideal-plan")
def create_ml_ideal_plan(request: dict):
    """Stage 2: Generate ML-optimized ideal plan (simplified)."""
    hurricane_id = request.get("hurricane_id")
    total_budget = request.get("total_budget", 50000000)
    response_window_hours = request.get("response_window_hours", 72)

    hurricane_severity = sorted(
        [s for s in severity_data if s["hurricane_id"] == hurricane_id],
        key=lambda x: x["severity_index"] * x["estimated_people_in_need"],
        reverse=True,
    )
    remaining = total_budget
    plan_allocations = []
    for s in hurricane_severity:
        need = s["severity_index"] * s["estimated_people_in_need"] * 500
        budget = min(remaining, need)
        remaining -= budget
        cov = _make_coverage_estimate(s["estimated_people_in_need"], s["severity_index"], budget)
        plan_allocations.append({
            "region": s["admin1"],
            "budget": float(budget),
            "resources": {"shelters": 0, "hospital_beds": 0, "responder_units": 0, "evac_vehicles": 0, "food_days": 0, "power_units": 0},
            "coverage_estimate": cov,
        })

    return {
        "plan_type": "ml_ideal",
        "hurricane_id": hurricane_id,
        "total_budget": total_budget,
        "response_window_hours": response_window_hours,
        "allocations": plan_allocations,
        "constraints_used": {},
        "objective_scores": {"humanity": 0.9, "neutrality": 0.85, "impartiality": 0.9, "equity": 0.85, "sustainability": 0.8},
        "explanation": "Optimized allocation prioritizing highest severity-weighted need regions.",
    }


@app.get("/simulation/stage3/real-world/{hurricane_id}")
def get_real_world_plan(hurricane_id: str):
    """Stage 3: Get real-world historical response (from projects)."""
    projs = [p for p in projects_data if p["hurricane_id"] == hurricane_id]
    by_region = {}
    for p in projs:
        r = p["admin1"]
        by_region[r] = by_region.get(r, 0) + p["budget_usd"]

    hurricane_severity = [s for s in severity_data if s["hurricane_id"] == hurricane_id]
    plan_allocations = []
    for s in hurricane_severity:
        budget = by_region.get(s["admin1"], 0)
        cov = _make_coverage_estimate(s["estimated_people_in_need"], s["severity_index"], budget)
        plan_allocations.append({
            "region": s["admin1"],
            "budget": float(budget),
            "resources": {"shelters": 0, "hospital_beds": 0, "responder_units": 0, "evac_vehicles": 0, "food_days": 0, "power_units": 0},
            "coverage_estimate": cov,
        })

    total_budget = sum(by_region.values()) or 50000000
    return {
        "plan_type": "real_world",
        "hurricane_id": hurricane_id,
        "total_budget": total_budget,
        "response_window_hours": 72,
        "allocations": plan_allocations,
        "constraints_used": {},
        "objective_scores": None,
        "explanation": None,
    }


# Voice personal account — hard-coded scripts + ElevenLabs TTS (called when cinematic starts)
@app.get("/voice-account/{hurricane_id}")
def get_voice_account(hurricane_id: str):
    """
    Return pre-written personal account (script + audio) for this hurricane.
    Uses hard-coded 10-second scripts and ElevenLabs for TTS.
    """
    hurricane = next((h for h in hurricanes_data if h.get("id") == hurricane_id), None)
    if not hurricane:
        raise HTTPException(status_code=404, detail="Hurricane not found")

    from voice_service import generate_voice_account
    result = generate_voice_account(hurricane_id)

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=result,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@app.post("/simulation/mismatch-analysis")
def get_mismatch_analysis(request: dict):
    """Generate mismatch analysis (simplified stub)."""
    ideal = request.get("ideal_plan", {})
    real = request.get("real_plan", {})
    ideal_total = sum(a.get("coverage_estimate", {}).get("people_covered", 0) for a in ideal.get("allocations", []))
    real_total = sum(a.get("coverage_estimate", {}).get("people_covered", 0) for a in real.get("allocations", []))
    diff = ideal_total - real_total if real_total else ideal_total
    return {
        "narrative": f"The ideal plan would have covered {ideal_total:,.0f} people vs real-world {real_total:,.0f}, a gap of {diff:,.0f}.",
        "equity_deviation": 0.15,
        "efficiency_loss": 0.12,
        "overlooked_regions": [],
        "comparison": {"differences": {"coverage_diff": diff / max(1, ideal_total)}},
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
