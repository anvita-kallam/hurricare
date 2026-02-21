import duckdb
import json
from typing import List, Dict
from statistics import median
import numpy as np


def get_coverage(conn: duckdb.DuckDBPyConnection, hurricane_id: str = None) -> List[Dict]:
    """Calculate coverage ratios for regions."""
    query = """
        SELECT 
            s.hurricane_id,
            s.admin1,
            s.severity_index,
            s.estimated_people_in_need,
            COALESCE(SUM(CASE WHEN p.pooled_fund = true THEN p.budget_usd ELSE 0 END), 0) as pooled_fund_budget,
            (s.severity_index * s.estimated_people_in_need * 500) as estimated_need_budget
        FROM severity s
        LEFT JOIN projects p ON s.hurricane_id = p.hurricane_id AND s.admin1 = p.admin1
    """
    
    if hurricane_id:
        query += f" WHERE s.hurricane_id = '{hurricane_id}'"
    
    query += " GROUP BY s.hurricane_id, s.admin1, s.severity_index, s.estimated_people_in_need"
    
    results = conn.execute(query).fetchall()
    
    coverage_data = []
    for row in results:
        pooled_fund_budget = row[4]
        estimated_need_budget = row[5]
        coverage_ratio = pooled_fund_budget / estimated_need_budget if estimated_need_budget > 0 else 0
        
        coverage_data.append({
            "hurricane_id": row[0],
            "admin1": row[1],
            "severity_index": row[2],
            "people_in_need": row[3],
            "pooled_fund_budget": pooled_fund_budget,
            "estimated_need_budget": estimated_need_budget,
            "coverage_ratio": coverage_ratio
        })
    
    return coverage_data


