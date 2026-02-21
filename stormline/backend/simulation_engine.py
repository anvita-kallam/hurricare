"""
Simulation Engine for HurriCare
Implements three-stage simulation: User Plan, ML Ideal Plan, Real-World Response
"""
import duckdb
import json
from typing import Dict, List, Optional
import numpy as np
from scipy.optimize import linprog
from dataclasses import dataclass, asdict


@dataclass
class NativeResources:
    """Native resources available in a region."""
    shelters: int = 0
    hospital_beds: int = 0
    responder_units: int = 0
    evac_vehicles: int = 0
    food_days: int = 0
    power_units: int = 0


@dataclass
class RegionAllocation:
    """Allocation for a single region."""
    region: str
    budget: float
    resources: NativeResources
    coverage_estimate: Dict


@dataclass
class SimulationPlan:
    """Complete simulation plan."""
    plan_type: str  # "user", "ml_ideal", "real_world"
    hurricane_id: str
    total_budget: float
    response_window_hours: int
    allocations: List[RegionAllocation]
    constraints_used: Dict
    objective_scores: Optional[Dict] = None
    explanation: Optional[str] = None


class SimulationEngine:
    """Main simulation engine for three-stage analysis."""
    
    def __init__(self, db: duckdb.DuckDBPyConnection):
        self.db = db
        
        # UN Values weights (tunable)
        self.un_weights = {
            "humanity": 0.35,      # Maximize lives saved
            "neutrality": 0.15,    # No geographic favoritism
            "impartiality": 0.25,  # Prioritize severity & vulnerability
            "equity": 0.20,        # Protect marginalized populations
            "sustainability": 0.05   # Avoid short-term fixes
        }
        
        # Cost parameters
        self.cost_per_person = 500  # USD per person covered
        self.shelter_cost_per_capacity = 1000
        self.hospital_bed_cost = 5000
        self.responder_unit_cost = 2000
        self.evac_vehicle_cost = 30000
    
    def get_affected_regions(self, hurricane_id: str) -> List[Dict]:
        """Get all affected regions for a hurricane."""
        query = """
            SELECT admin1, severity_index, estimated_people_in_need
            FROM severity
            WHERE hurricane_id = ?
            ORDER BY severity_index DESC
        """
        results = self.db.execute(query, [hurricane_id]).fetchall()
        return [
            {
                "admin1": row[0],
                "severity_index": row[1],
                "people_in_need": row[2]
            }
            for row in results
        ]
    
    def get_native_resources(self, hurricane_id: str, region: str) -> NativeResources:
        """Get native resources available in a region (synthetic for MVP)."""
        # In a real system, this would come from infrastructure databases
        # For MVP, generate based on region size and development level
        query = """
            SELECT estimated_people_in_need, severity_index
            FROM severity
            WHERE hurricane_id = ? AND admin1 = ?
        """
        result = self.db.execute(query, [hurricane_id, region]).fetchone()
        
        if not result:
            return NativeResources()
        
        people_in_need, severity = result[1], result[0]
        
        # Synthetic resource generation
        # More developed regions have more resources
        base_capacity = people_in_need * 0.1
        
        return NativeResources(
            shelters=int(base_capacity * 0.05),
            hospital_beds=int(base_capacity * 0.02),
            responder_units=int(base_capacity * 0.15),
            evac_vehicles=int(base_capacity * 0.01),
            food_days=3,
            power_units=int(base_capacity * 0.03)
        )
    
    def validate_user_plan(
        self,
        hurricane_id: str,
        allocations: Dict[str, float],
        total_budget: float,
        response_window_hours: int
    ) -> Dict:
        """Validate user plan against constraints."""
        errors = []
        warnings = []
        
        # Check budget
        allocated_total = sum(allocations.values())
        if allocated_total > total_budget:
            errors.append(f"Budget exceeded: ${allocated_total:,.0f} > ${total_budget:,.0f}")
        elif allocated_total < total_budget * 0.8:
            warnings.append(f"Only {allocated_total/total_budget*100:.1f}% of budget allocated")
        
        # Check regions exist
        regions = self.get_affected_regions(hurricane_id)
        region_names = {r["admin1"] for r in regions}
        
        for region in allocations.keys():
            if region not in region_names:
                errors.append(f"Unknown region: {region}")
        
        # Check logistics constraints
        if response_window_hours < 24:
            warnings.append("Very short response window may limit effectiveness")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def stage_one_user_plan(
        self,
        hurricane_id: str,
        allocations: Dict[str, float],
        total_budget: float,
        response_window_hours: int = 72,
        resources: Optional[Dict[str, Dict]] = None
    ) -> SimulationPlan:
        """Stage 1: User-designed response plan."""
        regions = self.get_affected_regions(hurricane_id)
        
        region_allocations = []
        for region_data in regions:
            region = region_data["admin1"]
            budget = allocations.get(region, 0.0)
            
            # Get or generate native resources
            if resources and region in resources:
                native_res = NativeResources(**resources[region])
            else:
                native_res = self.get_native_resources(hurricane_id, region)
            
            # Calculate coverage estimate
            people_in_need = region_data["people_in_need"]
            severity = region_data["severity_index"]
            
            # Coverage = (budget / cost_per_person) + native capacity
            native_capacity = (
                native_res.shelters * 50 +
                native_res.hospital_beds * 1 +
                native_res.responder_units * 10
            )
            budget_coverage = budget / self.cost_per_person
            total_coverage = min(budget_coverage + native_capacity, people_in_need)
            coverage_ratio = total_coverage / people_in_need if people_in_need > 0 else 0
            
            coverage_estimate = {
                "people_covered": int(total_coverage),
                "coverage_ratio": coverage_ratio,
                "unmet_need": int(max(0, people_in_need - total_coverage)),
                "severity_weighted_impact": total_coverage * severity
            }
            
            region_allocations.append(RegionAllocation(
                region=region,
                budget=budget,
                resources=native_res,
                coverage_estimate=coverage_estimate
            ))
        
        constraints = {
            "total_budget": total_budget,
            "response_window_hours": response_window_hours,
            "logistics_speed": "standard",
            "accessibility": "mixed"
        }
        
        return SimulationPlan(
            plan_type="user",
            hurricane_id=hurricane_id,
            total_budget=total_budget,
            response_window_hours=response_window_hours,
            allocations=region_allocations,
            constraints_used=constraints
        )
    
    def get_ideal_plan_text(self, hurricane_id: str) -> Optional[str]:
        """Get ideal plan text from CSV data."""
        query = """
            SELECT ideal_plan_text
            FROM ideal_plans
            WHERE id = ?
        """
        result = self.db.execute(query, [hurricane_id]).fetchone()
        return result[0] if result else None
    
    def parse_ideal_plan_allocations(self, ideal_plan_text: str) -> Dict[str, Dict[str, float]]:
        """
        Parse ideal plan text to extract cluster-level allocations.
        Returns: {cluster: {'budget': float, 'people': int}}
        """
        if not ideal_plan_text:
            return {}
        
        allocations = {}
        lines = ideal_plan_text.split('\n')
        
        for line in lines:
            line = line.strip()
            # Look for lines like "- Education: Support 450,361 people with a budget of $13,774,515."
            if line.startswith('-') and 'Support' in line and 'people' in line and 'budget' in line:
                try:
                    # Extract cluster name (before colon)
                    if ':' in line:
                        cluster_part = line.split(':')[0].replace('-', '').strip()
                        
                        # Extract people number
                        people_match = None
                        if 'Support' in line:
                            support_part = line.split('Support')[1].split('people')[0].strip()
                            # Remove commas and convert
                            people_str = support_part.replace(',', '').replace('.', '')
                            try:
                                people_match = int(people_str)
                            except:
                                pass
                        
                        # Extract budget (after $)
                        budget_match = None
                        if '$' in line:
                            budget_part = line.split('$')[1].split('.')[0].strip()
                            # Remove commas and convert
                            budget_str = budget_part.replace(',', '').replace('.', '')
                            try:
                                budget_match = float(budget_str)
                            except:
                                pass
                        
                        if cluster_part and people_match is not None and budget_match is not None:
                            allocations[cluster_part] = {
                                'budget': budget_match,
                                'people': people_match
                            }
                except Exception as e:
                    # Skip lines that don't match the pattern
                    continue
        
        return allocations
    
    def stage_two_ml_ideal_plan(
        self,
        hurricane_id: str,
        total_budget: float,
        response_window_hours: int = 72
    ) -> SimulationPlan:
        """Stage 2: ML-generated ideal plan (UN-values-optimized)."""
        # Get ideal plan text from CSV
        ideal_plan_text = self.get_ideal_plan_text(hurricane_id)
        
        regions = self.get_affected_regions(hurricane_id)
        
        if not regions:
            raise ValueError(f"No regions found for hurricane {hurricane_id}")
        
        n_regions = len(regions)
        
        # If we have CSV cluster allocations, distribute them across regions
        # Otherwise, fall back to optimization
        if cluster_allocations:
            # Calculate total budget and people from CSV
            csv_total_budget = sum(alloc['budget'] for alloc in cluster_allocations.values())
            csv_total_people = sum(alloc['people'] for alloc in cluster_allocations.values())
            
            # Distribute cluster budgets across regions based on severity and need
            people_in_need = np.array([r["people_in_need"] for r in regions])
            severity = np.array([r["severity_index"] for r in regions])
            
            # Weight each region by severity * people_in_need
            region_weights = severity * people_in_need
            if region_weights.sum() > 0:
                region_weights = region_weights / region_weights.sum()
            else:
                region_weights = np.ones(n_regions) / n_regions
            
            # Distribute total budget proportionally
            region_budgets = region_weights * csv_total_budget
            region_people = (region_weights * csv_total_people).astype(int)
        else:
            # Fallback to optimization if no CSV data
            people_in_need = np.array([r["people_in_need"] for r in regions])
            severity = np.array([r["severity_index"] for r in regions])
            
            # Ensure minimum allocation per region
            min_allocation_per_region = max(total_budget * 0.01 / n_regions, 10000)
            total_min_allocation = min_allocation_per_region * n_regions
            
            if total_min_allocation > total_budget:
                min_allocation_per_region = total_budget / n_regions
                total_min_allocation = total_budget
            
            remaining_budget = total_budget - total_min_allocation
            
            # Simple proportional allocation
            weights = severity * people_in_need
            if weights.sum() > 0:
                weights = weights / weights.sum()
            else:
                weights = np.ones(n_regions) / n_regions
            
            region_budgets = min_allocation_per_region + (weights * remaining_budget)
            region_people = (region_budgets / self.cost_per_person).astype(int)
        
        # Build plan
        region_allocations = []
        total_lives_saved = 0
        total_equity_score = 0
        total_efficiency = 0
        
        for i, region_data in enumerate(regions):
            region = region_data["admin1"]
            budget = float(region_budgets[i])
            
            # Final safety check: ensure budget is at least $1
            budget = max(budget, 1.0)
            
            native_res = self.get_native_resources(hurricane_id, region)
            people_in_need = region_data["people_in_need"]
            severity = region_data["severity_index"]
            
            # Use CSV people count if available, otherwise calculate
            if cluster_allocations and i < len(region_people):
                people_covered = min(int(region_people[i]), people_in_need)
            else:
                native_capacity = (
                    native_res.shelters * 50 +
                    native_res.hospital_beds * 1 +
                    native_res.responder_units * 10
                )
                budget_coverage = budget / self.cost_per_person
                people_covered = min(int(budget_coverage + native_capacity), people_in_need)
            
            coverage_ratio = people_covered / people_in_need if people_in_need > 0 else 0
            
            total_lives_saved += people_covered
            total_efficiency += budget / people_covered if people_covered > 0 else 0
            
            coverage_estimate = {
                "people_covered": int(total_coverage),
                "coverage_ratio": coverage_ratio,
                "unmet_need": int(max(0, people_in_need - total_coverage)),
                "severity_weighted_impact": total_coverage * severity
            }
            
            region_allocations.append(RegionAllocation(
                region=region,
                budget=budget,
                resources=native_res,
                coverage_estimate=coverage_estimate
            ))
        
        # Calculate objective scores
        objective_scores = {
            "humanity": min(1.0, total_lives_saved / sum(r["people_in_need"] for r in regions)),
            "equity": min(1.0, total_equity_score / n_regions),
            "efficiency": 1.0 / (total_efficiency / n_regions / self.cost_per_person) if total_efficiency > 0 else 0,
            "impartiality": sum(
                a.coverage_estimate["severity_weighted_impact"] 
                for a in region_allocations
            ) / sum(r["people_in_need"] * r["severity_index"] for r in regions) if regions else 0
        }
        
        # Don't include explanation text - use data-driven allocations only
        explanation = None
        
        constraints = {
            "total_budget": total_budget,
            "response_window_hours": response_window_hours,
            "optimization_method": "linear_programming",
            "un_weights": self.un_weights
        }
        
        return SimulationPlan(
            plan_type="ml_ideal",
            hurricane_id=hurricane_id,
            total_budget=total_budget,
            response_window_hours=response_window_hours,
            allocations=region_allocations,
            constraints_used=constraints,
            objective_scores=objective_scores,
            explanation=explanation
        )
    
    def stage_three_real_world(
        self,
        hurricane_id: str
    ) -> SimulationPlan:
        """Stage 3: Real-world historical response."""
        # Get actual pooled fund allocations
        query = """
            SELECT 
                admin1,
                SUM(CASE WHEN pooled_fund = true THEN budget_usd ELSE 0 END) as pooled_budget,
                SUM(beneficiaries) as total_beneficiaries
            FROM projects
            WHERE hurricane_id = ?
            GROUP BY admin1
        """
        results = self.db.execute(query, [hurricane_id]).fetchall()
        
        actual_allocations = {row[0]: row[1] for row in results}
        total_budget = sum(actual_allocations.values())
        
        # Get severity data
        regions = self.get_affected_regions(hurricane_id)
        
        region_allocations = []
        for region_data in regions:
            region = region_data["admin1"]
            budget = actual_allocations.get(region, 0.0)
            
            native_res = self.get_native_resources(hurricane_id, region)
            people_in_need = region_data["people_in_need"]
            severity = region_data["severity_index"]
            
            native_capacity = (
                native_res.shelters * 50 +
                native_res.hospital_beds * 1 +
                native_res.responder_units * 10
            )
            budget_coverage = budget / self.cost_per_person
            total_coverage = min(budget_coverage + native_capacity, people_in_need)
            coverage_ratio = total_coverage / people_in_need if people_in_need > 0 else 0
            
            coverage_estimate = {
                "people_covered": int(total_coverage),
                "coverage_ratio": coverage_ratio,
                "unmet_need": int(max(0, people_in_need - total_coverage)),
                "severity_weighted_impact": total_coverage * severity
            }
            
            region_allocations.append(RegionAllocation(
                region=region,
                budget=budget,
                resources=native_res,
                coverage_estimate=coverage_estimate
            ))
        
        constraints = {
            "total_budget": total_budget,
            "response_window_hours": "historical",
            "data_source": "pooled_fund_projects"
        }
        
        return SimulationPlan(
            plan_type="real_world",
            hurricane_id=hurricane_id,
            total_budget=total_budget,
            response_window_hours=0,  # Historical, not applicable
            allocations=region_allocations,
            constraints_used=constraints
        )
    
    def _get_current_coverage(self, hurricane_id: str, regions: List[str]) -> np.ndarray:
        """Get current coverage ratios for equity calculation."""
        query = """
            SELECT 
                s.admin1,
                COALESCE(SUM(CASE WHEN p.pooled_fund = true THEN p.budget_usd ELSE 0 END), 0) as pooled_budget,
                (s.severity_index * s.estimated_people_in_need * 500) as estimated_need
            FROM severity s
            LEFT JOIN projects p ON s.hurricane_id = p.hurricane_id AND s.admin1 = p.admin1
            WHERE s.hurricane_id = ?
            GROUP BY s.admin1, s.severity_index, s.estimated_people_in_need
        """
        results = self.db.execute(query, [hurricane_id]).fetchall()
        
        coverage_map = {}
        for row in results:
            pooled = row[1]
            need = row[2]
            coverage_map[row[0]] = pooled / need if need > 0 else 0.0
        
        return np.array([coverage_map.get(r, 0.0) for r in regions])
    
    def compare_plans(
        self,
        plan1: SimulationPlan,
        plan2: SimulationPlan
    ) -> Dict:
        """Compare two simulation plans."""
        # Aggregate metrics
        def get_metrics(plan: SimulationPlan) -> Dict:
            total_covered = sum(a.coverage_estimate["people_covered"] for a in plan.allocations)
            total_unmet = sum(a.coverage_estimate["unmet_need"] for a in plan.allocations)
            total_impact = sum(a.coverage_estimate["severity_weighted_impact"] for a in plan.allocations)
            avg_coverage = np.mean([a.coverage_estimate["coverage_ratio"] for a in plan.allocations])
            
            return {
                "total_covered": total_covered,
                "total_unmet": total_unmet,
                "total_impact": total_impact,
                "avg_coverage": avg_coverage,
                "total_budget": plan.total_budget
            }
        
        metrics1 = get_metrics(plan1)
        metrics2 = get_metrics(plan2)
        
        # Per-region comparison
        region_comparisons = []
        plan2_map = {a.region: a for a in plan2.allocations}
        
        for alloc1 in plan1.allocations:
            alloc2 = plan2_map.get(alloc1.region)
            if not alloc2:
                continue
            
            region_comparisons.append({
                "region": alloc1.region,
                "budget_diff": alloc1.budget - alloc2.budget,
                "coverage_diff": alloc1.coverage_estimate["coverage_ratio"] - alloc2.coverage_estimate["coverage_ratio"],
                "unmet_diff": alloc1.coverage_estimate["unmet_need"] - alloc2.coverage_estimate["unmet_need"]
            })
        
        return {
            "plan1_metrics": metrics1,
            "plan2_metrics": metrics2,
            "differences": {
                "covered_diff": metrics1["total_covered"] - metrics2["total_covered"],
                "unmet_diff": metrics1["total_unmet"] - metrics2["total_unmet"],
                "impact_diff": metrics1["total_impact"] - metrics2["total_impact"],
                "coverage_diff": metrics1["avg_coverage"] - metrics2["avg_coverage"],
                "budget_diff": metrics1["total_budget"] - metrics2["total_budget"]
            },
            "region_comparisons": region_comparisons
        }
    
    def generate_mismatch_analysis(
        self,
        ideal_plan: SimulationPlan,
        real_plan: SimulationPlan
    ) -> Dict:
        """Generate mismatch analysis between ideal and real-world plans."""
        comparison = self.compare_plans(ideal_plan, real_plan)
        
        # Find most overlooked regions
        overlooked = []
        real_map = {a.region: a for a in real_plan.allocations}
        
        for ideal_alloc in ideal_plan.allocations:
            real_alloc = real_map.get(ideal_alloc.region)
            if not real_alloc:
                continue
            
            ideal_budget = ideal_alloc.budget
            real_budget = real_alloc.budget
            gap = (real_budget - ideal_budget) / ideal_budget if ideal_budget > 0 else 0
            
            if gap < -0.2:  # Underfunded by more than 20%
                overlooked.append({
                    "region": ideal_alloc.region,
                    "ideal_budget": ideal_budget,
                    "actual_budget": real_budget,
                    "coverage_gap": gap,
                    "unmet_need": ideal_alloc.coverage_estimate["unmet_need"] - real_alloc.coverage_estimate["unmet_need"]
                })
        
        overlooked.sort(key=lambda x: x["coverage_gap"])
        
        # Generate narrative
        if overlooked:
            top_overlooked = overlooked[0]
            narrative = (
                f"High-severity regions like {top_overlooked['region']} received "
                f"{abs(top_overlooked['coverage_gap']):.0%} less funding than an equity-optimized response would suggest. "
                f"Coverage gap: ${top_overlooked['ideal_budget'] - top_overlooked['actual_budget']:,.0f}."
            )
        else:
            narrative = "Real-world allocation closely matches ideal UN-values-optimized plan."
        
        return {
            "comparison": comparison,
            "overlooked_regions": overlooked,
            "narrative": narrative,
            "equity_deviation": abs(comparison["differences"]["coverage_diff"]),
            "efficiency_loss": comparison["differences"]["budget_diff"] / ideal_plan.total_budget if ideal_plan.total_budget > 0 else 0
        }
