#!/usr/bin/env python3
"""
Paul Davis Sales — Free Bulk Enrichment Script
===============================================
Enriches contacts using FREE methods only:
1. Internal cross-referencing (fill gaps from other contacts at same org)
2. Title inference from org type patterns
3. Email domain → company website scraping (phone numbers, titles)
4. Data quality score recalculation

NO paid APIs. Just web scraping + data analysis.
"""

import os
import re
import sys
import json
import time
import random
import signal
import logging
from datetime import datetime
from collections import defaultdict
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://anthonybassi@localhost:5432/pauldavissales_dev?schema=public",
)
SCRAPE_TIMEOUT = 8
SCRAPE_DELAY = (1.0, 2.5)  # Random delay between requests (seconds)
MAX_DOMAINS_TO_SCRAPE = 200  # Cap on unique domains to scrape
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bulk-enrich")

# ── Graceful shutdown ─────────────────────────────────────────────────
STOP = False
def handle_signal(sig, frame):
    global STOP
    log.warning("Shutdown requested — finishing current batch...")
    STOP = True
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

# ── Title inference rules ─────────────────────────────────────────────
ORG_TYPE_TITLES = {
    "PROPERTY_MANAGEMENT": [
        "Property Manager",
        "Regional Manager",
        "Community Manager",
        "Portfolio Manager",
        "Asset Manager",
    ],
    "HOA": [
        "Board Member",
        "HOA President",
        "Board President",
        "Association Manager",
        "Board Director",
    ],
    "CONDO_ASSOCIATION": [
        "Board Member",
        "Association President",
        "Board Director",
        "Association Manager",
        "Condo Manager",
    ],
    "BUILDING_OWNER": [
        "Owner",
        "Building Owner",
        "Property Owner",
        "Managing Partner",
        "Principal",
    ],
    "DEVELOPER": [
        "Development Manager",
        "Project Manager",
        "VP Development",
        "Director of Development",
        "Principal",
    ],
    "INSURANCE": [
        "Insurance Agent",
        "Account Manager",
        "Claims Adjuster",
        "Broker",
        "Agency Owner",
    ],
    "OTHER": [
        "Manager",
        "Director",
        "Supervisor",
        "Coordinator",
    ],
}

# Common title keywords to help match scraped data
TITLE_KEYWORDS = [
    "manager", "director", "president", "owner", "supervisor",
    "vp", "vice president", "chief", "officer", "coordinator",
    "agent", "broker", "adjuster", "administrator", "executive",
    "board", "chairman", "secretary", "treasurer", "member",
    "foreman", "superintendent", "estimator", "consultant",
]

# ── Data quality scoring (mirrors TypeScript logic) ───────────────────
QUALITY_FIELDS = [
    ("firstName", 15),
    ("lastName", 15),
    ("email", 20),
    ("phone", 15),
    ("phoneMobile", 5),
    ("title", 10),
    ("organizationId", 10),
    ("addressLine1", 5),
    ("city", 2),
    ("state", 1),
    ("zipCode", 2),
]

def compute_quality_score(contact: dict) -> int:
    total = 0
    earned = 0
    for key, weight in QUALITY_FIELDS:
        total += weight
        val = contact.get(key)
        if val is not None and val != "":
            earned += weight
    return round((earned / total) * 100) if total > 0 else 0


# ── Phone extraction helpers ──────────────────────────────────────────
PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})"
)

def extract_phones(text: str) -> list[str]:
    """Extract US phone numbers from text."""
    matches = PHONE_RE.findall(text)
    phones = []
    for area, mid, last in matches:
        phone = f"({area}) {mid}-{last}"
        # Skip fax-like numbers and toll-free
        if area not in ("800", "888", "877", "866", "855", "844", "833"):
            phones.append(phone)
    return list(set(phones))


def extract_emails_from_page(text: str) -> list[str]:
    """Extract email addresses from page text."""
    pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
    return list(set(pattern.findall(text)))


def extract_titles_from_page(soup: BeautifulSoup) -> list[dict]:
    """Try to find name+title pairs on a team/about page."""
    results = []
    # Look for common patterns: name in heading, title in paragraph
    for heading in soup.find_all(["h2", "h3", "h4", "h5", "strong"]):
        name_text = heading.get_text(strip=True)
        if not name_text or len(name_text) > 60 or len(name_text) < 3:
            continue
        # Check next sibling for a title
        sibling = heading.find_next_sibling()
        if sibling:
            title_text = sibling.get_text(strip=True)
            if title_text and len(title_text) < 80:
                for kw in TITLE_KEYWORDS:
                    if kw in title_text.lower():
                        results.append({"name": name_text, "title": title_text})
                        break
    return results


