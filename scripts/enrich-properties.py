#!/usr/bin/env python3
"""
Property Enrichment Script for Paul Davis Sales
- Phase 1: Geocode all properties (Nominatim, free)
- Phase 2: Classify properties with Gemini Flash (type, year, units, risk)
- Phase 3: Compute opportunity scores
"""

import os
import sys
import json
import time
import signal
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ── Config ──────────────────────────────────────────────────────────────
_raw_url = os.environ.get("DATABASE_URL", "postgresql://anthonybassi@localhost:5432/pauldavissales_dev")
DB_URL = _raw_url.split("?")[0]  # Strip Prisma-specific query params
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "PaulDavisSales/1.0 (property-enrichment)"

shutdown = False
def handle_signal(sig, frame):
    global shutdown
    print("\n⚠ Graceful shutdown requested...")
    shutdown = True
signal.signal(signal.SIGINT, handle_signal)

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

# ── Database ────────────────────────────────────────────────────────────
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

# ── Phase 1: Geocoding ─────────────────────────────────────────────────
def geocode_properties():
    log("═══ PHASE 1: GEOCODING ═══")
    cur.execute("""
        SELECT id, "addressLine1", city, state, "zipCode", name
        FROM "Property"
        WHERE latitude IS NULL OR longitude IS NULL
    """)
    props = cur.fetchall()
    log(f"Found {len(props)} properties needing geocoding")

    success = 0
    failed = 0
    for i, (pid, addr, city, state, zipcode, name) in enumerate(props):
        if shutdown:
            break

        # Build address query
        query = f"{addr}, {city}, {state} {zipcode}"
        try:
            resp = requests.get(NOMINATIM_URL, params={
                "q": query, "format": "json", "limit": 1
            }, headers={"User-Agent": USER_AGENT}, timeout=10)

            if resp.status_code == 429 or "html" in resp.headers.get("content-type", "").lower():
                log(f"  ⚠ Rate limited, waiting 60s...")
                time.sleep(60)
                continue

            results = resp.json() if resp.status_code == 200 else []

            if not results:
                # Fallback: city + state + zip
                time.sleep(1.2)
                resp = requests.get(NOMINATIM_URL, params={
                    "q": f"{city}, {state} {zipcode}", "format": "json", "limit": 1
                }, headers={"User-Agent": USER_AGENT}, timeout=10)
                results = resp.json() if resp.status_code == 200 and "json" in resp.headers.get("content-type", "") else []

            if results:
                lat = float(results[0]["lat"])
                lon = float(results[0]["lon"])
                cur.execute(
                    'UPDATE "Property" SET latitude = %s, longitude = %s, "updatedAt" = NOW() WHERE id = %s',
                    (lat, lon, pid)
                )
                success += 1
            else:
                failed += 1
                log(f"  ✗ No result: {query[:60]}")
        except Exception as e:
            failed += 1
            log(f"  ✗ Error: {str(e)[:60]}")

        if (i + 1) % 25 == 0:
            conn.commit()
            log(f"  Progress: {i+1}/{len(props)} ({success} geocoded, {failed} failed)")

        time.sleep(1.5)  # Nominatim rate limit

    conn.commit()
    log(f"Phase 1 done: {success} geocoded, {failed} failed out of {len(props)}")
    return success

