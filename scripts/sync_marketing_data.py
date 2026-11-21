#!/usr/bin/env python3
"""Read only the selected marketing tabs and write a sanitized site snapshot."""

import csv
import html
import io
import json
import os
import re
import statistics
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "site-data.json"
SPREADSHEET_ID = "1Cf7rxfFDhVD4gSqxcojITNKIlPt1qqS7WNMX8lvgSns"
ONLINE_GID = "1088293251"
EVENTS_GID = "1292223053"
SHEET_URL = "https://docs.google.com/spreadsheets/d/{}/export?format=csv&gid={}"
VENUE_LINKS = {
    "Crunch and Brunch": "https://www.instagram.com/crunch.n.brunch/",
    "Between the covers Book Club": "https://www.tiktok.com/@btcbookclubindy",
    "Jetset Modern Pilates": "https://www.tiktok.com/@jetsetpilatessout?lang=en",
    "Seattle Bouldering Project [UD]": "https://www.instagram.com/seattleboulderingproject/",
    "Seattle Bouldering Project [Fremont]": "https://www.instagram.com/seattleboulderingproject/",
    "Seattle Bouldering Project [Poplar]": "https://www.instagram.com/seattleboulderingproject/",
    "Reform Pilates": "https://www.instagram.com/reformpilateslake?igsh=ejVqNTBmcWFka3c2",
    "Bodyrok (Belltown)": "https://www.instagram.com/bodyrokseattle/",
    "Hermvmt": "https://www.instagram.com/hermvmt/",
    "Barre3 [Bellevue]": "https://www.instagram.com/barre3ballard/",
    "Plod Sqad Seattle": "https://www.instagram.com/plodsquadsea/",
    "Solicore [SLU / Capitol Hill]": "https://www.instagram.com/solidcore/",
    "Barre3 [Ballard]": "https://www.instagram.com/barre3ballard/",
    "Barre3 [Capitol Hill]": "https://www.instagram.com/barre3ballard/",
    "CorePower Yoga [Fremont/ Ballard/ Greenlake]": "https://www.instagram.com/corepoweryoga",
}
META_CONFIG = Path.home() / ".config" / "lypid" / "instagram-graph.json"
META_CACHE = Path.home() / ".config" / "lypid" / "instagram-followers-cache.json"
META_GRAPH_VERSION = "v27.0"
META_REFRESH_INTERVAL = timedelta(hours=24)
PUBLIC_PROFILE_CACHE = Path.home() / ".config" / "lypid" / "public-instagram-followers.json"
PUBLIC_PROFILE_REFRESH_INTERVAL = timedelta(hours=24)
PUBLIC_PROFILE_RETRY_INTERVAL = timedelta(hours=1)
PUBLIC_PROFILE_HISTORY = ROOT / "data" / "followers-history.json"


def fetch_rows(gid):
    url = SHEET_URL.format(SPREADSHEET_ID, gid)
    request = Request(url, headers={"User-Agent": "LypidMarketingReadOnlySync/1.0"})
    with urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8-sig")
    rows = [row for row in csv.DictReader(io.StringIO(text)) if (row.get("Name") or "").strip()]
    if not rows:
        raise ValueError(f"Selected worksheet {gid} returned no records")
    return rows


def platform_for(row):
    social = (row.get("Social") or "").lower()
    if "instagram.com" in social:
        return "Instagram"
    if "tiktok.com" in social:
        return "TikTok"
    return None


def number_or_none(value):
    try:
        return float(str(value or "").replace("$", "").replace(",", "").strip())
    except ValueError:
        return None


def public_profile_url(value):
    value = (value or "").strip()
    if not value:
        return ""
    parts = urlsplit(value if "://" in value else f"https://{value.lstrip('/')}" )
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return ""
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))


def load_json_file(path, fallback):
    try:
        with path.open(encoding="utf-8") as source:
            return json.load(source)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return fallback


