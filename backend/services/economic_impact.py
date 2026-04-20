"""
economic_impact.py — WildGuard AI
Quantitative economic impact model for HEC prevention.
Add to backend/services/ folder.

Converts the 34% A/B reduction into actual Rs. savings.
Used by AnalyticsPage.jsx economic tab.
"""

from typing import Dict, List

# ── Wayanad crop loss data (Kerala Agri Dept 2023) ────────────────
CROP_LOSS_PER_HECTARE_RS = {
    "banana":    85_000,    # Rs./hectare
    "paddy":     45_000,
    "coffee":   120_000,
    "sugarcane": 65_000,
    "pepper":    95_000,
    "arecanut":  78_000,
}

# Farm zones monitored by WildGuard AI
MONITORED_FARM_ZONES = [
    {
        "name":         "Sulthan Bathery",
        "area_ha":      12,
        "crops":        ["banana", "paddy"],
        "households":   4,
        "elephant_ids": ["WY_ELE_F01", "WY_ELE_M01"],
    },
    {
        "name":         "Ambalavayal",
        "area_ha":      8,
        "crops":        ["coffee", "banana"],
        "households":   3,
        "elephant_ids": ["WY_ELE_F02"],
    },
    {
        "name":         "Pulpalli",
        "area_ha":      15,
        "crops":        ["paddy", "sugarcane"],
        "households":   4,
        "elephant_ids": ["WY_ELE_M01", "WY_ELE_M02"],
    },
    {
        "name":         "Muttil",
        "area_ha":      6,
        "crops":        ["coffee", "pepper"],
        "households":   2,
        "elephant_ids": ["WY_ELE_F03"],
    },
    {
        "name":         "Kalpetta",
        "area_ha":      10,
        "crops":        ["banana", "arecanut"],
        "households":   3,
        "elephant_ids": ["WY_ELE_F01", "WY_ELE_F02"],
    },
    {
        "name":         "Mananthavady",
        "area_ha":      9,
        "crops":        ["paddy", "coffee"],
        "households":   3,
        "elephant_ids": ["WY_ELE_M02", "WY_ELE_F03"],
    },
]

# Baseline incident statistics (Kerala Forest Dept records)
BASELINE_INCIDENTS_PER_YEAR    = 52    # Wayanad district annual average
AVERAGE_DAMAGE_PER_INCIDENT_RS = 18_500
AVERAGE_MEDICAL_COST_RS        = 12_000  # human injury treatment
AVERAGE_INFRASTRUCTURE_RS      = 8_500   # fence repair, property damage
DEPLOYMENT_COST_PER_YEAR_RS    = 2_40_000  # server, maintenance, sensor nodes

# WildGuard effectiveness
AB_REDUCTION_PERCENT    = 34    # from A/B analysis
EARLY_WARNING_HOURS     = 12    # RL trajectory prediction window


