#!/bin/bash
# ============================================================
# WildGuard AI v4 — Complete Backend Setup
# Run this once:   bash setup.sh
# Then to start:   bash run.sh
# ============================================================

set -e
echo ""
echo "══════════════════════════════════════════════"
echo "  WildGuard AI v4 — Backend Setup"
echo "  5 Elephants · RL Prediction · MySQL"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. Python check ──────────────────────────────
echo "① Checking Python..."
python3 --version || { echo "❌ Python 3 not found"; exit 1; }

# ── 2. Virtual environment ───────────────────────
echo "② Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
echo "   ✓ venv active"

# ── 3. Install dependencies ──────────────────────
echo "③ Installing Python packages..."
pip install --upgrade pip -q
pip install bcrypt==4.0.1 -q          # must install BEFORE passlib
pip install -r requirements.txt -q
echo "   ✓ packages installed"

# ── 4. Create needed folders ─────────────────────
echo "④ Creating folders..."
mkdir -p videos models
echo "   ✓ videos/ models/ ready"

# ── 5. MySQL check ───────────────────────────────
echo "⑤ Checking MySQL..."
if mysql -u root -e "SELECT 1;" 2>/dev/null; then
    echo "   ✓ MySQL connected (no password)"
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS wildguard;" 2>/dev/null
    # Update .env to use empty password
    sed -i.bak 's/^DB_PASSWORD=.*/DB_PASSWORD=/' .env 2>/dev/null || true
elif mysql -u root -p"$DB_PASS" -e "SELECT 1;" 2>/dev/null; then
    echo "   ✓ MySQL connected"
    mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS wildguard;" 2>/dev/null
else
    echo ""
    echo "   ⚠  Cannot connect to MySQL automatically."
    echo "   Open a new terminal and run:"
    echo "      mysql -u root"
    echo "      CREATE DATABASE IF NOT EXISTS wildguard;"
    echo "      exit"
    echo ""
    echo "   Then edit .env and set DB_PASSWORD= (your password)"
    echo ""
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  To start the server:"
echo "     source venv/bin/activate"
echo "     uvicorn main:app --reload --port 8000"
echo ""
echo "  For viva demo (faster GPS — 10s):"
echo "     GPS_INTERVAL_SECONDS=10 uvicorn main:app --reload --port 8000"
echo "══════════════════════════════════════════════"
echo ""
