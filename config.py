"""
Central config: keywords, thresholds, paths, source files.

Plain-language: every part of the pipeline reads its settings from here, so
there is one place to tune the relevance filter, the de-dup threshold, and
where files live.
"""

import os

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "data", "raw")
DATA = os.path.join(ROOT, "data")

# --- the two real Apify scrapes you provided ---
REDDIT_INPUT = "/Users/shruthisenthilkumar/Desktop/reddit_reviews.csv"
FORUM_INPUT = "/Users/shruthisenthilkumar/Desktop/communityforumreview.xlsx"

# --- unified output files ---
CLEANED = os.path.join(DATA, "cleaned_dataset.csv")
SUMMARY = os.path.join(DATA, "summary_stats.json")
SAMPLE_QUOTES = os.path.join(DATA, "sample_quotes.json")
THEMES_OUT = os.path.join(DATA, "theme_clusters.json")
LOG = os.path.join(DATA, "ingestion_log.json")
SOURCE_BREAKDOWN = os.path.join(DATA, "source_breakdown.json")
COUNTRY_DIST = os.path.join(DATA, "country_distribution.json")
TIME_DIST = os.path.join(DATA, "time_distribution.json")
SEGMENT_ANALYSIS = os.path.join(DATA, "segment_analysis.json")

# --- relevance keyword filter (discovery / recommendation topics only) ---
KEYWORDS = [
    "discover weekly", "release radar", "discover", "discovery",
    "recommend", "recommendation", "recommendations", "algorithm",
    "new music", "new artist", "new artists", "repetitive", "repeat",
    "same songs", "same song", "same music", "shuffle", "smart shuffle",
    "playlist fatigue", "can't find new", "cant find new", "stale",
    "predictable", "taste", "familiar artists", "autoplay", "radio",
    "suggestions", "suggest", "song radio", "daily mix", "for you",
]

# Topics to actively discard even if a keyword sneaks in (off-topic noise).
# These only fire when NO discovery keyword is present (see classify.py).
NEGATIVE_HINTS = [
    "login", "log in", "password", "can't log", "billing", "refund",
    "charged", "payment", "crash", "won't open", "device", "bluetooth",
    "car play", "carplay",
]

# Multilingual discovery/recommendation/repetition keywords so we keep relevant
# non-English reviews (LATAM/EU/APAC) instead of dropping them. Latin-script
# languages where a keyword filter is reliable: es, pt, fr, de, it, id, tr.
MULTILINGUAL_KEYWORDS = {
    "es": ["recomendaci", "descubr", "algoritmo", "repetitiv", "mismas canciones",
           "misma cancion", "nueva música", "nueva musica", "lista de reproducc",
           "aleatorio", "aleatoria", "gusto"],
    "pt": ["recomendaç", "recomenda", "descobr", "algoritmo", "repetitiv",
           "mesmas músicas", "mesma música", "nova música",
           "aleatório", "aleatorio", "gosto", "embaralh"],
    "fr": ["recommand", "découvr", "decouvr", "algorithme", "répétitif",
           "repetitif", "mêmes chansons", "nouvelle musique",
           "aléatoire", "aleatoire", "goût", "liste de lecture"],
    "de": ["empfehlung", "entdeck", "algorithmus", "wiederhol", "gleiche lieder",
           "gleichen lieder", "neue musik", "wiedergabeliste", "zufällig",
           "zufall", "geschmack"],
    "it": ["raccomand", "consigli", "scoprire", "scopr", "algoritmo", "ripetitiv",
           "stesse canzoni", "stessa canzone", "nuova musica",
           "casuale", "gusto"],
    "id": ["rekomendasi", "menemukan", "temukan", "algoritma", "berulang",
           "lagu yang sama", "lagu sama", "musik baru", "acak", "selera"],
    "tr": ["öneri", "oneri", "keşfet", "kesfet", "algoritma", "tekrar",
           "aynı şarkı", "ayni sarki", "yeni müzik", "yeni muzik",
           "çalma listesi", "calma listesi", "karışık", "zevk"],
}

MIN_WORDS = 6                 # forum/reddit comments can be short but meaningful
NEAR_DUP_THRESHOLD = 0.92     # cosine similarity above which two texts are "same"

# Category labels for the relevance classifier (Step 4).
CATEGORIES = [
    "discovery_issue", "repetition_issue", "algorithm_mismatch",
    "discovery_positive", "general_music_experience",
]

# Dedup mode: "exact" (keep paraphrases/near-dups) or "exact+near".
DEDUP_MODE = "exact"

# App Store: Spotify id + broad global storefront coverage (US, UK, EU, India,
# LATAM, APAC, MEA). Each storefront returns up to ~500 MOST-RECENT reviews —
# the RSS feed has no historical depth, so App Store expansion is BREADTH only.
APPSTORE_ID = "324684580"
APPSTORE_COUNTRIES = [
    # North America + English core
    "us", "ca", "gb", "ie", "au", "nz",
    # Europe
    "de", "fr", "nl", "be", "ch", "at", "es", "pt", "it", "se", "no", "dk",
    "fi", "pl", "cz", "ro", "gr", "hu", "ua", "ru", "sk", "bg", "hr", "rs",
    # LATAM
    "br", "mx", "ar", "cl", "co", "pe", "ec", "uy", "cr", "gt", "do", "bo", "py",
    # APAC
    "in", "id", "ph", "my", "sg", "th", "vn", "jp", "kr", "tw", "hk", "lk", "bd", "np",
    # MEA
    "za", "ng", "ke", "gh", "eg", "ma", "ae", "sa", "il", "tr", "qa", "kw",
]

# Play Store: package + LOCALE coverage. Each LANGUAGE returns a distinct review
# pool (the country param alone collapses to one global set, but lang does not),
# so locale breadth + deep pagination per locale is what drives both VOLUME and
# HISTORICAL DEPTH. (lang, country, target_depth)
PLAYSTORE_PKG = "com.spotify.music"
PLAYSTORE_LOCALES = [
    ("en", "us", 180000),   # English — deepest pull (longest history)
    ("es", "mx", 40000),    # Spanish (LATAM)
    ("es", "es", 25000),    # Spanish (EU) — partial overlap deduped by reviewId
    ("pt", "br", 40000),    # Portuguese (Brazil)
    ("hi", "in", 30000),    # Hindi / Hinglish (India)
    ("fr", "fr", 30000),    # French (EU)
    ("de", "de", 30000),    # German (EU)
    ("it", "it", 25000),    # Italian (EU)
    ("id", "id", 30000),    # Indonesian (APAC)
    ("tr", "tr", 25000),    # Turkish (MEA/EU)
]
PLAYSTORE_TARGET = 60000    # legacy single-locale fallback
