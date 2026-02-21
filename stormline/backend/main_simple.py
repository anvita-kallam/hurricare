from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import json
import csv
from pathlib import Path

app = FastAPI(title="StormLine API - Hurricanes Only", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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


@app.get("/")
def root():
    return {"message": "StormLine API - Hurricanes Only", "version": "1.0.0"}


@app.get("/hurricanes")
def get_hurricanes():
    """Get all hurricanes."""
    return hurricanes_data


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
