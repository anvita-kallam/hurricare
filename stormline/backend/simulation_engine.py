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
        
        # Prepare optimization inputs
        n_regions = len(regions)
        people_in_need = np.array([r["people_in_need"] for r in regions])
        severity = np.array([r["severity_index"] for r in regions])
        
        # Vulnerability score (higher severity = higher vulnerability)
        vulnerability = severity * people_in_need
        
        # Equity score (inverse of current coverage to favor underfunded areas)
        # Get current coverage for equity calculation
        current_coverage = self._get_current_coverage(hurricane_id, [r["admin1"] for r in regions])
        equity_scores = 1.0 / (current_coverage + 0.1)  # Inverse, avoid division by zero
        
        # Objective function: maximize UN values
        # Combined score = w1*humanity + w2*impartiality + w3*equity
        # Humanity: lives saved
        # Impartiality: severity-weighted coverage
        # Equity: favor underfunded regions
        
        # We want to maximize: sum(allocations[i] * (w1 + w2*severity[i] + w3*equity[i]))
        # Subject to: sum(allocations) <= total_budget
        
        # Linear programming approach
        # Maximize: c^T * x
        # Subject to: A_ub * x <= b_ub, x >= 0
        
        # Objective coefficients (negative because linprog minimizes)
        c = -(
            self.un_weights["humanity"] * np.ones(n_regions) +
            self.un_weights["impartiality"] * severity +
            self.un_weights["equity"] * equity_scores
        )
        
        # Constraint: sum of allocations <= total_budget
        A_ub = np.ones((1, n_regions))
        b_ub = [total_budget]
        
        # Bounds: allocations >= 0
        bounds = [(0, None) for _ in range(n_regions)]
        
        # Solve
        result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')
        
        if not result.success:
            # Fallback: proportional allocation weighted by severity and vulnerability
            weights = severity * people_in_need * equity_scores
            weights = weights / weights.sum() if weights.sum() > 0 else np.ones(n_regions) / n_regions
            optimal_allocations = weights * total_budget
        else:
            optimal_allocations = result.x
        
        # Build plan
        region_allocations = []
        total_lives_saved = 0
        total_equity_score = 0
        total_efficiency = 0
        
        for i, region_data in enumerate(regions):
            region = region_data["admin1"]
            budget = float(optimal_allocations[i])
            
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
            
            total_lives_saved += total_coverage
            total_equity_score += coverage_ratio * equity_scores[i]
            total_efficiency += budget / total_coverage if total_coverage > 0 else 0
            
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
        
        # Get ideal plan text from CSV if available
        ideal_plan_text = self.get_ideal_plan_text(hurricane_id)
        
        # Generate explanation (fallback if CSV not available)
        if not ideal_plan_text:
            top_region = max(region_allocations, key=lambda a: a.budget)
            ideal_plan_text = (
                f"Resources were prioritized toward high-severity, low-access regions. "
                f"Top allocation: {top_region.region} (${top_region.budget:,.0f}). "
                f"Optimization balanced lives saved ({objective_scores['humanity']:.2%}), "
                f"equity ({objective_scores['equity']:.2%}), and impartiality ({objective_scores['impartiality']:.2%})."
            )
        
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
            explanation=ideal_plan_text
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