def write_private_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        path.parent.chmod(0o700)
    except OSError:
        pass
    handle, temporary_path = tempfile.mkstemp(prefix="lypid-", suffix=".json", dir=path.parent)
    try:
        os.fchmod(handle, 0o600)
        with os.fdopen(handle, "w", encoding="utf-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
        os.replace(temporary_path, path)
        try:
            path.chmod(0o600)
        except OSError:
            pass
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise


def instagram_username(profile_url):
    parts = urlsplit(profile_url or "")
    if "instagram.com" not in parts.netloc.lower():
        return ""
    path = parts.path.strip("/")
    if not path or path.split("/")[0].lower() in {"p", "reel", "reels", "stories", "explore"}:
        return ""
    return path.split("/")[0].lstrip("@")


def parse_iso_time(value):
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def query_business_discovery(user_id, access_token, username):
    fields = f"business_discovery.username({username}){{followers_count}}"
    query = urlencode({"fields": fields, "access_token": access_token})
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{user_id}?{query}"
    request = Request(url, headers={"User-Agent": "LypidMarketingReadOnlySync/1.0"})
    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        count = payload.get("business_discovery", {}).get("followers_count")
        return int(count) if count is not None else None
    except Exception:
        return None


def refresh_instagram_followers(rows):
    config = load_json_file(META_CONFIG, {})
    user_id = str(config.get("instagramUserId") or "").strip()
    access_token = str(config.get("accessToken") or "").strip()
    if not user_id or not access_token:
        for row in rows:
            if platform_for(row) == "Instagram":
                row["_followersSource"] = "sheet"
        return {"configured": False, "updatedProfiles": 0, "lastUpdatedAt": ""}

    cache = load_json_file(META_CACHE, {})
    now = datetime.now().astimezone()
    refreshed = 0
    last_updated = ""
    for row in rows:
        if platform_for(row) != "Instagram":
            row["_followersSource"] = "sheet"
            continue
        username = instagram_username(row.get("Social"))
        cached = cache.get(username, {}) if username else {}
        checked_at = parse_iso_time(cached.get("checkedAt"))
        attempted_at = parse_iso_time(cached.get("attemptedAt") or cached.get("checkedAt"))
        fresh = attempted_at and now - attempted_at < META_REFRESH_INTERVAL
        if username and not fresh:
            count = query_business_discovery(user_id, access_token, username)
            attempted_at = now
            cached = {**cached, "attemptedAt": attempted_at.isoformat(timespec="seconds")}
            cache[username] = cached
            if count is not None:
                checked_at = now
                cached.update({"followers": count, "checkedAt": checked_at.isoformat(timespec="seconds")})
                cache[username] = cached
                refreshed += 1
            time.sleep(0.15)
        if cached.get("followers") is not None:
            exact = int(cached["followers"])
            row["Followers (K)"] = str(exact / 1000)
            row["_followersExact"] = exact
            row["_followersSource"] = "meta"
            row["_followersCheckedAt"] = cached.get("checkedAt", "")
            last_updated = max(last_updated, cached.get("checkedAt", ""))
        else:
            row["_followersSource"] = "sheet"

    if any((row.get("_followersSource") == "meta") for row in rows) or cache:
        write_private_json(META_CACHE, cache)
    return {"configured": True, "updatedProfiles": refreshed, "lastUpdatedAt": last_updated}


def platform_stats(rows):
    selected = [row for row in rows if platform_for(row)]
    result = {}
    for platform in ("Instagram", "TikTok"):
        group = [row for row in selected if platform_for(row) == platform]
        followers = [value for row in group if (value := number_or_none(row.get("Followers (K)"))) is not None]
        paid_rates = [value for row in group if (value := number_or_none(row.get("Rate ($)"))) is not None and value > 0]
        result[platform] = {
            "total": len(group),
            "tiers": dict(Counter((row.get("Tier") or "").strip() or "(空白)" for row in group)),
            "phases": dict(Counter((row.get("Phase") or "").strip() or "(空白)" for row in group)),
            "posting": dict(Counter((row.get("Posting timeline") or "").strip() or "(空白)" for row in group)),
            "followersK": {
                "under10": sum(value < 10 for value in followers),
                "from10To50": sum(10 <= value < 50 for value in followers),
                "over50": sum(value >= 50 for value in followers),
                "median": statistics.median(followers) if followers else 0,
            },
            "paidCollaborations": {
                "count": len(paid_rates),
                "recordedAmount": round(sum(paid_rates), 2),
                "averageRate": round(statistics.mean(paid_rates), 2) if paid_rates else 0,
            },
            "topFeatures": Counter((row.get("Feature") or "").strip() or "(空白)" for row in group).most_common(),
            "followersSourceCounts": dict(Counter(row.get("_followersSource", "sheet") for row in group)),
            "followersCheckedAt": max((row.get("_followersCheckedAt", "") for row in group), default=""),
            "creators": [
                {
                    "name": (row.get("Name") or "").strip(),
                    "profileUrl": public_profile_url(row.get("Social")),
                    "followersK": number_or_none(row.get("Followers (K)")),
                    "followersExact": row.get("_followersExact"),
                    "followersSource": row.get("_followersSource", "sheet"),
                    "followersCheckedAt": row.get("_followersCheckedAt", ""),
                    "tier": (row.get("Tier") or "").strip(),
                    "phase": (row.get("Phase") or "").strip(),
                    "feature": (row.get("Feature") or "").strip(),
                }
                for row in group
            ],
        }
    return result


def extract_instagram_followers(profile_url):
    username = instagram_username(profile_url)
    if not username:
        return None
    url = f"https://www.instagram.com/{username}/"
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        with urlopen(request, timeout=8) as response:
            page = response.read().decode("utf-8", "ignore")
        return parse_instagram_follower_count(page)
    except Exception:
        return None


def parse_instagram_follower_count(page):
    page = html.unescape(page)
    structured_count_patterns = (
        r'"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
        r'"(?:follower_count|followers_count|followersCount)"\s*:\s*(\d+)',
    )
    for pattern in structured_count_patterns:
        match = re.search(pattern, page, re.I)
        if match:
            return int(match.group(1))

    class DescriptionParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.descriptions = []

        def handle_starttag(self, tag, attrs):
            if tag.lower() != "meta":
                return
            metadata = {key.lower(): value for key, value in attrs if key and value}
            name = metadata.get("property", metadata.get("name", "")).lower()
            content = metadata.get("content", "")
            if name in {"og:description", "description"} and content:
                self.descriptions.append(content)

    parser = DescriptionParser()
    parser.feed(page)
    for description in parser.descriptions:
        count_match = re.search(
            r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*([KMB])?\s+Followers\b",
            description,
            re.I,
        )
        if not count_match:
            continue
        count = float(count_match.group(1).replace(",", ""))
        multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
        count *= multiplier.get((count_match.group(2) or "").upper(), 1)
        return int(count + 0.5)
    return None


def refresh_public_instagram_followers(rows):
    cache = load_json_file(PUBLIC_PROFILE_CACHE, {})
    now = datetime.now().astimezone()
    updated = 0
    failed = 0
    for row in rows:
        if platform_for(row) != "Instagram":
            row["_followersSource"] = "sheet"
            continue
        if row.get("_followersSource") == "meta" and row.get("_followersExact") is not None:
            continue
        profile_url = public_profile_url(row.get("Social"))
        username = instagram_username(profile_url)
        cache_entry = cache.get(username, {}) if username else {}
        checked_at = parse_iso_time(cache_entry.get("checkedAt"))
        attempted_at = parse_iso_time(cache_entry.get("attemptedAt"))
        has_cached_count = cache_entry.get("followers") is not None
        fresh = (
            checked_at and now - checked_at < PUBLIC_PROFILE_REFRESH_INTERVAL
            if has_cached_count
            else attempted_at and now - attempted_at < PUBLIC_PROFILE_RETRY_INTERVAL
        )
        if username and not fresh:
            exact = extract_instagram_followers(profile_url)
            stamp = now.isoformat(timespec="seconds")
            cache_entry = {**cache_entry, "attemptedAt": stamp}
            if exact is not None:
                cache_entry.update({"followers": exact, "checkedAt": stamp})
                updated += 1
            else:
                failed += 1
            cache[username] = cache_entry
            time.sleep(0.12)
        if cache_entry.get("followers") is not None:
            exact = int(cache_entry["followers"])
            row["Followers (K)"] = str(exact / 1000)
            row["_followersExact"] = exact
            row["_followersSource"] = "public-page"
            row["_followersCheckedAt"] = cache_entry.get("checkedAt", "")
        else:
            row["_followersSource"] = "sheet"
    if cache:
        write_private_json(PUBLIC_PROFILE_CACHE, cache)
    return {"updatedProfiles": updated, "failedProfiles": failed, "source": "public-profile-page"}


def save_follower_history(rows):
    history = load_json_file(PUBLIC_PROFILE_HISTORY, {"days": []})
    day = datetime.now().astimezone().strftime("%Y-%m-%d")
    snapshot = {
        "date": day,
        "instagram": {},
        "tiktok": {},
        "sources": {"instagram": {}, "tiktok": {}},
    }
    for row in rows:
        platform = platform_for(row)
        if platform == "Instagram":
            exact = row.get("_followersExact")
            if exact is not None:
                name = row.get("Name", "").strip()
                snapshot["instagram"][name] = int(exact)
                snapshot["sources"]["instagram"][name] = row.get("_followersSource", "sheet")
        elif platform == "TikTok":
            exact = number_or_none(row.get("Followers (K)"))
            if exact is not None:
                name = row.get("Name", "").strip()
                snapshot["tiktok"][name] = round(exact * 1000)
                snapshot["sources"]["tiktok"][name] = "sheet"
    days = history.setdefault("days", [])
    days = [entry for entry in days if entry.get("date") != day]
    days.append(snapshot)
    history["days"] = days[-90:]
    PUBLIC_PROFILE_HISTORY.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_path = tempfile.mkstemp(prefix="followers-history-", suffix=".json", dir=PUBLIC_PROFILE_HISTORY.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as output_file:
            json.dump(history, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
        os.replace(temporary_path, PUBLIC_PROFILE_HISTORY)
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise
    return history


def normalize_event(row):
    name = re.sub(r"\s+", " ", (row.get("Name") or "").strip())
    return {
        "name": name,
        "eventDetails": (row.get("Event Date") or "").strip(),
        "notes": (row.get("Notes") or "").strip(),
        "profileUrl": VENUE_LINKS.get(name, ""),
    }


def main():
    online_rows = fetch_rows(ONLINE_GID)
    event_rows = fetch_rows(EVENTS_GID)
    follower_sync = refresh_instagram_followers(online_rows)
    public_sync = refresh_public_instagram_followers(online_rows)
    follower_history = save_follower_history(online_rows)
    online_stats = platform_stats(online_rows)
    snapshot = {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "online": {
            "total": sum(value["total"] for value in online_stats.values()),
            "platforms": online_stats,
        },
        "events": [normalize_event(row) for row in event_rows],
        "scope": {"onlineGid": ONLINE_GID, "eventsGid": EVENTS_GID, "readOnly": True},
        "instagramFollowerSync": follower_sync,
        "publicInstagramFollowerSync": public_sync,
        "followerHistoryDays": len(follower_history.get("days", [])),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_path = tempfile.mkstemp(prefix="site-data-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as output_file:
            json.dump(snapshot, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
        os.replace(temporary_path, OUTPUT)
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise
    print(f"Updated {OUTPUT}: {snapshot['online']['total']} IG/TikTok creators, {len(event_rows)} events")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Read-only sheet sync failed: {error}", file=sys.stderr)
        sys.exit(1)
