from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import date
import duckdb
import json
from dataclasses import asdict
import threading

# Daily leaderboard: { "YYYY-MM-DD": { "player_name": total_score } }
# Resets automatically each day (new date = new dict)
_leaderboard: dict[str, dict[str, float]] = {}


def _today_key() -> str:
    return date.today().isoformat()


def _get_daily_scores() -> dict[str, float]:
    key = _today_key()
    if key not in _leaderboard:
        _leaderboard[key] = {}
    return _leaderboard[key]


from schemas import (
    Hurricane, Project, CoverageResponse, FlaggedProject,
    AllocationRequest, AllocationResponse,
    UserPlanRequest, SimulationPlan, PlanComparison, MismatchAnalysis
)
from data_loader import initialize_database
from analysis import get_coverage, get_flagged_projects, simulate_allocation
from simulation_engine import SimulationEngine

app = FastAPI(title="HurriCare API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database with thread-safe connection
# DuckDB connections are not thread-safe, so we use a lock
db_lock = threading.Lock()
db = initialize_database()

# Initialize simulation engine
sim_engine = SimulationEngine(db)


@app.get("/")
def root():
    return {"message": "HurriCare API", "version": "1.0.0"}


@app.get("/hurricanes", response_model=List[Hurricane])
def get_hurricanes():
    """Get all hurricanes."""
    global db, sim_engine
    with db_lock:
        try:
            result = db.execute("SELECT * FROM hurricanes ORDER BY year DESC, name ASC")
            results = result.fetchall()
            # Ensure result is fully consumed
            result.close()
        except Exception as e:
            # If connection is stale, reinitialize
            print(f"Database error in get_hurricanes: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            result = db.execute("SELECT * FROM hurricanes ORDER BY year DESC, name ASC")
            results = result.fetchall()
            result.close()
    hurricanes = []
    for row in results:
        hurricanes.append({
            "id": row[0],
            "name": row[1],
            "year": row[2],
            "max_category": row[3],
            "track": json.loads(row[4]),
            "affected_countries": json.loads(row[5]),
            "estimated_population_affected": row[6]
        })
    return hurricanes


@app.get("/hurricanes/match")
def find_matching_hurricane(region: str, category: int, direction: Optional[str] = None):
    """Find the hurricane that most closely matches the given region, category, and optional direction."""
    global db, sim_engine
    with db_lock:
        try:
            result = db.execute("SELECT * FROM hurricanes")
            results = result.fetchall()
            result.close()
        except Exception as e:
            print(f"Database error in find_matching_hurricane: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            result = db.execute("SELECT * FROM hurricanes")
            results = result.fetchall()
            result.close()
    
    hurricanes = []
    for row in results:
        hurricanes.append({
            "id": row[0],
            "name": row[1],
            "year": row[2],
            "max_category": row[3],
            "track": json.loads(row[4]),
            "affected_countries": json.loads(row[5]),
            "estimated_population_affected": row[6]
        })
    
    # Normalize region input (case-insensitive, partial matching)
    region_lower = region.lower().strip()
    
    # Score each hurricane
    scored_hurricanes = []
    for h in hurricanes:
        score = 0
        
        # Category match (exact match = 100 points, within 1 = 50 points, within 2 = 25 points)
        category_diff = abs(h["max_category"] - category)
        if category_diff == 0:
            score += 100
        elif category_diff == 1:
            score += 50
        elif category_diff == 2:
            score += 25
        
        # Region match (check if region appears in affected countries)
        # Exact match = 100 points, partial match = 50 points
        countries_lower = [c.lower() for c in h["affected_countries"]]
        region_found = False
        
        # Check for exact country name match
        for country in countries_lower:
            if region_lower == country:
                score += 100
                region_found = True
                break
            # Check for partial match (region name contains country or vice versa)
            if region_lower in country or country in region_lower:
                score += 50
                region_found = True
                break
        
        # Also check common region aliases
        region_aliases = {
            "us": ["united states", "usa"],
            "usa": ["united states", "us"],
            "united states": ["us", "usa"],
            "caribbean": ["jamaica", "bahamas", "cuba", "haiti", "dominican republic", "puerto rico", "barbados", "grenada"],
            "gulf coast": ["united states", "mexico"],
            "east coast": ["united states"],
            "southeast": ["united states"],
            "philippines": ["philippines"],
            "china": ["china", "hong kong", "taiwan"],
            "japan": ["japan"],
            "india": ["india", "bangladesh", "sri lanka"],
        }
        
        if not region_found:
            for alias, countries in region_aliases.items():
                if region_lower == alias.lower():
                    for country in countries_lower:
                        if country in countries:
                            score += 75
                            region_found = True
                            break
                    if region_found:
                        break
        
        # Direction match (if provided)
        direction_match = False
        if direction:
            direction_lower = direction.lower().strip()
            track = h.get("track", [])
            if len(track) >= 2:
                # Calculate overall direction from first to last significant point
                # Use first 20% and last 20% of track to determine general direction
                start_idx = max(0, len(track) // 5)
                end_idx = min(len(track) - 1, len(track) - len(track) // 5)
                
                if end_idx > start_idx:
                    start_point = track[start_idx]
                    end_point = track[end_idx]
                    
                    # Calculate lat/lon differences
                    lat_diff = end_point["lat"] - start_point["lat"]
                    lon_diff = end_point["lon"] - start_point["lon"]
                    
                    # Determine primary direction
                    # North = positive lat, South = negative lat
                    # East = positive lon (in Western Hemisphere, negative lon means west)
                    # For Western Hemisphere: East = less negative/more positive lon, West = more negative lon
                    abs_lat = abs(lat_diff)
                    abs_lon = abs(lon_diff)
                    
                    hurricane_direction = None
                    if abs_lat > abs_lon:
                        # Primarily north-south movement
                        if lat_diff > 0:
                            hurricane_direction = "north"
                        else:
                            hurricane_direction = "south"
                    else:
                        # Primarily east-west movement
                        # In Western Hemisphere, lon is negative, so more negative = west, less negative = east
                        if lon_diff > 0:
                            hurricane_direction = "east"
                        else:
                            hurricane_direction = "west"
                    
                    # Match direction
                    if hurricane_direction and direction_lower == hurricane_direction:
                        score += 50
                        direction_match = True
                    # Also check for opposite direction (some hurricanes curve)
                    elif hurricane_direction:
                        opposite_map = {"north": "south", "south": "north", "east": "west", "west": "east"}
                        if direction_lower == opposite_map.get(hurricane_direction):
                            score += 25  # Partial match for opposite direction
        
        # Prefer more recent hurricanes (add small bonus for recent years)
        year_bonus = max(0, (h["year"] - 2000) * 0.5)
        score += year_bonus
        
        scored_hurricanes.append({
            "hurricane": h,
            "score": score,
            "category_match": category_diff == 0,
            "region_match": region_found,
            "direction_match": direction_match
        })
    
    # Sort by score (highest first)
    scored_hurricanes.sort(key=lambda x: x["score"], reverse=True)
    
    if not scored_hurricanes:
        return {"error": "No hurricanes found"}
    
    best_match = scored_hurricanes[0]
    
    return {
        "match": best_match["hurricane"],
        "score": best_match["score"],
        "category_match": best_match["category_match"],
        "region_match": best_match["region_match"],
        "alternatives": [s["hurricane"] for s in scored_hurricanes[1:4]]  # Top 3 alternatives
    }


@app.get("/projects", response_model=List[Project])
def get_projects(hurricane_id: Optional[str] = None):
    """Get projects, optionally filtered by hurricane_id."""
    global db, sim_engine
    with db_lock:
        try:
            if hurricane_id:
                result = db.execute(
                    "SELECT * FROM projects WHERE hurricane_id = ?",
                    [hurricane_id]
                )
            else:
                result = db.execute("SELECT * FROM projects")
            results = result.fetchall()
            result.close()
        except Exception as e:
            print(f"Database error in get_projects: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            if hurricane_id:
                result = db.execute(
                    "SELECT * FROM projects WHERE hurricane_id = ?",
                    [hurricane_id]
                )
            else:
                result = db.execute("SELECT * FROM projects")
            results = result.fetchall()
            result.close()
    
    projects = []
    for row in results:
        projects.append({
            "project_id": row[0],
            "hurricane_id": row[1],
            "country": row[2],
            "admin1": row[3],
            "cluster": row[4],
            "budget_usd": row[5],
            "beneficiaries": row[6],
            "pooled_fund": row[7],
            "implementing_partner": row[8]
        })
    return projects


@app.get("/coverage", response_model=List[CoverageResponse])
def get_coverage_endpoint(hurricane_id: Optional[str] = None):
    """Get coverage analysis."""
    global db, sim_engine
    with db_lock:
        try:
            coverage_data = get_coverage(db, hurricane_id)
        except Exception as e:
            print(f"Database error in get_coverage_endpoint: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            coverage_data = get_coverage(db, hurricane_id)
    return coverage_data


@app.get("/flags", response_model=List[FlaggedProject])
def get_flags(hurricane_id: Optional[str] = None):
    """Get flagged projects."""
    global db, sim_engine
    with db_lock:
        try:
            flagged = get_flagged_projects(db, hurricane_id)
        except Exception as e:
            print(f"Database error in get_flags: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            flagged = get_flagged_projects(db, hurricane_id)
    return flagged


@app.post("/simulate_allocation", response_model=AllocationResponse)
def simulate_allocation_endpoint(request: AllocationRequest):
    """Simulate allocation impact."""
    global db, sim_engine
    with db_lock:
        try:
            result = simulate_allocation(db, request.hurricane_id, request.allocations)
        except Exception as e:
            print(f"Database error in simulate_allocation_endpoint: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            result = simulate_allocation(db, request.hurricane_id, request.allocations)
    return result


# Simulation Engine Endpoints
@app.get("/simulation/regions/{hurricane_id}")
def get_affected_regions(hurricane_id: str):
    """Get affected regions for a hurricane."""
    regions = sim_engine.get_affected_regions(hurricane_id)
    return {"regions": regions}


@app.get("/simulation/total-budget/{hurricane_id}")
def get_total_budget(hurricane_id: str):
    """Get total pooled fund budget for a hurricane."""
    global db, sim_engine
    query = """
        SELECT SUM(CASE WHEN pooled_fund = true THEN budget_usd ELSE 0 END) as total_budget
        FROM projects
        WHERE hurricane_id = ?
    """
    with db_lock:
        try:
            result = db.execute(query, [hurricane_id]).fetchone()
        except Exception as e:
            print(f"Database error in get_total_budget: {e}, reinitializing...")
            db = initialize_database()
            sim_engine = SimulationEngine(db)
            result = db.execute(query, [hurricane_id]).fetchone()
    total_budget = result[0] if result and result[0] else 0
    return {"total_budget": float(total_budget)}


@app.post("/simulation/stage1/user-plan", response_model=SimulationPlan)
def create_user_plan(request: UserPlanRequest):
    """Stage 1: Create user-designed response plan."""
    # Validate plan
    validation = sim_engine.validate_user_plan(
        request.hurricane_id,
        request.allocations,
        request.total_budget,
        request.response_window_hours
    )
    
    if not validation["valid"]:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Validation failed",
                "errors": validation["errors"],
                "warnings": validation["warnings"]
            }
        )
    
    # Create plan
    plan = sim_engine.stage_one_user_plan(
        request.hurricane_id,
        request.allocations,
        request.total_budget,
        request.response_window_hours,
        request.resources
    )
    
    # Convert to dict for JSON serialization
    return _plan_to_dict(plan)


@app.post("/simulation/stage2/ml-ideal-plan", response_model=SimulationPlan)
def create_ml_ideal_plan(request: UserPlanRequest):
    """Stage 2: Generate ML-optimized ideal plan."""
    plan = sim_engine.stage_two_ml_ideal_plan(
        request.hurricane_id,
        request.total_budget,
        request.response_window_hours
    )
    return _plan_to_dict(plan)


@app.get("/simulation/stage3/real-world/{hurricane_id}", response_model=SimulationPlan)
def get_real_world_plan(hurricane_id: str):
    """Stage 3: Get real-world historical response."""
    plan = sim_engine.stage_three_real_world(hurricane_id)
    return _plan_to_dict(plan)


@app.post("/simulation/compare")
def compare_plans(plan1: dict, plan2: dict):
    """Compare two simulation plans."""
    plan1_obj = _dict_to_plan(plan1)
    plan2_obj = _dict_to_plan(plan2)
    comparison = sim_engine.compare_plans(plan1_obj, plan2_obj)
    return comparison


@app.post("/simulation/mismatch-analysis", response_model=MismatchAnalysis)
def get_mismatch_analysis(ideal_plan: dict, real_plan: dict):
    """Generate mismatch analysis between ideal and real-world plans."""
    ideal_obj = _dict_to_plan(ideal_plan)
    real_obj = _dict_to_plan(real_plan)
    analysis = sim_engine.generate_mismatch_analysis(ideal_obj, real_obj)
    return analysis


def _plan_to_dict(plan) -> dict:
    """Convert SimulationPlan to dict for JSON serialization."""
    return {
        "plan_type": plan.plan_type,
        "hurricane_id": plan.hurricane_id,
        "total_budget": plan.total_budget,
        "response_window_hours": plan.response_window_hours,
        "allocations": [
            {
                "region": a.region,
                "budget": a.budget,
                "resources": asdict(a.resources),
                "coverage_estimate": a.coverage_estimate  # Already a dict
            }
            for a in plan.allocations
        ],
        "constraints_used": plan.constraints_used,
        "objective_scores": plan.objective_scores,
        "explanation": plan.explanation
    }


def _dict_to_plan(data: dict):
    """Convert dict to SimulationPlan object."""
    from simulation_engine import SimulationPlan, RegionAllocation, NativeResources
    
    allocations = [
        RegionAllocation(
            region=a["region"],
            budget=a["budget"],
            resources=NativeResources(**a["resources"]),
            coverage_estimate=a["coverage_estimate"]
        )
        for a in data["allocations"]
    ]
    
    return SimulationPlan(
        plan_type=data["plan_type"],
        hurricane_id=data["hurricane_id"],
        total_budget=data["total_budget"],
        response_window_hours=data["response_window_hours"],
        allocations=allocations,
        constraints_used=data["constraints_used"],
        objective_scores=data.get("objective_scores"),
        explanation=data.get("explanation")
    )


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
