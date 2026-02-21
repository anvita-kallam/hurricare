# Quick Start Guide

## Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- npm or yarn

## Quick Setup (5 minutes)

### 1. Backend Setup

```bash
cd stormline/backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main_simple.py
```

The backend will start on `http://localhost:8000`

### 2. Frontend Setup (in a new terminal)

```bash
cd stormline/frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`

### 3. Open the Application

Navigate to `http://localhost:5173` in your browser.

## First Steps

1. **Select a Hurricane**: Click on "Hurricane Katrina" or any other hurricane from the left sidebar
2. **Explore the Globe**: 
   - Click and drag to rotate
   - Scroll to zoom
   - Right-click and drag to pan
3. **View Projects**: Click the "Projects" tab to see all projects
4. **Check Anomalies**: Click the "Flagged" tab to see outlier projects
5. **Play the Game**: 
   - Click the "Game" tab
   - Allocate funding by cluster (Emergency Shelter, Food Security, Health, WASH, Logistics, Early Recovery) per region
   - Adjust sliders for each cluster within each region
   - Click "Validate Plan & Proceed to Stage 2" to see your plan's impact
   - Review the ML Ideal Plan (AI-optimized based on UN principles)
   - Compare with real-world historical response
   - Explore the Comparison Dashboard for detailed mismatch analysis

## Which Backend to Use

- **main_simple.py** (recommended): No DuckDB/scipy needed. Has all endpoints including simulation and leaderboard.
- **main.py**: Full backend with DuckDB—requires `duckdb`, `scipy`, `numpy` in requirements.txt.

**If you see 404 errors** (leaderboard, simulation endpoints): stop any running backend (Ctrl+C), then run `python main_simple.py`.

## Troubleshooting

### Backend won't start
- Make sure Python 3.9+ is installed: `python3 --version`
- Check that all dependencies are installed: `pip list`
- Verify the data files exist in `backend/sample_data/`

### Frontend won't start
- Make sure Node.js is installed: `node --version`
- Try deleting `node_modules` and running `npm install` again
- Check that port 5173 is not in use

### Globe not loading
- Check browser console for errors
- The globe texture loads from an external URL - ensure you have internet connection
- Try refreshing the page

### API errors
- Make sure the backend is running on port 8000
- Check CORS settings in `backend/main.py` if accessing from a different port
- Verify the backend loaded data successfully (check terminal output)

## Data Files

All sample data is in `backend/sample_data/`:
- `hurricanes.json` - Historical hurricane tracks
- `projects.csv` - Synthetic project data
- `severity.csv` - Severity and needs data

These files are automatically loaded when the backend starts.
