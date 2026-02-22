"""
Explainable MLP for hurricane response planning.
Uses PyTorch: multi-layer feedforward model that takes structured features and outputs
sector priorities (scores/probabilities), then generates a natural-language response plan.
Explainability: named features + gradient-based feature importance.
"""

import json
import os
import math
from collections import defaultdict
from typing import List, Dict, Any, Tuple, Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SECTORS = [
    "WASH",
    "Health",
    "Shelter",
    "Food Security",
    "Protection",
    "Livelihoods",
    "Education",
    "Energy",
]

SECTOR_ACTIONS = {
    "WASH": "Ensure access to clean water and sanitation to prevent disease outbreaks.",
    "Health": "Provide immediate health services, including mobile clinics and medical supplies.",
    "Shelter": "Deploy emergency shelters and repair homes for displaced families.",
    "Food Security": "Distribute emergency food rations and restore food supply chains.",
    "Protection": "Safeguard vulnerable groups and prevent exploitation and abuse.",
    "Livelihoods": "Support recovery of jobs and income-generating activities.",
    "Education": "Reopen schools and provide learning materials for children.",
    "Energy": "Restore power and critical infrastructure for relief operations.",
}

# Feature layout (for explainability): order must match build_feature_vector()
FEATURE_NAMES = [
    "max_category_norm",
    "max_wind_knots_norm",
    "num_affected_countries",
    "log_population_affected",
    "year_norm",
    "regional_mean_severity",
    "regional_max_severity",
    "regional_total_people_in_need_norm",
    "budget_WASH",
    "budget_Health",
    "budget_Shelter",
    "budget_Food_Security",
    "budget_Protection",
    "budget_Livelihoods",
    "budget_Education",
    "budget_Energy",
    "beneficiaries_WASH",
    "beneficiaries_Health",
    "beneficiaries_Shelter",
    "beneficiaries_Food_Security",
    "beneficiaries_Protection",
    "beneficiaries_Livelihoods",
    "beneficiaries_Education",
    "beneficiaries_Energy",
    "historical_effectiveness_placeholder",
    "context_infrastructure_placeholder",
    "context_social_vulnerability_placeholder",
]
INPUT_DIM = len(FEATURE_NAMES)
HIDDEN_DIMS = [128, 64, 32]
OUTPUT_DIM = len(SECTORS)


# ---------------------------------------------------------------------------
# Explainable MLP
# ---------------------------------------------------------------------------
class ExplainableMLP(nn.Module):
    """
    Multi-layer feedforward network for sector priority prediction.
    ReLU hidden layers; output logits per sector (softmax → probabilities).
    """

    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        hidden_dims: List[int] = None,
        output_dim: int = OUTPUT_DIM,
        dropout: float = 0.1,
    ):
        super().__init__()
        hidden_dims = hidden_dims or HIDDEN_DIMS
        dims = [input_dim] + hidden_dims + [output_dim]
        layers = []
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            if i < len(dims) - 2:
                layers.append(nn.ReLU(inplace=True))
                layers.append(nn.BatchNorm1d(dims[i + 1]))
                layers.append(nn.Dropout(dropout))
        self.net = nn.Sequential(*layers)
        self.input_dim = input_dim
        self.output_dim = output_dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def get_feature_importance(
    model: ExplainableMLP,
    x: torch.Tensor,
    sector_index: Optional[int] = None,
) -> np.ndarray:
    """
    Gradient-based feature importance: magnitude of (input * gradient) per feature.
    If sector_index is None, uses mean over all output logits.
    """
    model.eval()
    x = x.requires_grad_(True)
    logits = model(x)
    if sector_index is not None:
        logits[:, sector_index].sum().backward()
    else:
        logits.sum().backward()
    # element-wise product then magnitude per feature
    importance = (x.detach() * x.grad).abs().sum(dim=0)
    return importance.cpu().numpy()


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------
def build_feature_vector(
    h: Dict,
    sev_df: pd.DataFrame,
    proj_df: pd.DataFrame,
    hid: str,
    *,
    pop_scale: float = 1e6,
    budget_scale: float = 1e7,
) -> np.ndarray:
    """
    Build a fixed-size feature vector for one hurricane.
    Order must match FEATURE_NAMES for explainability.
    """
    # Hurricane metadata
    max_cat = float(h.get("max_category", 3))
    max_cat_norm = (max_cat - 1) / 4.0  # 1–5 → 0–1
    track = h.get("track", [])
    max_wind = max((p.get("wind", 0) for p in track), default=100)
    max_wind_norm = min(max_wind / 200.0, 1.0)
    num_countries = float(len(h.get("affected_countries", [])) or 1)
    pop = float(h.get("estimated_population_affected", 100_000))
    log_pop = math.log1p(pop) / math.log1p(10 * pop_scale)  # scale to ~0–1
    year = float(h.get("year", 2010))
    year_norm = (year - 1990) / 40.0
    year_norm = max(0, min(1, year_norm))

    # Regional severity
    sev = sev_df[sev_df["hurricane_id"] == hid]
    if len(sev) > 0:
        mean_sev = float(sev["severity_index"].mean())
        max_sev = float(sev["severity_index"].max())
        total_pin = float(sev["estimated_people_in_need"].sum())
    else:
        mean_sev = max_sev = 0.5
        total_pin = pop
    total_pin_norm = math.log1p(total_pin) / math.log1p(10 * pop_scale)
    total_pin_norm = min(total_pin_norm, 1.0)

    # Sector budgets and beneficiaries (from projects)
    proj = proj_df[proj_df["hurricane_id"] == hid]
    sector_budget = defaultdict(float)
    sector_benef = defaultdict(int)
    for _, row in proj.iterrows():
        s = row["cluster"]
        if s in SECTORS:
            sector_budget[s] += row["budget_usd"]
            sector_benef[s] += row["beneficiaries"]

    budget_vals = [sector_budget[s] for s in SECTORS]
    benef_vals = [sector_benef[s] for s in SECTORS]
    total_b = sum(budget_vals) or 1
    total_n = sum(benef_vals) or 1
    budget_norm = [v / total_b for v in budget_vals]
    benef_norm = [v / total_n for v in benef_vals]

    # Placeholders: historical effectiveness, infrastructure, social vulnerability
    hist_eff = 0.5
    infra = 0.5
    soc_vuln = 0.5

    vec = [
        max_cat_norm,
        max_wind_norm,
        num_countries,
        log_pop,
        year_norm,
        mean_sev,
        max_sev,
        total_pin_norm,
        *budget_norm,
        *benef_norm,
        hist_eff,
        infra,
        soc_vuln,
    ]
    return np.array(vec, dtype=np.float32)