# ── Phase 2: Gemini Classification ─────────────────────────────────────
def classify_properties():
    log("═══ PHASE 2: GEMINI CLASSIFICATION ═══")
    if not GEMINI_KEY:
        log("⚠ No GEMINI_API_KEY set, skipping classification")
        return 0

    # Get properties needing classification
    cur.execute("""
        SELECT p.id, p.name, p."addressLine1", p.city, p.state, p."zipCode", p.county,
               t.name as territory_name
        FROM "Property" p
        LEFT JOIN "Territory" t ON p."territoryId" = t.id
        WHERE p."propertyType" IS NULL
    """)
    props = cur.fetchall()
    log(f"Found {len(props)} properties needing classification")

    # Get contact/org context for each property
    def get_context(pid):
        cur.execute("""
            SELECT c."fullName", c.title, o.name as org_name, o."orgType"
            FROM "ContactProperty" cp
            JOIN "Contact" c ON cp."contactId" = c.id
            LEFT JOIN "Organization" o ON c."organizationId" = o.id
            WHERE cp."propertyId" = %s
            LIMIT 5
        """, (pid,))
        return cur.fetchall()

    success = 0
    failed = 0
    for i, (pid, name, addr, city, state, zipcode, county, territory) in enumerate(props):
        if shutdown:
            break

        contacts = get_context(pid)
        contact_summary = "; ".join([
            f"{c[0]} ({c[1] or 'no title'}) at {c[2] or 'unknown org'} ({c[3] or 'unknown type'})"
            for c in contacts
        ]) or "No linked contacts"

        prompt = f"""You are a South Florida real estate analyst specializing in property restoration opportunities.
Classify this property based on the information provided.

Property: {name}
Address: {addr}, {city}, {state} {zipcode}
County: {county or territory or 'Unknown'}
Linked contacts/organizations: {contact_summary}

Respond ONLY with valid JSON (no markdown, no code blocks):
{{
  "propertyType": "LUXURY_CONDO"|"HIGH_RISE"|"MID_RISE"|"LOW_RISE"|"TOWNHOME"|"SINGLE_FAMILY"|"HOA_COMMUNITY"|"COMMERCIAL"|"MIXED_USE"|"OTHER",
  "yearBuiltEstimate": integer or null,
  "unitCountEstimate": integer or null,
  "floorsEstimate": integer or null,
  "floodZone": "AE"|"VE"|"X"|"A"|null,
  "coastalExposure": true or false,
  "riskLevel": "HIGH"|"MEDIUM"|"LOW",
  "riskFactors": ["factor1", "factor2"],
  "enrichmentBrief": "2-3 sentence restoration opportunity summary for a Paul Davis salesperson"
}}"""

        try:
            resp = requests.post(GEMINI_URL, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
            }, timeout=30)

            if resp.status_code == 429:
                log(f"  ⚠ Rate limited, waiting 60s...")
                time.sleep(60)
                resp = requests.post(GEMINI_URL, json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
                }, timeout=30)

            if resp.status_code != 200:
                failed += 1
                log(f"  ✗ API error {resp.status_code}: {resp.text[:100]}")
                time.sleep(4.5)
                continue

            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]

            # Clean up response
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

            result = json.loads(text)

            # Map property type
            valid_types = [
                "LUXURY_CONDO", "HIGH_RISE", "MID_RISE", "LOW_RISE", "TOWNHOME",
                "SINGLE_FAMILY", "HOA_COMMUNITY", "COMMERCIAL", "MIXED_USE", "OTHER"
            ]
            prop_type = result.get("propertyType", "OTHER")
            if prop_type not in valid_types:
                prop_type = "OTHER"

            risk_factors = result.get("riskFactors", [])
            if isinstance(risk_factors, list):
                risk_factors_str = "{" + ",".join(f'"{rf}"' for rf in risk_factors) + "}"
            else:
                risk_factors_str = "{}"

            cur.execute("""
                UPDATE "Property" SET
                    "propertyType" = %s,
                    "yearBuilt" = %s,
                    "unitCount" = %s,
                    floors = %s,
                    "floodZone" = %s,
                    "coastalExposure" = %s,
                    "riskLevel" = %s,
                    "riskFactors" = %s,
                    "enrichmentBrief" = %s,
                    "updatedAt" = NOW()
                WHERE id = %s
            """, (
                prop_type,
                result.get("yearBuiltEstimate"),
                result.get("unitCountEstimate"),
                result.get("floorsEstimate"),
                result.get("floodZone"),
                result.get("coastalExposure"),
                result.get("riskLevel", "MEDIUM"),
                risk_factors_str,
                result.get("enrichmentBrief", ""),
                pid
            ))
            success += 1

            if (i + 1) % 5 == 0:
                conn.commit()
                log(f"  Progress: {i+1}/{len(props)} ({success} classified)")

        except json.JSONDecodeError as e:
            failed += 1
            log(f"  ✗ JSON parse error for {name[:40]}: {str(e)[:60]}")
        except Exception as e:
            failed += 1
            log(f"  ✗ Error for {name[:40]}: {str(e)[:60]}")

        time.sleep(4.5)  # ~13 RPM, under 15 RPM limit

    conn.commit()
    log(f"Phase 2 done: {success} classified, {failed} failed out of {len(props)}")
    return success

