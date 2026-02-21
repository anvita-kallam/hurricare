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
