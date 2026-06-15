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
from hurricane_search import (
    build_user_search_query,
    is_vector_search_configured,
    search_hurricanes_by_user_query,
)

try:
    from dotenv import load_dotenv
    from pathlib import Path as _Path
    _env_path = _Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass

import os

def _cors_origins() -> list[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    extra = os.getenv("CORS_ORIGINS", "")
    if extra:
        defaults.extend(origin.strip() for origin in extra.split(",") if origin.strip())
    return defaults

app = FastAPI(title="HurriCare API", version="1.0.0")

# CORS middleware — include localhost and any production origins from CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
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


def _load_all_hurricanes() -> List[dict]:
    """Load hurricane records from the database."""
    global db, sim_engine
    with db_lock:
        try:
            result = db.execute("SELECT * FROM hurricanes")
            results = result.fetchall()
            result.close()
        except Exception as e:
            print(f"Database error loading hurricanes: {e}, reinitializing...")
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
            "estimated_population_affected": row[6],
        })
    return hurricanes


def _score_hurricanes_by_rules(
    hurricanes: List[dict],
    region: str,
    category: int,
    direction: Optional[str] = None,
) -> List[dict]:
    """Rule-based hurricane scoring (fallback when Vector Search is unavailable)."""
    region_lower = region.lower().strip()
    scored_hurricanes = []

    for h in hurricanes:
        score = 0
        category_diff = abs(h["max_category"] - category)
        if category_diff == 0:
            score += 100
        elif category_diff == 1:
            score += 50
        elif category_diff == 2:
            score += 25

        countries_lower = [c.lower() for c in h["affected_countries"]]
        region_found = False

        for country in countries_lower:
            if region_lower == country:
                score += 100
                region_found = True
                break
            if region_lower in country or country in region_lower:
                score += 50
                region_found = True
                break

        region_aliases = {
            "us": ["united states", "usa"],
            "usa": ["united states", "us"],
            "united states": ["us", "usa"],
            "caribbean": [
                "jamaica", "bahamas", "cuba", "haiti", "dominican republic",
                "puerto rico", "barbados", "grenada",
            ],
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
                    lat_diff = end_point["lat"] - start_point["lat"]
                    lon_diff = end_point["lon"] - start_point["lon"]
                    abs_lat = abs(lat_diff)
                    abs_lon = abs(lon_diff)

                    hurricane_direction = None
                    if abs_lat > abs_lon:
                        hurricane_direction = "north" if lat_diff > 0 else "south"
                    else:
                        hurricane_direction = "east" if lon_diff > 0 else "west"

                    if hurricane_direction and direction_lower == hurricane_direction:
                        score += 50
                        direction_match = True
                    elif hurricane_direction:
                        opposite_map = {
                            "north": "south", "south": "north",
                            "east": "west", "west": "east",
                        }
                        if direction_lower == opposite_map.get(hurricane_direction):
                            score += 25

        score += max(0, (h["year"] - 2000) * 0.5)

        scored_hurricanes.append({
            "hurricane": h,
            "score": score,
            "category_match": category_diff == 0,
            "region_match": region_found,
            "direction_match": direction_match,
        })

    scored_hurricanes.sort(key=lambda x: x["score"], reverse=True)
    return scored_hurricanes


def _match_response_from_scored(
    scored: List[dict],
    *,
    search_method: str,
    query_used: Optional[str] = None,
) -> dict:
    if not scored:
        return {"error": "No hurricanes found"}
    best = scored[0]
    payload = {
        "match": best["hurricane"],
        "score": best["score"],
        "category_match": best["category_match"],
        "region_match": best["region_match"],
        "direction_match": best.get("direction_match", False),
        "alternatives": [s["hurricane"] for s in scored[1:4]],
        "search_method": search_method,
    }
    if query_used:
        payload["query_used"] = query_used
    return payload


@app.get("/hurricanes/match")
def find_matching_hurricane(
    region: str,
    category: int,
    direction: Optional[str] = None,
    query: Optional[str] = None,
    extra_details: Optional[str] = None,
):
    """
    Find the hurricane most similar to user input.

    Uses Databricks Vector Search when configured; otherwise rule-based scoring.
    """
    hurricanes = _load_all_hurricanes()
    if not hurricanes:
        return {"error": "No hurricanes found"}

    by_id = {h["id"]: h for h in hurricanes}
    free_text = (query or extra_details or "").strip()
    search_text = build_user_search_query(region, category, direction, free_text or None)

    # --- Databricks Vector Search (semantic match from user input) ---
    if is_vector_search_configured():
        try:
            vector_hits = search_hurricanes_by_user_query(search_text, num_results=10)
            if vector_hits:
                rule_scores = {
                    s["hurricane"]["id"]: s
                    for s in _score_hurricanes_by_rules(hurricanes, region, category, direction)
                }
                scored = []
                for hid, vec_score, _raw in vector_hits:
                    h = by_id.get(hid)
                    if not h:
                        continue
                    rules = rule_scores.get(hid, {})
                    # Blend semantic similarity with structured rule signals
                    combined = (vec_score * 100.0) + (rules.get("score", 0) * 0.25)
                    scored.append({
                        "hurricane": h,
                        "score": combined,
                        "category_match": rules.get("category_match", False),
                        "region_match": rules.get("region_match", False),
                        "direction_match": rules.get("direction_match", False),
                    })
                if scored:
                    scored.sort(key=lambda x: x["score"], reverse=True)
                    return _match_response_from_scored(
                        scored,
                        search_method="databricks_vector_search",
                        query_used=search_text,
                    )
        except Exception as e:
            print(f"Vector search failed, using rule-based match: {e}")

    # --- Rule-based fallback ---
    scored = _score_hurricanes_by_rules(hurricanes, region, category, direction)
    return _match_response_from_scored(
        scored,
        search_method="rules",
        query_used=search_text,
    )


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


@app.post("/simulation/generate-insights")
def generate_gemini_insights(request: dict):
    """Generate AI-powered insights using Google Gemini for UN representatives."""
    try:
        import google.generativeai as genai
        
        api_key = request.get("api_key")
        if not api_key:
            return {"error": "API key is required"}
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')
        
        # Extract data from request
        hurricane_name = request.get("hurricane_name", "Unknown")
        hurricane_year = request.get("hurricane_year", "Unknown")
        ml_plan = request.get("ml_plan", {})
        real_plan = request.get("real_plan", {})
        user_plan = request.get("user_plan")
        mismatch_analysis = request.get("mismatch_analysis", {})
        
        # Prepare data summary for Gemini
        ideal_budget = ml_plan.get("total_budget", 0)
        real_budget = real_plan.get("total_budget", 0)
        budget_gap = ideal_budget - real_budget
        
        ideal_people = sum(
            a.get("coverage_estimate", {}).get("people_covered", 0) 
            for a in ml_plan.get("allocations", [])
        )
        real_people = sum(
            a.get("coverage_estimate", {}).get("people_covered", 0) 
            for a in real_plan.get("allocations", [])
        )
        people_gap = ideal_people - real_people
        
        # Build regional comparison
        regional_data = []
        for real_alloc in real_plan.get("allocations", []):
            region = real_alloc.get("region", "Unknown")
            ideal_alloc = next(
                (a for a in ml_plan.get("allocations", []) if a.get("region") == region),
                None
            )
            if ideal_alloc:
                regional_data.append({
                    "region": region,
                    "ideal_budget": ideal_alloc.get("budget", 0),
                    "real_budget": real_alloc.get("budget", 0),
                    "ideal_coverage": ideal_alloc.get("coverage_estimate", {}).get("coverage_ratio", 0) * 100,
                    "real_coverage": real_alloc.get("coverage_estimate", {}).get("coverage_ratio", 0) * 100,
                })
        
        # Build prompt for Gemini
        prompt = f"""You are an expert humanitarian analyst providing insights to a UN representative about crisis intervention strategies. Analyze the following data about {hurricane_name} ({hurricane_year}) and provide comprehensive, actionable insights.

CRISIS CONTEXT:
- Hurricane: {hurricane_name} ({hurricane_year})
- Ideal Plan Budget: ${ideal_budget:,.0f}
- Real-World Budget: ${real_budget:,.0f}
- Budget Gap: ${budget_gap:,.0f} ({((budget_gap/real_budget)*100) if real_budget > 0 else 0:.1f}%)
- Ideal People Covered: {ideal_people:,.0f}
- Real People Covered: {real_people:,.0f}
- People Coverage Gap: {people_gap:,.0f}

REGIONAL ALLOCATION COMPARISON:
{chr(10).join([f"- {r['region']}: Ideal ${r['ideal_budget']:,.0f} ({r['ideal_coverage']:.1f}% coverage) vs Real ${r['real_budget']:,.0f} ({r['real_coverage']:.1f}% coverage)" for r in regional_data[:10]])}

UNDERFUNDED REGIONS:
{chr(10).join([f"- {r.get('region', 'Unknown')}: Gap of ${r.get('ideal_budget', 0) - r.get('actual_budget', 0):,.0f}" for r in mismatch_analysis.get('overlooked_regions', [])[:5]])}

Please provide:
1. A comprehensive executive summary explaining the key differences between ideal and real-world responses
2. Analysis of the most critical funding gaps and their human impact
3. Specific recommendations for UN representatives on:
   - Advocacy and resource mobilization strategies
   - Coordination mechanisms that need strengthening
   - Operational preparedness improvements
   - Policy reforms that could address systemic issues
4. Actionable next steps for future crisis intervention

Write in a professional, diplomatic tone suitable for UN briefings. Focus on learning opportunities and evidence-based recommendations rather than criticism. Be specific about numbers and regions where relevant. Keep the total response to approximately 800-1200 words, structured with clear sections."""

        # Generate insights
        response = model.generate_content(prompt)
        insights_text = response.text
        
        return {
            "insights": insights_text,
            "generated_at": date.today().isoformat()
        }
        
    except ImportError:
        return {"error": "google-generativeai package not installed. Run: pip install google-generativeai"}
    except Exception as e:
        return {"error": f"Error generating insights: {str(e)}"}


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
