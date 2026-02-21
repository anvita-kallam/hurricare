# StormLine - Geo-Insight Challenge

A full-stack interactive web application that visualizes mismatches between humanitarian need and pooled-fund coverage using real historical hurricanes as scenarios.

## Features

- **3D Interactive Globe**: Rotatable, zoomable globe with Three.js and react-three-fiber
- **Historical Hurricane Visualization**: Animated tracks for 6 major hurricanes (Katrina, Sandy, Maria, Harvey, Haiyan, Dorian)
- **Coverage Analysis**: Visualize gaps between estimated need and pooled fund coverage
- **Project Analysis**: Sortable, filterable table of humanitarian projects
- **Anomaly Detection**: IQR-based flagging of outlier projects (high/low budget per beneficiary)
- **Allocation Simulator**: Interactive tool to simulate resource allocation and compare outcomes

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite
- Three.js via @react-three/fiber
- @react-three/drei for controls
- Tailwind CSS
- Zustand for state management
- Axios for API calls

### Backend
- Python 3.9+
- FastAPI
- DuckDB (in-memory database)
- Pydantic for data validation
- NumPy for statistical analysis

## Project Structure

```
stormline/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Globe.tsx
│   │   │   ├── HurricaneLayer.tsx
│   │   │   ├── CoverageChoropleth.tsx
│   │   │   ├── ProjectTable.tsx
│   │   │   ├── FlaggedProjects.tsx
│   │   │   └── AllocationPanel.tsx
│   │   ├── state/
│   │   │   └── useStore.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── main.py
│   ├── data_loader.py
│   ├── analysis.py
│   ├── schemas.py
│   ├── requirements.txt
│   └── sample_data/
│       ├── hurricanes.json
│       ├── projects.csv
│       └── severity.csv
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd stormline/backend
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the FastAPI server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd stormline/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Data Assumptions

### Hurricane Data
- Hurricane tracks are approximate but geographically accurate
- Based on real historical events from 2005-2019
- Includes: Katrina (2005), Sandy (2012), Maria (2017), Harvey (2017), Haiyan (2013), Dorian (2019)

### Project Data
- **Synthetic but realistic**: Projects are generated based on typical humanitarian response patterns
- **10-30 projects per hurricane**: Varying by hurricane severity and affected population
- **Clusters**: WASH, Shelter, Food Security, Health, Protection, Education, Livelihoods, Energy
- **Pooled Fund Coverage**: Approximately 70-75% of projects are funded through pooled funds
- **Budget Range**: $100,000 - $8,000,000 per project
- **Beneficiaries**: 2,000 - 200,000 per project

### Severity & Needs Data
- **Severity Index**: 0.0 - 1.0 scale (higher = more severe)
- **Estimated People in Need**: Based on affected population and severity
- **Unit Cost**: $500 USD per person for estimated need budget calculation
- **Coverage Ratio**: `pooled_fund_budget / estimated_need_budget`

### Flagging Logic
- Uses Interquartile Range (IQR) method to detect outliers
- Groups projects by (country, cluster) for comparison
- Flags projects where `budget_per_beneficiary` is:
  - **High Outlier**: > Q3 + 1.5 × IQR
  - **Low Outlier**: < Q1 - 1.5 × IQR
- Requires minimum 3 projects per group for statistical validity

### Simulation Model
- **Impact Score Formula**:
  ```
  impact_score = w1 × lives_covered + w2 × vulnerability_reduction × 1000 - w3 × unmet_need
  ```
  Where:
  - `w1 = 1.0` (lives covered weight)
  - `w2 = 0.5` (vulnerability reduction weight)
  - `w3 = 0.3` (unmet need penalty weight)
- **Lives Covered**: `min(allocated_budget / unit_cost, people_in_need)`
- **Vulnerability Reduction**: `coverage × severity_index`
- **Unmet Need**: `max(0, people_in_need - lives_covered) × severity_index`

## API Endpoints

- `GET /hurricanes` - Get all hurricanes
- `GET /projects?hurricane_id={id}` - Get projects (optionally filtered by hurricane)
- `GET /coverage?hurricane_id={id}` - Get coverage analysis
- `GET /flags?hurricane_id={id}` - Get flagged projects
- `POST /simulate_allocation` - Simulate resource allocation impact

## Usage

1. **Select a Hurricane**: Click on a hurricane from the left sidebar to view its data
2. **Explore the Globe**: 
   - Rotate: Click and drag
   - Zoom: Scroll wheel
   - Pan: Right-click and drag
   - Toggle auto-rotate in the header
3. **View Projects**: Switch to the "Projects" tab to see all projects for the selected hurricane
4. **Check Flags**: Switch to the "Flagged" tab to see anomaly-detected projects
5. **Simulate Allocations**: 
   - Switch to the "Simulator" tab
   - Adjust budget sliders for each region
   - Click "Run Simulation" to see predicted impact
   - Compare results to current pooled fund allocation

## Color Coding

### Hurricane Categories
- Category 1: Light Green (#90EE90)
- Category 2: Gold (#FFD700)
- Category 3: Dark Orange (#FF8C00)
- Category 4: Red Orange (#FF4500)
- Category 5: Dark Red (#8B0000)

### Project Flags
- **High Outlier**: Red background - Budget per beneficiary significantly above median
- **Low Outlier**: Yellow background - Budget per beneficiary significantly below median

## Limitations & Future Enhancements

### Current Limitations
- 2D map overlays (severity/coverage) are placeholders - full Deck.gl/Mapbox integration pending
- Globe texture loads from external URL (may need local fallback)
- No authentication (MVP requirement)
- All data is synthetic (as per requirements)

### Potential Enhancements
- Full 2D map overlay integration with Deck.gl or Mapbox GL JS
- More sophisticated simulation models
- Historical comparison views
- Export functionality for reports
- Real-time data updates
- Multi-hurricane comparison mode

## License

This project is created for the Geo-Insight Challenge demonstration purposes.

## Notes

- All data is synthetic but based on realistic patterns from historical humanitarian responses
- Hurricane tracks are approximate representations of actual storm paths
- Budget and beneficiary numbers are simulated for demonstration
- The application prioritizes clarity, interpretability, and reproducibility over complexity
