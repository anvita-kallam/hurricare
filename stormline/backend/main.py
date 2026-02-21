from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import duckdb
import json

from schemas import (
    Hurricane, Project, CoverageResponse, FlaggedProject,
    AllocationRequest, AllocationResponse
)
from data_loader import initialize_database
from analysis import get_coverage, get_flagged_projects, simulate_allocation

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
