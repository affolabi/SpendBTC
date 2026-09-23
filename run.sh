#!/usr/bin/env bash
set -e

echo "=================================================="
echo "⚡ Starting SpendBTC — The Spending Layer for Bitcoin"
echo "=================================================="

# Run test suite
echo "Running automated test suite..."
python3 tests/test_spendbtc.py

echo ""
echo "All tests passed successfully!"
echo "Launching SpendBTC Web Server on http://localhost:8000"
echo "Press Ctrl+C to stop."
echo "=================================================="

python3 backend/app.py
