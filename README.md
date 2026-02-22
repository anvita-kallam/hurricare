# HurriCare

HurriCare is an interactive decision-support platform designed for **United Nations–style humanitarian hurricane response**.

The system combines **geospatial modeling**, **machine learning**, and **large-scale analytics** to analyze historical disasters, quantify funding disparities, and simulate evidence-based resource allocation strategies.

---

## Overview

HurriCare enables data-driven exploration of:

- Historical hurricane events  
- Humanitarian need vs funding coverage  
- Sector-level allocation strategies  
- Structural vulnerability & preparedness gaps  
- Real vs ideal response comparisons  

The platform is designed as both:

- **An analytical intelligence tool** for disaster response evaluation  
- **An interactive simulation environment** for humanitarian planning  

---

## Core Features

- **3D Interactive Globe**  
  Visual exploration of hurricane tracks, impacted regions, and funding disparities.

- **Funding Disparity Map**  
  Geospatial visualization of mismatches between humanitarian need and resource allocation.

- **Hurricane Response Plans**  
  ML-driven ideal response plans aligned with UN humanitarian sector priorities.

- **Data Visualization Analytics (SphynxAI)**  
  Dynamic visualizations of impacted regions, severity patterns, and funding gaps, paired with AI-generated analytical explanations.

- **Voice-Based Narrative Agents (ElevenLabs)**  
  Cinematic voice agents narrate survivor accounts, providing human-centered context for quantitative disaster data.

- **Simulation & Comparison Framework**  
  Compare historical, ML-generated, and user-designed allocation strategies under budget constraints.

---

## APIs & Integrations

HurriCare integrates AI and analytics services commonly used in modern decision-support systems:

| API / Service | Used Where | What It Does |
|--------------|-------------|--------------|
| **Databricks SQL API** | Backend | Retrieve hurricanes, funding flows, severity indicators, historical responses |
| **Databricks Vector Search** | Backend | Semantic similarity search across hurricane events (RAG layer) |
| **Google Gemini Pro** | Backend + Frontend | Generate comparative insights & structured survivor narratives |
| **ElevenLabs TTS (`eleven_multilingual_v2`)** | Frontend | Voice-based narrative agents for immersive storytelling |
| **FastAPI** | Backend | Orchestrates simulation & ML inference pipeline |
| **React Three Fiber / Three.js** | Frontend | Real-time 3D globe & simulations |

---

## Data Sources

HurriCare is built entirely on real humanitarian and disaster datasets:

- Humanitarian API (HAPI)  
- United Nations OCHA / Relief datasets  
- IFRC GO Disaster API  
- HDX – Humanitarian Data Exchange  
- OpenFEMA Public Datasets  
- NOAA NHC HURDAT2  
- NOAA Storm Events Database  

These datasets provide:

- Storm tracks & meteorological intensity  
- Hazard & damage indicators  
- Population impact & displacement estimates  
- Funding & humanitarian project data  

---

## 3D / Spatial & Polygon Data

HurriCare uses high-resolution geopolitical boundary datasets to enable **geographically accurate humanitarian visualization**.

| Metric | Value |
|--------|--------|
| Coordinate pairs | **145,285** |
| Country polygons | **211** |
| Countries / territories rendered | **201** |
| Polygon dataset size | **~9.8 MB** |
| Projection | Longitude/Latitude → Sphere |
| Triangulation | `THREE.ShapeUtils.triangulateShape()` |
| Surface Conformation | Custom curvature-conforming subdivision |

### Polygon Modeling Pipeline

Country boundaries are processed through a multi-stage spatial pipeline:

1. **Raw Polygon Ingestion**  
   High-resolution longitude/latitude coordinate datasets.

2. **Spherical Projection**  
   Conversion from planar geographic coordinates → 3D sphere mapping.

3. **Polygon Triangulation**  
   `THREE.ShapeUtils.triangulateShape()` used to convert complex polygons into renderable meshes.

4. **Curvature-Conforming Subdivision**  
   Custom subdivision algorithm prevents visual distortion across spherical surfaces.

### Why Polygon Accuracy Matters for Humanitarian Analysis

Accurate polygon geometry is critical because HurriCare overlays:

- Hurricane impact regions  
- Severity distributions  
- Funding coverage ratios  
- Vulnerability indices  

This ensures:

- No artificial distortion of impacted regions  
- Correct regional severity attribution  
- Reliable spatial funding comparisons  

Flat map projections often introduce bias in visual interpretation; spherical polygon modeling eliminates these distortions.

---

## Core Calculations (Exact Formulas)

HurriCare implements explicit quantitative metrics rather than heuristic scoring.

---

### Coverage Ratio

Measures how well humanitarian funding met estimated need:

```text
coverage_ratio =
    pooled_fund_budget /
    (severity_index × people_in_need × 500)
```

**500 USD** → Approximate UN cost-per-person humanitarian assistance baseline.

**Interpretation**

- 0.0 → Severe underfunding  
- 1.0 → Fully funded response  

---

### Severity Index (0–1)

HurriCare models **humanitarian severity**, not just storm intensity.

Severity is derived from normalized multi-source indicators:

| Component | Example Sources |
|-----------|----------------|
| Infrastructure damage | Storm Events / FEMA proxies |
| Population displaced | OCHA / FEMA |
| Emergency declaration level | FEMA / CERF |
| Health system stress | WHO / PAHO proxies |

Each indicator is:

1. Normalized  
2. Weighted  
3. Aggregated into a composite severity score  

This produces a **continuous severity scale** reflecting real humanitarian conditions.

---

### Impact Score (Simulation Engine)

Evaluates allocation strategies under realistic constraints:

```text
impact_score =
    (1.0 × lives_covered)
  + (0.5 × vulnerability_reduction)
  − (0.3 × unmet_need)
```

**Penalties**

- −5% logistics penalty  
- −3% access / security penalty  

This models real humanitarian trade-offs between coverage, efficiency, and feasibility.

---

## Machine Learning: Ideal Response Model

HurriCare uses an **Explainable Multi-Layer Perceptron (MLP)** for sector prioritization.

| Aspect | Detail |
|--------|--------|
| Model | **ExplainableMLP (PyTorch)** |
| Inputs | **27 engineered features** |
| Hidden Layers | **128 → 64 → 32** |
| Output | Priority distribution over UN-style humanitarian sectors |
| Sectors | WASH, Health, Shelter, Food Security, Protection, Livelihoods, Education, Energy |
| Loss | Soft-label cross-entropy |
| Optimizer | AdamW |
| Explainability | Gradient × Input feature attribution |

### What the Model Learns

The MLP captures nonlinear interactions between:

- Storm characteristics  
- Regional vulnerability  
- Severity indicators  
- Historical allocation signals  

Rather than rule-based prioritization, the model learns **context-dependent humanitarian strategies**.

---

## Relevance to UN Priorities

HurriCare directly supports core humanitarian objectives:

### Evidence-Based Resource Allocation

Quantifies:

- Coverage gaps  
- Funding disparities  
- Sector prioritization trade-offs  

---

### Transparency & Accountability

- Explicit formulas  
- Explainable ML outputs  
- Interpretable severity scoring  

---

### Risk Reduction & Preparedness

Structural vulnerability modeling helps identify:

- Underprepared regions  
- Systemic funding inequities  
- Anticipatory intervention opportunities  

---

## Practical Utility for Humanitarian Decision-Makers

HurriCare augments (not replaces) human judgment by providing:

- Data-driven insights  
- Explainable ML prioritization  
- Interactive spatial reasoning  
- Human-centered narrative context  
