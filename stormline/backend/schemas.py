from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TrackPoint(BaseModel):
    lat: float
    lon: float
    wind: int


class Hurricane(BaseModel):
    id: str
    name: str
    year: int
    max_category: int
    track: List[TrackPoint]
    affected_countries: List[str]
    estimated_population_affected: int


class Project(BaseModel):
    project_id: str
    hurricane_id: str
    country: str
    admin1: str
    cluster: str
    budget_usd: float
    beneficiaries: int
    pooled_fund: bool
    implementing_partner: str


class Severity(BaseModel):
    hurricane_id: str
    admin1: str
    severity_index: float
    estimated_people_in_need: int


class CoverageResponse(BaseModel):
    hurricane_id: str
    admin1: str
    pooled_fund_budget: float
    estimated_need_budget: float
    coverage_ratio: float
    severity_index: float
    people_in_need: int


class FlaggedProject(BaseModel):
    project_id: str
    hurricane_id: str
    country: str
    admin1: str
    cluster: str
    budget_usd: float
    beneficiaries: int
    budget_per_beneficiary: float
    flag_type: str  # "high_outlier" or "low_outlier"
    explanation: str
    z_score: float


class AllocationRequest(BaseModel):
    hurricane_id: str
    allocations: dict  # {admin1: budget_amount}


class AllocationResponse(BaseModel):
    impact_score: float
    lives_covered: int
    vulnerability_reduction: float
    unmet_need: float
    comparison: dict  # comparison to real allocation


# Simulation Engine Schemas
class NativeResources(BaseModel):
    shelters: int = 0
    hospital_beds: int = 0
    responder_units: int = 0
    evac_vehicles: int = 0
    food_days: int = 0
    power_units: int = 0


class CoverageEstimate(BaseModel):
    people_covered: int
    coverage_ratio: float
    unmet_need: int
    severity_weighted_impact: float


class RegionAllocation(BaseModel):
    region: str
    budget: float
    resources: NativeResources
    coverage_estimate: CoverageEstimate


class SimulationPlan(BaseModel):
    plan_type: str  # "user", "ml_ideal", "real_world"
    hurricane_id: str
    total_budget: float
    response_window_hours: int
    allocations: List[RegionAllocation]
    constraints_used: dict
    objective_scores: Optional[dict] = None
    explanation: Optional[str] = None


class UserPlanRequest(BaseModel):
    hurricane_id: str
    allocations: dict  # {admin1: budget_amount}
    total_budget: float
    response_window_hours: int = 72
    resources: Optional[dict] = None  # {admin1: {shelters: int, ...}}


class PlanComparison(BaseModel):
    plan1_metrics: dict
    plan2_metrics: dict
    differences: dict
    region_comparisons: List[dict]


class MismatchAnalysis(BaseModel):
    comparison: PlanComparison
    overlooked_regions: List[dict]
    narrative: str
    equity_deviation: float
    efficiency_loss: float