# ── Phase 3: Opportunity Scores ────────────────────────────────────────
def compute_scores():
    log("═══ PHASE 3: OPPORTUNITY SCORES ═══")

    cur.execute("""
        SELECT p.id, p."unitCount", p."yearBuilt", p."coastalExposure",
               p."floodZone", p."propertyType",
               (SELECT COUNT(*) FROM "ContactProperty" cp WHERE cp."propertyId" = p.id) as contact_count
        FROM "Property" p
    """)
    props = cur.fetchall()

    updated = 0
    for pid, units, year_built, coastal, flood_zone, prop_type, contact_count in props:
        # Unit count factor (0-30)
        unit_score = min((units or 0) / 10, 30) if units else 2

        # Age factor (0-25) — older = more restoration needs
        if year_built:
            age = 2026 - year_built
            age_score = min(age / 2, 25)
        else:
            age_score = 10  # assume mid-age if unknown

        # Coastal/flood factor (0-20)
        risk_score = 0
        if coastal:
            risk_score += 10
        if flood_zone and flood_zone.upper() in ("AE", "VE", "A"):
            risk_score += 10

        # Contact linkage (0-15)
        contact_score = min((contact_count or 0) * 5, 15)

        # Building type (0-10)
        type_scores = {
            "HIGH_RISE": 10, "LUXURY_CONDO": 9, "MID_RISE": 7,
            "COMMERCIAL": 6, "MIXED_USE": 5, "LOW_RISE": 4,
            "HOA_COMMUNITY": 4, "TOWNHOME": 3, "SINGLE_FAMILY": 2, "OTHER": 3
        }
        type_score = type_scores.get(prop_type or "OTHER", 3)

        total = round(unit_score + age_score + risk_score + contact_score + type_score)
        total = max(0, min(100, total))

        cur.execute(
            'UPDATE "Property" SET "opportunityScore" = %s, "updatedAt" = NOW() WHERE id = %s',
            (total, pid)
        )
        updated += 1

    conn.commit()
    log(f"Phase 3 done: {updated} properties scored")

    # Stats
    cur.execute('SELECT COUNT(*) FROM "Property" WHERE "opportunityScore" >= 70')
    high = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "Property" WHERE "opportunityScore" >= 40 AND "opportunityScore" < 70')
    medium = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "Property" WHERE "opportunityScore" < 40')
    low = cur.fetchone()[0]
    cur.execute('SELECT AVG("opportunityScore") FROM "Property"')
    avg = cur.fetchone()[0]

    log(f"  🔴 High opportunity (70+): {high}")
    log(f"  🟠 Medium (40-69): {medium}")
    log(f"  ⚪ Low (<40): {low}")
    log(f"  📊 Average score: {avg:.1f}")
    return updated

# ── Main ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log("🏢 Property Enrichment Script Starting")
    log(f"Database: {DB_URL.split('@')[1] if '@' in DB_URL else DB_URL}")
    log(f"Gemini key: {'set' if GEMINI_KEY else 'NOT SET'}")

    cur.execute('SELECT COUNT(*) FROM "Property"')
    total = cur.fetchone()[0]
    log(f"Total properties: {total}")

    t0 = time.time()
    skip_geocode = "--skip-geocode" in sys.argv
    skip_gemini = "--skip-gemini" in sys.argv

    geocoded = 0
    classified = 0
    if not skip_geocode:
        geocoded = geocode_properties()
    else:
        log("Skipping geocoding (--skip-geocode)")

    if not shutdown and not skip_gemini:
        classified = classify_properties()
    elif skip_gemini:
        log("Skipping Gemini classification (--skip-gemini)")

    if not shutdown:
        scored = compute_scores()

    elapsed = time.time() - t0
    log(f"\n{'='*50}")
    log(f"✅ COMPLETE in {elapsed/60:.1f} minutes")
    if not skip_geocode: log(f"   Geocoded: {geocoded}")
    if not skip_gemini: log(f"   Classified: {classified}")
    log(f"   Scored: {scored}")

    cur.close()
    conn.close()
