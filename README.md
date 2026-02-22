# HurriCare

HurriCare is an interactive decision-support platform for humanitarian hurricane response.  
The system combines geospatial visualization, machine learning, and large-scale data engineering to analyze historical disasters, identify funding disparities, and simulate resource allocation strategies.

---

## Overview

HurriCare enables data-driven exploration of:

- Historical hurricane events  
- Humanitarian need vs funding coverage  
- Sector-level allocation strategies  
- Current location-based funding and resource disparity mapping  

The platform is designed as both:

- **An analytical intelligence tool** for disaster response evaluation  
- **An interactive simulation environment** for resource and allocation planning  

---

## Core Features

- **3D Interactive Globe**  
  Visual exploration of hurricane tracks, impacted regions, and disparities in resources and funding.

- **Funding Disparity Map**  
  Geospatial visualization of mismatches between humanitarian need and resource allocation.

- **Hurricane Response Plans**  
  ML-driven ideal response plans tailored to hurricane characteristics.

- **Data Visualization Analytics (SphynxAI)**  
  Dynamic visualizations of impacted regions, funding disparities, and humanitarian need, accompanied by natural-language explanations.

- **Voice-Based Narrative Agents (ElevenLabs)**  
  AI voice agents provide immersive, human-centered context by narrating personal accounts from affected individuals with each hurricane scenario.

- **Simulation & Comparison Framework**  
  Compare user-designed, ML-generated, and historical allocation strategies.

---

## Tech Stack

### Frontend

- React 18 + TypeScript  
- Vite  
- Three.js / react-three-fiber  
- Tailwind CSS  
- Zustand (state management)  
- Axios (API communication)  

---

### Backend

- Python  
- FastAPI  
- DuckDB  
- NumPy / Pandas  
- PyTorch  

---

### Data & Infrastructure

- Databricks  
- DuckDB (low-latency analytics)  
- External Humanitarian & Disaster APIs  

---

### Sector Prioritization and Ideal Response Plan Creation Model

A **multi-layer feedforward neural network (MLP)** predicts sector priorities based on disaster context.

**Model Inputs**

- Storm intensity & metadata  
- Population impact estimates  
- Regional severity indicators  
- Historical allocation signals  
- Vulnerability proxies  

**Model Outputs**

- Sector priority scores and probabilities used to generate response plans (WASH, Health, Shelter, etc.)

---

## Databricks Usage

Databricks functions as the **data engineering and retrieval backbone** of HurriCare.

---

### Unified Data Lakehouse

Databricks supports:

- Multi-source dataset ingestion  
- Schema normalization  
- Large-scale joins & aggregations  

This enables consistent cross-dataset analytics.

---

### Vector Search (RAG Layer)

Databricks Vector Search enables:

- Semantic retrieval of historical hurricanes  
- Similarity search across disaster events  
- Contextual grounding for simulations  

This allows HurriCare to:

- Identify comparable past disasters  
- Surface relevant allocation patterns  

---

### Hybrid Architecture

- **Databricks → large-scale processing & retrieval**  
- **DuckDB → low-latency analytical queries**

This architecture balances scalability and responsiveness.

---

## Data Sources

HurriCare is built entirely on real humanitarian and disaster datasets.

- Humanitarian API (HAPI)  
- United Nations OCHA API  
- International Federation of the Red Cross (IFRC Go API)  
- HDX – Humanitarian Data Exchange  
- OpenFEMA Public Datasets  
- NOAA NHC HURDAT2  
- NOAA Storm Events Database  

These datasets provide:

- Storm tracks & intensity  
- Hazard & damage records  
- Population impact estimates  
- Funding & project data  

---

## System Architecture

HurriCare follows a modular decision-support architecture integrating:

- Large-scale data engineering  
- Machine learning inference  
- Low-latency analytics  
- Interactive geospatial visualization  
- Voice-based AI agents  
- AI-generated visual analytics  

---

## Relevance to UN Priorities

HurriCare is directly aligned with core UN humanitarian objectives.

---

### Evidence-Based Resource Allocation

The platform enables systematic analysis of:

- Funding disparities  
- Coverage gaps  
- Sector prioritization trade-offs  

This supports more rational, data-driven decision-making.

---

### Transparency & Accountability

Project-level analytics and anomaly detection help identify:

- Allocation inefficiencies  
- Unusual funding patterns  
- Coverage imbalances  

This enhances interpretability of funding outcomes.

---

### Risk Reduction & Preparedness

Hurricane Readiness Scoring provides:

- Early vulnerability signals  
- Comparative regional risk assessment  
- Decision support for mitigation strategies  

---

### Strategic Planning Support

Simulation capabilities allow UN officials to:

- Evaluate alternative allocation strategies  
- Compare predicted vs historical responses  
- Analyze consequences of budget constraints  

---

## Practical Utility for UN Officials

HurriCare functions as a decision-support and analytical intelligence tool.

- Identify underfunded high-need regions  
- Evaluate sector prioritization strategies  
- Explore historical disaster precedents  
- Integrate quantitative analytics with narrative context  

Rather than replacing human judgment, HurriCare augments it with:

- Data-driven insights  
- Interpretable ML outputs  
- Interactive exploration tools  
- Voice-based situational awareness  