def build_sector_targets(
    hid: str,
    sev_df: pd.DataFrame,
    proj_df: pd.DataFrame,
) -> np.ndarray:
    """Severity-weighted sector scores (same logic as original script), normalized to sum to 1."""
    sev = sev_df[sev_df["hurricane_id"] == hid]
    proj = proj_df[proj_df["hurricane_id"] == hid]
    sector_scores = defaultdict(float)
    for _, row in sev.iterrows():
        admin = row["admin1"]
        severity = row["severity_index"]
        admin_proj = proj[proj["admin1"] == admin]
        for _, prow in admin_proj.iterrows():
            s = prow["cluster"]
            if s in SECTORS:
                sector_scores[s] += severity * prow["beneficiaries"]
    scores = np.array([sector_scores[s] for s in SECTORS], dtype=np.float32)
    if scores.sum() > 0:
        scores /= scores.sum()
    return scores


# ---------------------------------------------------------------------------
# Plan generation
# ---------------------------------------------------------------------------
def plan_from_predictions(
    h: Dict,
    sector_probs: np.ndarray,
    sector_beneficiaries: Dict[str, int],
    sector_budget: Dict[str, float],
    top_k: int = 5,
) -> str:
    """Generate natural-language plan from sector probabilities and project aggregates."""
    order = np.argsort(sector_probs)[::-1]
    top_sectors = [SECTORS[i] for i in order if sector_probs[i] > 0][:top_k]
    if not top_sectors:
        top_sectors = SECTORS[:top_k]

    plan = f"""
Ideal Response Plan for {h['name']} ({h['year']})

Affected countries/territories: {', '.join(h['affected_countries'])}
Estimated population affected: {h['estimated_population_affected']:,}

Key priorities:
"""
    for s in top_sectors:
        plan += f"- {s}: Support {sector_beneficiaries.get(s, 0):,} people with a budget of ${sector_budget.get(s, 0):,.0f}.\n"
    plan += "\nSector-specific actions:\n"
    for s in top_sectors:
        plan += f"- {SECTOR_ACTIONS.get(s, 'Coordinate relief and recovery efforts.')}\n"
    plan += "\nAll actions follow UN best-practice humanitarian response standards, prioritizing life-saving interventions, disease prevention, and rapid recovery.\n"
    return plan.strip()


# ---------------------------------------------------------------------------
# Data paths and I/O
# ---------------------------------------------------------------------------
def find_data_dir() -> str:
    base = os.path.dirname(os.path.abspath(__file__))
    for sub in ["sample_data", "response_plan_prediction/data", "data"]:
        d = os.path.join(base, sub)
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, "hurricanes.json")):
            return d
    return os.path.join(base, "sample_data")


def load_data(data_dir: str) -> Tuple[List[Dict], pd.DataFrame, pd.DataFrame]:
    with open(os.path.join(data_dir, "hurricanes.json"), "r") as f:
        hurricanes = json.load(f)
    sev_df = pd.read_csv(os.path.join(data_dir, "severity.csv"))
    proj_df = pd.read_csv(os.path.join(data_dir, "projects.csv"))
    return hurricanes, sev_df, proj_df


