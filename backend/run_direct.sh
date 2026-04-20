#!/bin/bash
# WildGuard AI v4 — Run WITHOUT virtual environment
# Just run:  bash run_direct.sh

echo ""
echo "══════════════════════════════════════════════"
echo "  WildGuard AI v4 — Direct Install"
echo "══════════════════════════════════════════════"
echo ""

# Fix bcrypt first, then install everything
pip3 install bcrypt==4.0.1 --break-system-packages -q 2>/dev/null || \
pip3 install bcrypt==4.0.1 -q 2>/dev/null || \
pip install bcrypt==4.0.1 -q 2>/dev/null

pip3 install -r requirements.txt --break-system-packages -q 2>/dev/null || \
pip3 install -r requirements.txt -q 2>/dev/null || \
pip install -r requirements.txt -q 2>/dev/null

mkdir -p videos models

echo "✅ Packages installed"
echo ""
echo "Starting server..."
echo ""

python3 -m uvicorn main:app --reload --port 8000
