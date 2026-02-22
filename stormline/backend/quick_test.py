#!/usr/bin/env python3
"""
Quick test to verify the backend is working
Run this AFTER you start the server in another terminal
"""

import requests
import sys
import time

BASE_URL = "http://localhost:8000"

def test_endpoint(name, method, path, **kwargs):
    """Test a single endpoint"""
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{path}", timeout=5, **kwargs)
        else:
            response = requests.post(f"{BASE_URL}{path}", timeout=5, **kwargs)
        
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Status {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Server not running on port 8000"
    except Exception as e:
        return False, str(e)

def main():
    print("\n" + "=" * 75)
    print("  🧪 HURRICARE BACKEND TEST SUITE")
    print("=" * 75)
    
    print("\n⏳ Waiting for server to respond...")
    
    # Wait for server
    for i in range(10):
        try:
            requests.get(f"{BASE_URL}/", timeout=1)
            print("✅ Server is responding!\n")
            break
        except:
            if i < 9:
                time.sleep(0.5)
            else:
                print("\n❌ ERROR: Server not responding on http://localhost:8000")
                print("\nMake sure you've started the server with:")
                print("  python3 -m uvicorn main:app --reload --port 8000")
                sys.exit(1)
    
    tests = [
        ("Root endpoint", "GET", "/", {}),
        ("Get hurricanes", "GET", "/hurricanes", {}),
        ("Get projects", "GET", "/projects", {}),
        ("Get coverage", "GET", "/coverage", {}),
        ("Get flagged projects", "GET", "/flags", {}),
        ("Match hurricane", "GET", "/hurricanes/match?region=USA&category=3", {}),
    ]
    
    results = []
    for i, (name, method, path, kwargs) in enumerate(tests, 1):
        success, data = test_endpoint(name, method, path, **kwargs)
        results.append((name, success))
        
        status = "✅" if success else "❌"
        print(f"{status} Test {i}: {name}")
        
        if success:
            if isinstance(data, list):
                print(f"         Got {len(data)} items")
            elif isinstance(data, dict):
                if "message" in data:
                    print(f"         Message: {data['message']}")
                elif "id" in data:
                    print(f"         Found: {data.get('name', 'N/A')}")
        else:
            print(f"         Error: {data}")
    
    print("\n" + "=" * 75)
    
    # Summary
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    if passed == total:
        print(f"✅ ALL {total}/{total} TESTS PASSED!")
        print("\n🎉 Backend is working perfectly!\n")
        print("Next steps:")
        print("  1. Open http://localhost:8000/docs in your browser")
        print("  2. Click 'Try it out' on any endpoint")
        print("  3. Or use curl: curl http://localhost:8000/hurricanes\n")
        return 0
    else:
        print(f"❌ {total - passed}/{total} tests failed")
        print("\nTroubleshooting:")
        print("  • Is the server running? (check other terminal)")
        print("  • Try: curl http://localhost:8000/")
        print("  • Check server logs for errors\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
