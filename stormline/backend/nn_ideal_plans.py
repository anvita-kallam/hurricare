import json
import pandas as pd
from collections import defaultdict

# Load hurricanes
with open('response_plan_prediction/data/hurricanes.json', 'r') as f:
    hurricanes = json.load(f)

# Load severity
sev_df = pd.read_csv('response_plan_prediction/data/severity.csv')

# Load projects
proj_df = pd.read_csv('response_plan_prediction/data/projects.csv')

# UN best-practice sector priorities
SECTORS = ['WASH', 'Health', 'Shelter', 'Food Security', 'Protection', 'Livelihoods', 'Education', 'Energy']

plans = []

for h in hurricanes:
    hid = h['id']
    # Aggregate severity by sector
    sev = sev_df[sev_df['hurricane_id'] == hid]
    proj = proj_df[proj_df['hurricane_id'] == hid]
    sector_scores = defaultdict(float)
    sector_beneficiaries = defaultdict(int)
    sector_budget = defaultdict(float)

    for _, row in proj.iterrows():
        sector = row['cluster']
        if sector in SECTORS:
            sector_budget[sector] += row['budget_usd']
            sector_beneficiaries[sector] += row['beneficiaries']

    # Use severity index to weight sectors
    for _, row in sev.iterrows():
        admin = row['admin1']
        severity = row['severity_index']
        # Find projects in this admin
        admin_proj = proj[proj['admin1'] == admin]
        for _, prow in admin_proj.iterrows():
            sector = prow['cluster']
            if sector in SECTORS:
                sector_scores[sector] += severity * prow['beneficiaries']

    # Rank sectors
    ranked = sorted(SECTORS, key=lambda s: sector_scores[s], reverse=True)
    top_sectors = [s for s in ranked if sector_scores[s] > 0][:5]

    plan = f"""
Ideal Response Plan for {h['name']} ({h['year']})

Affected countries/territories: {', '.join(h['affected_countries'])}
Estimated population affected: {h['estimated_population_affected']:,}

Key priorities:
"""
    for s in top_sectors:
        plan += f"- {s}: Support {sector_beneficiaries[s]:,} people with a budget of ${sector_budget[s]:,.0f}.\n"
    plan += "\nSector-specific actions:\n"
    for s in top_sectors:
        if s == 'WASH':
            plan += "- Ensure access to clean water and sanitation to prevent disease outbreaks.\n"
        elif s == 'Health':
            plan += "- Provide immediate health services, including mobile clinics and medical supplies.\n"
        elif s == 'Shelter':
            plan += "- Deploy emergency shelters and repair homes for displaced families.\n"
        elif s == 'Food Security':
            plan += "- Distribute emergency food rations and restore food supply chains.\n"
        elif s == 'Protection':
            plan += "- Safeguard vulnerable groups and prevent exploitation and abuse.\n"
        elif s == 'Livelihoods':
            plan += "- Support recovery of jobs and income-generating activities.\n"
        elif s == 'Education':
            plan += "- Reopen schools and provide learning materials for children.\n"
        elif s == 'Energy':
            plan += "- Restore power and critical infrastructure for relief operations.\n"
    plan += "\nAll actions follow UN best-practice humanitarian response standards, prioritizing life-saving interventions, disease prevention, and rapid recovery.\n"

    plans.append({
        'id': h['id'],
        'name': h['name'],
        'year': h['year'],
        'affected_countries': ', '.join(h['affected_countries']),
        'estimated_population_affected': h['estimated_population_affected'],
        'ideal_plan_text': plan.strip()
    })

out_df = pd.DataFrame(plans)
out_df.to_csv('response_plan_prediction/data/ideal_hurricane_response_plans.csv', index=False)
print('CSV saved: response_plan_prediction/data/ideal_hurricane_response_plans.csv')
