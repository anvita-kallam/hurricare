# 🚀 COMPLETE GUIDE: Start & Test the HurriCare Backend

## Step 1: Open a Terminal

Open your terminal and navigate to the backend:

```bash
cd /Users/navyanori/Desktop/hurricares/hurricare/stormline/backend
```

## Step 2: Start the Backend Server

Run this command:

```bash
python3 -m uvicorn main:app --reload --port 8000
```

You should see output like this:

```
Using local DuckDB backend
INFO:     Will watch for changes in these directories: ['/Users/navyanori/Desktop/hurricares/hurricare/stormline/backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete
```

**If you see this, the server is running!** ✅

## Step 3: Test in a NEW Terminal (Keep the server running)

Open a **new terminal window** (don't close the one with the server)

### Test 1: Check if server is alive
```bash
curl http://localhost:8000/
```

**Expected output:**
```json
{"message":"HurriCare API","version":"1.0.0"}
```

### Test 2: Get all hurricanes
```bash
curl http://localhost:8000/hurricanes | python3 -m json.tool | head -50
```

**Expected output:** Should show 46 hurricanes with data like:
```json
[
  {
    "id": "andrew_1992",
    "name": "Andrew",
    "year": 1992,
    "max_category": 5,
    "track": [...],
    "affected_countries": ["USA", "Bahamas"],
    "estimated_population_affected": 5000000
  },
  ...
]
```

### Test 3: Get projects
```bash
curl http://localhost:8000/projects | python3 -m json.tool | head -50
```

**Expected output:** Should show projects with budget, beneficiaries, etc.

### Test 4: Get coverage analysis
```bash
curl http://localhost:8000/coverage | python3 -m json.tool | head -50
```

**Expected output:** Should show coverage ratios for different regions

### Test 5: Find a matching hurricane
```bash
curl "http://localhost:8000/hurricanes/match?region=USA&category=3"
```

**Expected output:** JSON with matched hurricane details

### Test 6: Get flagged projects (outliers)
```bash
curl http://localhost:8000/flagged | python3 -m json.tool | head -50
```

**Expected output:** Projects flagged as outliers

## Step 4: Open Interactive API Documentation

Open your browser and go to:

### **http://localhost:8000/docs**

You'll see a Swagger UI page where you can:
- See all available endpoints
- Click "Try it out" on any endpoint
- Enter parameters
- Execute requests
- See responses in real-time

This is the **easiest way to test**!

## Step 5: Test Everything at Once

I've created a test script. In your test terminal, run:

```bash
python3 << 'EOF'
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 70)
print("🧪 TESTING HURRICARE API")
print("=" * 70)

# Test 1: Root endpoint
print("\n✓ Test 1: Root endpoint")
response = requests.get(f"{BASE_URL}/")
print(f"  Status: {response.status_code}")
print(f"  Response: {response.json()}")

# Test 2: Hurricanes
print("\n✓ Test 2: Get hurricanes")
response = requests.get(f"{BASE_URL}/hurricanes")
data = response.json()
print(f"  Status: {response.status_code}")
print(f"  Found {len(data)} hurricanes")
print(f"  First hurricane: {data[0]['name']} ({data[0]['year']})")

# Test 3: Projects
print("\n✓ Test 3: Get projects")
response = requests.get(f"{BASE_URL}/projects")
data = response.json()
print(f"  Status: {response.status_code}")
print(f"  Found {len(data)} projects")

# Test 4: Coverage
print("\n✓ Test 4: Get coverage analysis")
response = requests.get(f"{BASE_URL}/coverage")
data = response.json()
print(f"  Status: {response.status_code}")
print(f"  Analyzed {len(data)} regions")

# Test 5: Hurricane matching
print("\n✓ Test 5: Find matching hurricane")
response = requests.get(f"{BASE_URL}/hurricanes/match?region=USA&category=3")
data = response.json()
print(f"  Status: {response.status_code}")
print(f"  Matched: {data.get('name', 'N/A')} (Category {data.get('max_category', 'N/A')})")

# Test 6: Flagged projects
print("\n✓ Test 6: Get flagged projects")
response = requests.get(f"{BASE_URL}/flagged")
data = response.json()
print(f"  Status: {response.status_code}")
print(f"  Found {len(data)} flagged projects")

print("\n" + "=" * 70)
print("✅ ALL TESTS PASSED!")
print("=" * 70)
print("\nBackend is working perfectly! 🎉")
EOF
```

## Summary: The Two-Terminal Setup

**Terminal 1 (Server):**
```bash
cd /Users/navyanori/Desktop/hurricares/hurricare/stormline/backend
python3 -m uvicorn main:app --reload --port 8000
```
→ Keep this running, you'll see log updates here

**Terminal 2 (Testing):**
```bash
# Run tests
curl http://localhost:8000/hurricanes

# Or open browser
open http://localhost:8000/docs
```

## Visual Confirmation

If everything works, you'll see:

✅ Server running message in Terminal 1
✅ JSON responses in Terminal 2 (curl commands)
✅ Interactive UI in browser (http://localhost:8000/docs)

## Troubleshooting

### "Connection refused"
- **Problem**: Server isn't running
- **Solution**: Check Terminal 1, make sure you ran the `uvicorn` command

### "Address already in use"
- **Problem**: Port 8000 is already taken
- **Solution**: `lsof -ti:8000 | xargs kill -9` then restart

### "Module not found"
- **Problem**: Dependencies not installed
- **Solution**: `pip install -r requirements.txt`

### "404 Not Found"
- **Problem**: Wrong endpoint or typo
- **Solution**: Check http://localhost:8000/docs for correct endpoints

## What Each Endpoint Does

| Endpoint | What It Does |
|----------|-------------|
| `GET /` | Shows API is alive |
| `GET /hurricanes` | Lists all hurricanes |
| `GET /projects` | Lists all projects |
| `GET /coverage` | Regional coverage analysis |
| `GET /flagged` | Outlier projects detection |
| `GET /hurricanes/match` | Find matching hurricane |
| `POST /simulate` | Simulate allocation impact |

## Next Steps

1. **Start the server** (Terminal 1)
2. **Test with curl** (Terminal 2) - copy-paste commands above
3. **Or use browser** - open http://localhost:8000/docs
4. **Optional**: Connect to Databricks (see DATABRICKS_INTEGRATION.md)

---

**You're ready! Follow the steps above and let me know what happens.** ✨