# ---------------------------------------------------------------------------
# Training and inference
# ---------------------------------------------------------------------------
def train_model(
    X: np.ndarray,
    y: np.ndarray,
    epochs: int = 200,
    lr: float = 1e-2,
    device: str = None,
) -> Tuple[ExplainableMLP, List[float]]:
    """Train MLP to predict sector probability distribution (soft-label cross-entropy)."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ExplainableMLP().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    Xt = torch.from_numpy(X).float().to(device)
    yt = torch.from_numpy(y).float().to(device)
    losses = []
    model.train()
    for ep in range(epochs):
        optimizer.zero_grad()
        logits = model(Xt)
        # Soft-label cross-entropy: -sum(y * log_softmax(logits))
        log_p = torch.log_softmax(logits, dim=1)
        loss = -(yt * log_p).sum(dim=1).mean()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        losses.append(loss.item())
    return model, losses


def predict_and_explain(
    model: ExplainableMLP,
    x: np.ndarray,
    feature_names: List[str] = FEATURE_NAMES,
    device: str = None,
) -> Tuple[np.ndarray, Dict[str, float]]:
    """Predict sector probabilities and return feature importance (explainability)."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    model.eval()
    xt = torch.from_numpy(x).float().unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(xt)
        probs = torch.softmax(logits, dim=1).cpu().numpy().squeeze(0)
    importance = get_feature_importance(model, xt)
    importance_dict = {feature_names[i]: float(importance[i]) for i in range(len(feature_names))}
    return probs, importance_dict


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    data_dir = find_data_dir()
    print(f"Using data dir: {data_dir}")
    hurricanes, sev_df, proj_df = load_data(data_dir)

    # Build feature matrix and targets
    X_list = []
    y_list = []
    for h in hurricanes:
        hid = h["id"]
        X_list.append(build_feature_vector(h, sev_df, proj_df, hid))
        y_list.append(build_sector_targets(hid, sev_df, proj_df))
    X = np.stack(X_list)
    y = np.stack(y_list)

    # Train (targets are already normalized to sum=1; we predict logits and compare to soft targets)
    model, losses = train_model(X, y, epochs=300, lr=1e-2)
    print(f"Training finished. Final loss: {losses[-1]:.6f}")

    # Optionally save model
    model_path = os.path.join(os.path.dirname(data_dir), "nn_ideal_plans_model.pt")
    torch.save(
        {
            "state_dict": model.state_dict(),
            "feature_names": FEATURE_NAMES,
            "sectors": SECTORS,
        },
        model_path,
    )
    print(f"Model saved: {model_path}")

    # Generate plans with explainability
    plans = []
    for i, h in enumerate(hurricanes):
        hid = h["id"]
        x = X[i : i + 1]
        probs, importance = predict_and_explain(model, x[0])

        # Aggregate sector budget/beneficiaries for this hurricane
        proj = proj_df[proj_df["hurricane_id"] == hid]
        sector_beneficiaries = defaultdict(int)
        sector_budget = defaultdict(float)
        for _, row in proj.iterrows():
            s = row["cluster"]
            if s in SECTORS:
                sector_budget[s] += row["budget_usd"]
                sector_beneficiaries[s] += row["beneficiaries"]

        plan_text = plan_from_predictions(h, probs, sector_beneficiaries, sector_budget)
        plans.append({
            "id": hid,
            "name": h["name"],
            "year": h["year"],
            "affected_countries": ", ".join(h["affected_countries"]),
            "estimated_population_affected": h["estimated_population_affected"],
            "ideal_plan_text": plan_text,
            "sector_probabilities": {SECTORS[j]: float(probs[j]) for j in range(len(SECTORS))},
            "feature_importance": importance,
        })

    out_df = pd.DataFrame([
        {
            "id": p["id"],
            "name": p["name"],
            "year": p["year"],
            "affected_countries": p["affected_countries"],
            "estimated_population_affected": p["estimated_population_affected"],
            "ideal_plan_text": p["ideal_plan_text"],
        }
        for p in plans
    ])
    out_path = os.path.join(data_dir, "ideal_hurricane_response_plans.csv")
    out_df.to_csv(out_path, index=False)
    print(f"CSV saved: {out_path}")

    # Print first plan and top feature importance as example
    if plans:
        p = plans[0]
        print("\n--- Example plan (first hurricane) ---")
        print(p["ideal_plan_text"][:800] + "...")
        sorted_imp = sorted(p["feature_importance"].items(), key=lambda t: -t[1])[:10]
        print("\n--- Top 10 feature importance (explainability) ---")
        for name, val in sorted_imp:
            print(f"  {name}: {val:.4f}")

    return plans


if __name__ == "__main__":
    main()