# ── Website scraping ──────────────────────────────────────────────────
def scrape_company_website(domain: str) -> dict:
    """Scrape a company website for phone numbers, emails, titles."""
    result = {
        "phones": [],
        "emails": [],
        "titles": [],
        "description": None,
    }

    headers = {"User-Agent": USER_AGENT}

    # Try main page
    for protocol in ["https", "http"]:
        url = f"{protocol}://{domain}"
        try:
            resp = requests.get(url, headers=headers, timeout=SCRAPE_TIMEOUT, allow_redirects=True)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                text = soup.get_text(" ", strip=True)

                # Extract phones from main page
                result["phones"].extend(extract_phones(text))

                # Extract emails
                result["emails"].extend(extract_emails_from_page(text))

                # Get meta description
                meta = soup.find("meta", attrs={"name": "description"})
                if meta and meta.get("content"):
                    result["description"] = meta["content"][:500]

                # Try to find team/about/contact pages
                links = soup.find_all("a", href=True)
                sub_pages = set()
                for link in links:
                    href = link["href"].lower()
                    link_text = link.get_text(strip=True).lower()
                    if any(kw in href or kw in link_text for kw in ["team", "staff", "about", "contact", "people", "leadership"]):
                        full_url = href
                        if href.startswith("/"):
                            full_url = f"{protocol}://{domain}{href}"
                        elif not href.startswith("http"):
                            full_url = f"{protocol}://{domain}/{href}"
                        if domain in full_url:
                            sub_pages.add(full_url)

                # Scrape up to 3 sub-pages
                for sub_url in list(sub_pages)[:3]:
                    try:
                        time.sleep(random.uniform(0.5, 1.0))
                        sub_resp = requests.get(sub_url, headers=headers, timeout=SCRAPE_TIMEOUT, allow_redirects=True)
                        if sub_resp.status_code == 200:
                            sub_soup = BeautifulSoup(sub_resp.text, "html.parser")
                            sub_text = sub_soup.get_text(" ", strip=True)
                            result["phones"].extend(extract_phones(sub_text))
                            result["emails"].extend(extract_emails_from_page(sub_text))
                            result["titles"].extend(extract_titles_from_page(sub_soup))
                    except Exception:
                        pass

                break  # Success, don't try http
        except Exception:
            continue

    # Deduplicate
    result["phones"] = list(set(result["phones"]))[:5]
    result["emails"] = list(set(result["emails"]))[:10]

    return result


