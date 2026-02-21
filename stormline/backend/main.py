from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import duckdb
import json
from dataclasses import asdict

from schemas import (
    Hurricane, Project, CoverageResponse, FlaggedProject,
    AllocationRequest, AllocationResponse,
    UserPlanRequest, SimulationPlan, PlanComparison, MismatchAnalysis
)
from data_loader import initialize_database
from analysis import get_coverage, get_flagged_projects, simulate_allocation
from simulation_engine import SimulationEngine

app = FastAPI(title="StormLine API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
db = initialize_database()

# Initialize simulation engine
sim_engine = SimulationEngine(db)


@app.get("/")
def root():
    return {"message": "StormLine API", "version": "1.0.0"}


@app.get("/hurricanes", response_model=List[Hurricane])
def get_hurricanes():
    """Get all hurricanes."""
    results = db.execute("SELECT * FROM hurricanes").fetchall()
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


@app.get("/projects", response_model=List[Project])
def get_projects(hurricane_id: Optional[str] = None):
    """Get projects, optionally filtered by hurricane_id."""
    if hurricane_id:
        results = db.execute(
            "SELECT * FROM projects WHERE hurricane_id = ?",
            [hurricane_id]
        ).fetchall()
    else:
        results = db.execute("SELECT * FROM projects").fetchall()
    
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
    coverage_data = get_coverage(db, hurricane_id)
    return coverage_data


@app.get("/flags", response_model=List[FlaggedProject])
def get_flags(hurricane_id: Optional[str] = None):
    """Get flagged projects."""
    flagged = get_flagged_projects(db, hurricane_id)
    return flagged


@app.post("/simulate_allocation", response_model=AllocationResponse)
def simulate_allocation_endpoint(request: AllocationRequest):
    """Simulate allocation impact."""
    result = simulate_allocation(db, request.hurricane_id, request.allocations)
    return result


# Simulation Engine Endpoints
@app.get("/simulation/regions/{hurricane_id}")
def get_affected_regions(hurricane_id: str):
    """Get affected regions for a hurricane."""
    regions = sim_engine.get_affected_regions(hurricane_id)
    return {"regions": regions}


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
        raise HTTPException(status_code=400, detail={"errors": validation["errors"], "warnings": validation["warnings"]})
    
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