def compute_annual_impact(ab_reduction: float = AB_REDUCTION_PERCENT,
                           incidents_baseline: int = BASELINE_INCIDENTS_PER_YEAR
                           ) -> Dict:
    """
    Compute full annual economic impact of WildGuard AI deployment.

    Args:
        ab_reduction:       Conflict reduction % from A/B analysis (default 34)
        incidents_baseline: Annual incidents without WildGuard

    Returns detailed economic breakdown dict.
    """
    # ── Incidents prevented ────────────────────────────────────────
    incidents_with_ai    = incidents_baseline * (1 - ab_reduction / 100)
    incidents_prevented  = incidents_baseline - incidents_with_ai

    # ── Direct crop loss savings ───────────────────────────────────
    crop_savings = 0
    zone_breakdown = []

    for zone in MONITORED_FARM_ZONES:
        zone_loss_full = sum(
            CROP_LOSS_PER_HECTARE_RS.get(crop, 0)
            for crop in zone["crops"]
        ) * zone["area_ha"]

        # Exposure factor: fraction of crop value at risk per incident
        exposure_factor = 0.12
        zone_loss_prevented = zone_loss_full * exposure_factor * (ab_reduction / 100)
        crop_savings += zone_loss_prevented

        zone_breakdown.append({
            "zone":               zone["name"],
            "area_ha":            zone["area_ha"],
            "crops":              zone["crops"],
            "households":         zone["households"],
            "annual_at_risk_rs":  round(zone_loss_full * exposure_factor),
            "annual_saved_rs":    round(zone_loss_prevented),
        })

    # ── Other economic benefits ────────────────────────────────────
    direct_damage_saved  = incidents_prevented * AVERAGE_DAMAGE_PER_INCIDENT_RS
    medical_cost_saved   = incidents_prevented * 0.15 * AVERAGE_MEDICAL_COST_RS
    infra_cost_saved     = incidents_prevented * 0.40 * AVERAGE_INFRASTRUCTURE_RS
    ranger_time_saved_rs = incidents_prevented * 3500   # Rs. per response averted

    total_benefit = (
        crop_savings +
        direct_damage_saved +
        medical_cost_saved +
        infra_cost_saved +
        ranger_time_saved_rs
    )

    # ── ROI calculation ────────────────────────────────────────────
    net_benefit = total_benefit - DEPLOYMENT_COST_PER_YEAR_RS
    roi_percent = (net_benefit / DEPLOYMENT_COST_PER_YEAR_RS) * 100

    return {
        "summary": {
            "incidents_baseline":     incidents_baseline,
            "incidents_with_ai":      round(incidents_with_ai, 1),
            "incidents_prevented":    round(incidents_prevented, 1),
            "ab_reduction_pct":       ab_reduction,
            "early_warning_hours":    EARLY_WARNING_HOURS,
        },
        "financial": {
            "crop_loss_saved_rs":     round(crop_savings),
            "direct_damage_saved_rs": round(direct_damage_saved),
            "medical_cost_saved_rs":  round(medical_cost_saved),
            "infra_cost_saved_rs":    round(infra_cost_saved),
            "ranger_time_saved_rs":   round(ranger_time_saved_rs),
            "total_benefit_rs":       round(total_benefit),
            "deployment_cost_rs":     DEPLOYMENT_COST_PER_YEAR_RS,
            "net_benefit_rs":         round(net_benefit),
            "roi_percent":            round(roi_percent, 1),
            "payback_months":         round(
                DEPLOYMENT_COST_PER_YEAR_RS / (total_benefit / 12), 1
            ) if total_benefit > 0 else 999,
        },
        "zone_breakdown":  zone_breakdown,
        "human_impact": {
            "dangerous_encounters_prevented": round(incidents_prevented * 0.30),
            "households_protected":           sum(z["households"]
                                                  for z in MONITORED_FARM_ZONES),
            "farm_area_protected_ha":         sum(z["area_ha"]
                                                  for z in MONITORED_FARM_ZONES),
        },
        "formatted": {
            "total_benefit":   _fmt_rs(total_benefit),
            "crop_saved":      _fmt_rs(crop_savings),
            "net_benefit":     _fmt_rs(net_benefit),
            "roi":             f"{roi_percent:.0f}%",
        },
    }


def _fmt_rs(amount: float) -> str:
    """Format rupee amount in Indian number system."""
    if amount >= 1_00_00_000:
        return f"Rs.{amount/1_00_00_000:.1f} Cr"
    elif amount >= 1_00_000:
        return f"Rs.{amount/1_00_000:.1f}L"
    elif amount >= 1_000:
        return f"Rs.{amount/1_000:.1f}K"
    else:
        return f"Rs.{amount:.0f}"


def monthly_loss_estimate(month: int) -> Dict:
    """
    Estimate expected crop loss for a specific month.
    Accounts for seasonal crop calendar (higher in harvest months).
    """
    # Seasonal risk multiplier (1.0 = baseline April)
    seasonal = {
        1: 0.4, 2: 0.5, 3: 0.7, 4: 1.0, 5: 0.9, 6: 0.3,
        7: 0.2, 8: 0.2, 9: 0.3, 10: 0.7, 11: 0.8, 12: 0.6,
    }
    multiplier = seasonal.get(month, 0.5)
    annual     = compute_annual_impact()
    monthly    = annual["financial"]["total_benefit_rs"] / 12

    return {
        "month":            month,
        "seasonal_factor":  multiplier,
        "expected_loss_rs": round(monthly * multiplier),
        "expected_saved_rs": round(monthly * multiplier * AB_REDUCTION_PERCENT / 100),
        "risk_level":       ("HIGH" if multiplier > 0.7 else
                             "MEDIUM" if multiplier > 0.4 else "LOW"),
    }