# ── Main enrichment logic ─────────────────────────────────────────────
def main():
    log.info("=" * 60)
    log.info("Paul Davis Sales — Free Bulk Enrichment")
    log.info("=" * 60)

    # Strip schema param for psycopg2
    db_url = DB_URL.split("?")[0]
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Phase 0: Baseline stats ───────────────────────────────────────
    log.info("\n📊 Phase 0: Baseline Analysis")
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN "isGoldenRecord" = true THEN 1 END) as golden,
            COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as has_title,
            COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as has_phone,
            COUNT(CASE WHEN "phoneMobile" IS NOT NULL AND "phoneMobile" != '' THEN 1 END) as has_mobile,
            COUNT(CASE WHEN "enrichmentBrief" IS NOT NULL THEN 1 END) as enriched,
            ROUND(AVG("dataQualityScore")::numeric, 1) as avg_quality
        FROM "Contact"
        WHERE "isGoldenRecord" = true AND "lastName" != ''
    """)
    stats = cur.fetchone()
    log.info(f"  Total golden contacts: {stats['total']}")
    log.info(f"  Have title:  {stats['has_title']} ({round(stats['has_title']/max(stats['total'],1)*100, 1)}%)")
    log.info(f"  Have phone:  {stats['has_phone']} ({round(stats['has_phone']/max(stats['total'],1)*100, 1)}%)")
    log.info(f"  Have mobile: {stats['has_mobile']} ({round(stats['has_mobile']/max(stats['total'],1)*100, 1)}%)")
    log.info(f"  AI-enriched: {stats['enriched']}")
    log.info(f"  Avg quality: {stats['avg_quality']}")

    updated_counts = {
        "title_from_crossref": 0,
        "title_from_orgtype": 0,
        "title_from_scrape": 0,
        "phone_from_crossref": 0,
        "phone_from_org": 0,
        "phone_from_scrape": 0,
        "org_website_set": 0,
        "org_phone_set": 0,
        "quality_recalculated": 0,
    }

    # ── Phase 1: Internal cross-referencing ───────────────────────────
    log.info("\n🔗 Phase 1: Internal Cross-Referencing")
    log.info("  Filling gaps from other contacts at the same organization...")

    # Get all contacts grouped by org
    cur.execute("""
        SELECT c.id, c."fullName", c.title, c.phone, c."phoneMobile",
               c."organizationId", c.email, c."firstName", c."lastName",
               c."addressLine1", c.city, c.state, c."zipCode",
               c."dataQualityScore",
               o.name as org_name, o."orgType" as org_type,
               o.phone as org_phone, o.website as org_website, o.domain as org_domain
        FROM "Contact" c
        LEFT JOIN "Organization" o ON c."organizationId" = o.id
        WHERE c."isGoldenRecord" = true AND c."lastName" != ''
        ORDER BY c."organizationId", c."fullName"
    """)
    contacts = cur.fetchall()
    log.info(f"  Loaded {len(contacts)} golden contacts")

    # Group by org
    org_contacts = defaultdict(list)
    for c in contacts:
        if c["organizationId"]:
            org_contacts[c["organizationId"]].append(c)

    # Cross-reference: if any contact at an org has a title/phone, share it
    cross_ref_updates = []
    for org_id, members in org_contacts.items():
        # Find titles in this org
        titles_in_org = [m["title"] for m in members if m.get("title")]
        phones_in_org = [m["phone"] for m in members if m.get("phone")]
        org_phone = members[0].get("org_phone")

        for member in members:
            updates = {}

            # Fill missing title from peers
            if not member.get("title") and titles_in_org:
                # Use the most common title at this org
                title_counts = defaultdict(int)
                for t in titles_in_org:
                    title_counts[t] += 1
                best_title = max(title_counts, key=title_counts.get)
                updates["title"] = best_title
                updated_counts["title_from_crossref"] += 1

            # Fill missing phone from peers or org
            if not member.get("phone"):
                if phones_in_org:
                    # Don't assign someone else's direct line — use org phone instead
                    if org_phone:
                        updates["phone"] = org_phone
                        updated_counts["phone_from_org"] += 1
                elif org_phone:
                    updates["phone"] = org_phone
                    updated_counts["phone_from_org"] += 1

            if updates:
                cross_ref_updates.append((member["id"], updates))

    # Apply cross-reference updates
    for contact_id, updates in cross_ref_updates:
        set_clauses = []
        values = []
        for key, val in updates.items():
            set_clauses.append(f'"{key}" = %s')
            values.append(val)
        set_clauses.append('"updatedAt" = NOW()')
        values.append(contact_id)
        cur.execute(
            f'UPDATE "Contact" SET {", ".join(set_clauses)} WHERE id = %s',
            values,
        )

    conn.commit()
    log.info(f"  ✅ Cross-referenced: {len(cross_ref_updates)} contacts updated")
    log.info(f"     Titles from peers: {updated_counts['title_from_crossref']}")
    log.info(f"     Phones from org: {updated_counts['phone_from_org']}")

    if STOP:
        log.warning("Stopped after Phase 1")
        return finish(conn, cur, contacts, updated_counts)

    # ── Phase 2: Title inference from org type ────────────────────────
    log.info("\n🏷️  Phase 2: Title Inference from Organization Type")

    # Reload contacts missing titles
    cur.execute("""
        SELECT c.id, c."fullName", c.title,
               o."orgType" as org_type, o.name as org_name
        FROM "Contact" c
        LEFT JOIN "Organization" o ON c."organizationId" = o.id
        WHERE c."isGoldenRecord" = true
          AND c."lastName" != ''
          AND (c.title IS NULL OR c.title = '')
          AND o."orgType" IS NOT NULL
    """)
    no_title = cur.fetchall()
    log.info(f"  {len(no_title)} contacts still missing titles with known org type")

    title_updates = []
    for c in no_title:
        org_type = c["org_type"]
        if org_type in ORG_TYPE_TITLES:
            # Use first (most common) title for this org type
            inferred_title = ORG_TYPE_TITLES[org_type][0]
            title_updates.append((c["id"], inferred_title))
            updated_counts["title_from_orgtype"] += 1

    for contact_id, title in title_updates:
        cur.execute(
            'UPDATE "Contact" SET title = %s, "updatedAt" = NOW() WHERE id = %s',
            (title, contact_id),
        )

    conn.commit()
    log.info(f"  ✅ Inferred titles for {len(title_updates)} contacts")

    # Break down by org type
    type_counts = defaultdict(int)
    for c in no_title:
        if c["org_type"] in ORG_TYPE_TITLES:
            type_counts[c["org_type"]] += 1
    for otype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        assigned_title = ORG_TYPE_TITLES.get(otype, ["?"])[0]
        log.info(f"     {otype}: {count} → \"{assigned_title}\"")

    if STOP:
        log.warning("Stopped after Phase 2")
        return finish(conn, cur, contacts, updated_counts)

    # ── Phase 3: Website scraping for phones ──────────────────────────
    log.info("\n🌐 Phase 3: Website Scraping (free — no APIs)")

    # Get unique email domains that we don't have org phones for
    cur.execute("""
        SELECT DISTINCT
            o.id as org_id, o.name as org_name, o.domain, o.website, o.phone as org_phone,
            SPLIT_PART(c.email, '@', 2) as email_domain,
            COUNT(c.id) as contact_count
        FROM "Contact" c
        JOIN "Organization" o ON c."organizationId" = o.id
        WHERE c."isGoldenRecord" = true
          AND c."lastName" != ''
          AND c.email IS NOT NULL
          AND c.email != ''
        GROUP BY o.id, o.name, o.domain, o.website, o.phone, SPLIT_PART(c.email, '@', 2)
        ORDER BY COUNT(c.id) DESC
    """)
    org_domains = cur.fetchall()
    log.info(f"  Found {len(org_domains)} unique org-domain pairs")

    # Filter to domains worth scraping (no phone, not generic email providers)
    generic_domains = {
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
        "icloud.com", "me.com", "mail.com", "msn.com", "live.com",
        "comcast.net", "att.net", "verizon.net", "bellsouth.net",
        "sbcglobal.net", "cox.net", "charter.net", "earthlink.net",
    }

    scrape_targets = []
    for row in org_domains:
        domain = row.get("domain") or row.get("email_domain") or ""
        if not domain or domain in generic_domains:
            continue
        # Skip if org already has a phone
        if row.get("org_phone"):
            continue
        scrape_targets.append({
            "org_id": row["org_id"],
            "org_name": row["org_name"],
            "domain": domain,
            "contact_count": row["contact_count"],
        })

    # Sort by contact count (scrape highest-value first)
    scrape_targets.sort(key=lambda x: -x["contact_count"])
    scrape_targets = scrape_targets[:MAX_DOMAINS_TO_SCRAPE]

    log.info(f"  Scraping {len(scrape_targets)} company websites (highest-value first)...")

    scraped = 0
    scrape_errors = 0
    for i, target in enumerate(scrape_targets):
        if STOP:
            log.warning(f"  Stopped scraping at {i}/{len(scrape_targets)}")
            break

        domain = target["domain"]
        log.info(f"  [{i+1}/{len(scrape_targets)}] Scraping {domain} ({target['org_name']}, {target['contact_count']} contacts)...")

        try:
            data = scrape_company_website(domain)

            org_updates = {}
            if data["phones"]:
                org_updates["phone"] = data["phones"][0]
                updated_counts["org_phone_set"] += 1
            if not target.get("website") and data.get("description"):
                org_updates["website"] = f"https://{domain}"
                updated_counts["org_website_set"] += 1

            # Update org record
            if org_updates:
                set_clauses = []
                values = []
                for key, val in org_updates.items():
                    set_clauses.append(f'"{key}" = %s')
                    values.append(val)
                set_clauses.append('"updatedAt" = NOW()')
                values.append(target["org_id"])
                cur.execute(
                    f'UPDATE "Organization" SET {", ".join(set_clauses)} WHERE id = %s',
                    values,
                )

                # Also set phone on contacts at this org that are missing phone
                if "phone" in org_updates:
                    cur.execute(
                        """UPDATE "Contact"
                           SET phone = %s, "updatedAt" = NOW()
                           WHERE "organizationId" = %s
                             AND "isGoldenRecord" = true
                             AND (phone IS NULL OR phone = '')""",
                        (org_updates["phone"], target["org_id"]),
                    )
                    affected = cur.rowcount
                    updated_counts["phone_from_scrape"] += affected
                    if affected:
                        log.info(f"    ✅ Found phone {org_updates['phone']} → applied to {affected} contacts")

            # Try to match scraped titles to contacts
            if data["titles"]:
                for title_info in data["titles"]:
                    scraped_name = title_info["name"].lower()
                    scraped_title = title_info["title"][:100]  # Truncate
                    # Try to find matching contact
                    cur.execute(
                        """UPDATE "Contact"
                           SET title = %s, "updatedAt" = NOW()
                           WHERE "organizationId" = %s
                             AND "isGoldenRecord" = true
                             AND (title IS NULL OR title = '')
                             AND (LOWER("fullName") = %s
                                  OR LOWER("firstName") || ' ' || LOWER("lastName") = %s)""",
                        (scraped_title, target["org_id"], scraped_name, scraped_name),
                    )
                    if cur.rowcount > 0:
                        updated_counts["title_from_scrape"] += cur.rowcount
                        log.info(f"    ✅ Matched title: {title_info['name']} → \"{scraped_title}\"")

            conn.commit()
            scraped += 1

        except Exception as e:
            scrape_errors += 1
            log.debug(f"    ❌ Error: {e}")
            conn.rollback()

        # Rate limit
        time.sleep(random.uniform(*SCRAPE_DELAY))

    log.info(f"  ✅ Scraped {scraped} sites, {scrape_errors} errors")
    log.info(f"     Phones found: {updated_counts['org_phone_set']} orgs → {updated_counts['phone_from_scrape']} contacts")
    log.info(f"     Titles matched: {updated_counts['title_from_scrape']}")

    return finish(conn, cur, contacts, updated_counts)


def finish(conn, cur, original_contacts, updated_counts):
    """Phase 4: Recalculate quality scores and print summary."""
    log.info("\n📈 Phase 4: Recalculating Data Quality Scores")

    # Reload all golden contacts with current data
    cur.execute("""
        SELECT id, "firstName", "lastName", email, phone, "phoneMobile",
               title, "organizationId", "addressLine1", city, state, "zipCode",
               "dataQualityScore"
        FROM "Contact"
        WHERE "isGoldenRecord" = true AND "lastName" != ''
    """)
    all_contacts = cur.fetchall()

    batch = []
    for c in all_contacts:
        new_score = compute_quality_score(dict(c))
        old_score = c.get("dataQualityScore") or 0
        if abs(new_score - old_score) > 0.5:
            batch.append((new_score, c["id"]))

    if batch:
        for score, cid in batch:
            cur.execute(
                'UPDATE "Contact" SET "dataQualityScore" = %s, "updatedAt" = NOW() WHERE id = %s',
                (score, cid),
            )
        conn.commit()
        updated_counts["quality_recalculated"] = len(batch)
        log.info(f"  ✅ Recalculated quality scores for {len(batch)} contacts")
    else:
        log.info("  No quality score changes needed")

    # ── Final stats ───────────────────────────────────────────────────
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as has_title,
            COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as has_phone,
            COUNT(CASE WHEN "phoneMobile" IS NOT NULL AND "phoneMobile" != '' THEN 1 END) as has_mobile,
            ROUND(AVG("dataQualityScore")::numeric, 1) as avg_quality
        FROM "Contact"
        WHERE "isGoldenRecord" = true AND "lastName" != ''
    """)
    final = cur.fetchone()

    log.info("\n" + "=" * 60)
    log.info("✅ ENRICHMENT COMPLETE — SUMMARY")
    log.info("=" * 60)
    log.info(f"  Total golden contacts: {final['total']}")
    log.info("")
    log.info("  TITLES:")
    log.info(f"    Now have title:    {final['has_title']} ({round(final['has_title']/max(final['total'],1)*100, 1)}%)")
    log.info(f"    From cross-ref:    +{updated_counts['title_from_crossref']}")
    log.info(f"    From org type:     +{updated_counts['title_from_orgtype']}")
    log.info(f"    From web scraping: +{updated_counts['title_from_scrape']}")
    log.info("")
    log.info("  PHONES:")
    log.info(f"    Now have phone:    {final['has_phone']} ({round(final['has_phone']/max(final['total'],1)*100, 1)}%)")
    log.info(f"    From org phone:    +{updated_counts['phone_from_org']}")
    log.info(f"    From web scraping: +{updated_counts['phone_from_scrape']}")
    log.info("")
    log.info(f"  AVG QUALITY SCORE:   {final['avg_quality']} (scores recalculated: {updated_counts['quality_recalculated']})")
    log.info(f"  Org phones set:      +{updated_counts['org_phone_set']}")
    log.info(f"  Org websites set:    +{updated_counts['org_website_set']}")
    log.info("=" * 60)

    cur.close()
    conn.close()
    log.info("Done! 🎉")


if __name__ == "__main__":
    main()