def get_flagged_projects(conn: duckdb.DuckDBPyConnection, hurricane_id: str = None) -> List[Dict]:
    """Flag projects with outlier budget_per_beneficiary using IQR method."""
    query = """
        SELECT 
            project_id,
            hurricane_id,
            country,
            admin1,
            cluster,
            budget_usd,
            beneficiaries,
            CASE 
                WHEN beneficiaries > 0 THEN budget_usd / beneficiaries 
                ELSE 0 
            END as budget_per_beneficiary
        FROM projects
    """
    
    if hurricane_id:
        query += f" WHERE hurricane_id = '{hurricane_id}'"
    
    results = conn.execute(query).fetchall()
    
    # Group by (country, cluster) for IQR calculation
    grouped = {}
    for row in results:
        key = (row[2], row[4])  # (country, cluster)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append({
            "project_id": row[0],
            "hurricane_id": row[1],
            "country": row[2],
            "admin1": row[3],
            "cluster": row[4],
            "budget_usd": row[5],
            "beneficiaries": row[6],
            "budget_per_beneficiary": row[7]
        })
    
    flagged = []
    
    for (country, cluster), projects in grouped.items():
        if len(projects) < 3:  # Need at least 3 projects for IQR
            continue
        
        budgets = [p["budget_per_beneficiary"] for p in projects if p["budget_per_beneficiary"] > 0]
        if len(budgets) < 3:
            continue
        
        q1 = np.percentile(budgets, 25)
        q3 = np.percentile(budgets, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        median_budget = np.median(budgets)
        std_budget = np.std(budgets) if len(budgets) > 1 else 0
        
        for project in projects:
            if project["budget_per_beneficiary"] <= 0:
                continue
            
            bp_ben = project["budget_per_beneficiary"]
            z_score = (bp_ben - median_budget) / std_budget if std_budget > 0 else 0
            
            if bp_ben > upper_bound:
                flagged.append({
                    **project,
                    "flag_type": "high_outlier",
                    "explanation": f"Budget per beneficiary (${bp_ben:.2f}) is significantly higher than the median (${median_budget:.2f}) for {cluster} projects in {country}. This may indicate inefficiency or data quality issues.",
                    "z_score": z_score
                })
            elif bp_ben < lower_bound:
                flagged.append({
                    **project,
                    "flag_type": "low_outlier",
                    "explanation": f"Budget per beneficiary (${bp_ben:.2f}) is significantly lower than the median (${median_budget:.2f}) for {cluster} projects in {country}. This may indicate underfunding or data quality issues.",
                    "z_score": z_score
                })
    
    return flagged


def simulate_allocation(conn: duckdb.DuckDBPyConnection, hurricane_id: str, allocations: Dict[str, float]) -> Dict:
    """Simulate allocation impact."""
    # Get current pooled fund allocation
    query = """
        SELECT 
            admin1,
            SUM(CASE WHEN pooled_fund = true THEN budget_usd ELSE 0 END) as current_pooled_fund,
            SUM(beneficiaries) as total_beneficiaries
        FROM projects
        WHERE hurricane_id = ?
        GROUP BY admin1
    """
    
    current_allocation = {}
    results = conn.execute(query, [hurricane_id]).fetchall()
    for row in results:
        current_allocation[row[0]] = {
            "budget": row[1],
            "beneficiaries": row[2]
        }
    
    # Get severity data
    severity_query = """
        SELECT admin1, severity_index, estimated_people_in_need
        FROM severity
        WHERE hurricane_id = ?
    """
    severity_data = {}
    results = conn.execute(severity_query, [hurricane_id]).fetchall()
    for row in results:
        severity_data[row[0]] = {
            "severity_index": row[1],
            "people_in_need": row[2]
        }
    
    # Calculate impact
    total_lives_covered = 0
    total_vulnerability_reduction = 0
    total_unmet_need = 0
    
    for admin1, allocated_budget in allocations.items():
        if admin1 not in severity_data:
            continue
        
        severity = severity_data[admin1]
        people_in_need = severity["people_in_need"]
        severity_index = severity["severity_index"]
        
        # Simple model: budget / unit_cost = lives covered
        unit_cost = 500  # USD per person
        lives_covered = min(allocated_budget / unit_cost, people_in_need)
        
        # Vulnerability reduction proportional to coverage
        coverage = lives_covered / people_in_need if people_in_need > 0 else 0
        vulnerability_reduction = coverage * severity_index
        
        # Unmet need
        unmet_need = max(0, people_in_need - lives_covered) * severity_index
        
        total_lives_covered += lives_covered
        total_vulnerability_reduction += vulnerability_reduction
        total_unmet_need += unmet_need
    
    # Calculate impact score
    w1, w2, w3 = 1.0, 0.5, -0.3
    impact_score = (
        w1 * total_lives_covered +
        w2 * total_vulnerability_reduction * 1000 -
        w3 * total_unmet_need
    )
    
    # Compare to current allocation
    current_lives_covered = sum(
        min(a["budget"] / 500, severity_data.get(admin1, {}).get("people_in_need", 0))
        for admin1, a in current_allocation.items()
        if admin1 in severity_data
    )
    
    comparison = {
        "current_lives_covered": current_lives_covered,
        "simulated_lives_covered": total_lives_covered,
        "improvement": total_lives_covered - current_lives_covered
    }
    
    # Calculate hard priorities (non-negotiable)
    # Prevent avoidable deaths = lives covered weighted by severity
    lives_saved = total_lives_covered
    
    # Prevent severe human suffering = vulnerability reduction
    suffering_reduced = total_vulnerability_reduction * 1000  # Scale for display
    
    # Protect vulnerable populations (assume 30% of people in need are vulnerable)
    vulnerable_protected = sum(
        min(allocations.get(admin1, 0) / 500, data["people_in_need"] * 0.3)
        for admin1, data in severity_data.items()
    )
    
    hard_priorities = {
        "lives_saved": lives_saved,
        "suffering_reduced": suffering_reduced,
        "vulnerable_protected": vulnerable_protected
    }
    
    # Calculate soft priorities (trade-offs)
    total_allocated = sum(allocations.values())
    economic_loss_reduction = total_lives_covered * 5000  # Estimated economic value per life
    resource_efficiency = total_lives_covered / total_allocated if total_allocated > 0 else 0
    
    soft_priorities = {
        "economic_loss_reduction": economic_loss_reduction,
        "resource_efficiency": resource_efficiency
    }
    
    # Calculate constraints (penalties)
    # Logistics penalty: higher for remote/less accessible regions
    logistics_penalty = 0.05  # Base 5% penalty
    # Access/security penalty: higher for conflict zones (simplified)
    access_penalty = 0.03  # Base 3% penalty
    total_penalty = logistics_penalty + access_penalty
    
    constraints = {
        "logistics_penalty": logistics_penalty,
        "access_penalty": access_penalty,
        "total_penalty": total_penalty
    }
    
    return {
        "impact_score": impact_score,
        "lives_covered": total_lives_covered,
        "vulnerability_reduction": total_vulnerability_reduction,
        "unmet_need": total_unmet_need,
        "comparison": comparison,
        "hard_priorities": hard_priorities,
        "soft_priorities": soft_priorities,
        "constraints": constraints
    }
