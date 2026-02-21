#!/usr/bin/env python3
"""
Update project data with realistic humanitarian response numbers.
Based on real-world humanitarian project data:
- Budget per beneficiary: $50-$400 for most projects
- Small projects: $100K-$1M, 1K-20K beneficiaries
- Medium projects: $1M-$5M, 10K-100K beneficiaries  
- Large projects: $5M-$15M, 50K-300K beneficiaries
"""

import csv
import random

# Read projects
projects = []
with open('projects.csv', 'r') as f:
    reader = csv.DictReader(f)
    projects = list(reader)

# Update each project with realistic numbers
for project in projects:
    # Determine project size category
    rand = random.random()
    if rand < 0.3:  # Small projects (30%)
        budget_min, budget_max = 100000, 1000000
        beneficiaries_min, beneficiaries_max = 1000, 20000
        budget_per_beneficiary_min, budget_per_beneficiary_max = 50, 150
    elif rand < 0.7:  # Medium projects (40%)
        budget_min, budget_max = 1000000, 5000000
        beneficiaries_min, beneficiaries_max = 10000, 100000
        budget_per_beneficiary_min, budget_per_beneficiary_max = 80, 250
    else:  # Large projects (30%)
        budget_min, budget_max = 5000000, 15000000
        beneficiaries_min, beneficiaries_max = 50000, 300000
        budget_per_beneficiary_min, budget_per_beneficiary_max = 100, 300
    
    # Set beneficiaries first
    beneficiaries = random.randint(beneficiaries_min, beneficiaries_max)
    
    # Calculate budget based on realistic budget per beneficiary
    budget_per_beneficiary = random.uniform(budget_per_beneficiary_min, budget_per_beneficiary_max)
    budget = round(beneficiaries * budget_per_beneficiary)
    
    # Ensure budget is within reasonable range, then recalculate
    budget = max(budget_min, min(budget, budget_max))
    
    # Recalculate beneficiaries to match budget while maintaining realistic ratio
    beneficiaries = round(budget / budget_per_beneficiary)
    beneficiaries = max(1000, min(beneficiaries, 500000))  # Cap at 500K
    
    # Final check: ensure budget per beneficiary is still realistic
    final_ratio = budget / beneficiaries if beneficiaries > 0 else 0
    if final_ratio > 500:  # If too high, increase beneficiaries
        beneficiaries = round(budget / 400)  # Use max realistic ratio
        beneficiaries = max(1000, min(beneficiaries, 500000))
    elif final_ratio < 30:  # If too low, decrease beneficiaries
        beneficiaries = round(budget / 50)  # Use min realistic ratio
        beneficiaries = max(1000, min(beneficiaries, 500000))
    
    project['budget_usd'] = str(int(budget))
    project['beneficiaries'] = str(beneficiaries)

# Write back
with open('projects.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=projects[0].keys())
    writer.writeheader()
    writer.writerows(projects)

print('Updated projects.csv with realistic numbers')
print(f'Total projects: {len(projects)}')
