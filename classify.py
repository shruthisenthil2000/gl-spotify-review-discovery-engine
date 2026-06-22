"""
Step 4 — Relevance + category classification.

Two stages:
  1. relevance gate (keyword/semantic) -> label = relevant | irrelevant
     A row is relevant if it mentions a discovery/recommendation keyword.
  2. category for relevant rows:
       discovery_issue | discovery_positive | repetition_issue |
       algorithm_mismatch | other

By default categories are assigned by a transparent keyword heuristic (runs
with NO API key). If ANTHROPIC_API_KEY is set and `anthropic` is installed,
classify_claude() upgrades the labels with batched, retried Claude calls.
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

# English keywords, suffix-flexible so plurals/inflections are caught
# ("playlist"->"playlists", "recommend"->"recommended/recommendation").
_KW = re.compile(r"(?<!\w)(" + "|".join(re.escape(k) for k in config.KEYWORDS)
                 + r")\w*", re.IGNORECASE)
# Multilingual discovery terms (substring match — handles inflection/accents).
_ML_TERMS = sorted({t for terms in config.MULTILINGUAL_KEYWORDS.values()
                    for t in terms}, key=len, reverse=True)
_ML = re.compile("|".join(re.escape(t) for t in _ML_TERMS), re.IGNORECASE)

# Multilingual category cues (for non-English rows the English regexes can't read).
_ML_REPEAT = re.compile(r"repetitiv|ripetitiv|répétitif|repetitif|mismas cancion|"
                        r"misma cancion|mesmas música|mesma música|mêmes chansons|"
                        r"gleiche.? lieder|stesse canzoni|stessa canzone|lagu yang sama|"
                        r"lagu sama|aynı şarkı|ayni sarki|berulang|tekrar|wiederhol|"
                        r"embaralh|aleatori|aléatoire|aleatoire|casuale|\bacak\b|karışık", re.I)
_ML_ALGO = re.compile(r"algoritm|algorithm|recomendaci|recomendaç|recomenda|recommand|"
                      r"raccomand|consigli|rekomendasi|öneri|oneri|empfehlung", re.I)
_ML_DISCOVER = re.compile(r"descubr|descobr|découvr|decouvr|scoprire|scopr|entdeck|"
                          r"menemukan|temukan|keşfet|kesfet|nueva música|nova música|"
                          r"nouvelle musique|neue musik|nuova musica|musik baru|"
                          r"yeni mü?zik|descoberta", re.I)
_NEG = re.compile(r"(?<!\w)(" + "|".join(re.escape(k) for k in config.NEGATIVE_HINTS)
                  + r")(?!\w)", re.IGNORECASE)

# "I would highly recommend this app" — the word 'recommend' here is the USER
# endorsing Spotify, NOT the recommendation system. Drop when that's the only signal.
_APP_REC = re.compile(
    r"(highly|would|definitely|really|totally|do|10/10|must|strongly|always)\s+"
    r"recommend|recommend(s|ed|ing)?\s+(it|this|spotify|the app|to\s+\w+|for|"
    r"everyone|anyone|all)", re.I)
_ONLY_REC = {"recommend", "recommendation", "recommendations"}

_REPEAT = re.compile(r"repetit|repeat|same song|same music|over and over|"
                     r"loop|stale|predictab|again and again|monoton", re.I)
_MISMATCH = re.compile(r"(recommend|algorithm|suggestion|taste|for you|radar|"
                       r"daily mix).{0,40}(bad|wrong|trash|terrible|awful|poor|"
                       r"not match|doesn.?t match|nothing like|narrow|off|sucks|"
                       r"random|irrelevant|worse)", re.I)
_POS = re.compile(r"love|great|amazing|spot.?on|perfect|excellent|best|fantastic|"
                  r"awesome|nailed|impressed|enjoy", re.I)
# Weak inclusion signals (spec: keep "I love Spotify", "best music app",
# "great for songs" — general listening experience tied to music consumption).
_MUSIC_EXP = re.compile(r"(?<!\w)(music|songs?|listen(ing)?|artists?|albums?|"
                        r"tracks?|tunes?|audio|podcasts?|genre|vibe|melod)", re.I)
_APP_PRAISE = re.compile(r"(love|great|best|amazing|awesome|excellent|perfect|"
                         r"fantastic|favou?rite|wonderful|good)\W+(spotify|app|music)|"
                         r"(spotify|the app)\W+(is|are)?\s*(the\s+)?(best|great|amazing|"
                         r"awesome|love|excellent|perfect|fantastic)", re.I)
_DISCOVER = re.compile(r"discover|new music|new artist|find new|release radar|"
                       r"discover weekly", re.I)


def is_relevant(text):
    """Balanced recall+precision: keep discovery signals (any language) AND weak
    general music-experience signals; drop only pure login/billing/device/UI noise."""
    t = text or ""
    matched = {m.group(1).lower() for m in _KW.finditer(t)}
    if matched:
        # app-endorsement false positive ("I highly recommend this app") only when
        # that's the ONLY signal -> still keep it as weak music experience below.
        if not (matched <= _ONLY_REC and _APP_REC.search(t)):
            if not (_NEG.search(t) and len(matched) == 1 and len(t.split()) < 12):
                return True
    if _ML.search(t):                       # non-English discovery term
        return True
    # weak inclusion: general music/listening experience (bias to inclusion)
    if _MUSIC_EXP.search(t) or _APP_PRAISE.search(t):
        # but not if it's purely a login/billing/device/crash complaint
        if _NEG.search(t) and not _MUSIC_EXP.search(t):
            return False
        return True
    return False


def categorize_heuristic(text):
    t = text or ""
    if _REPEAT.search(t):
        return "repetition_issue"
    if _MISMATCH.search(t):
        return "algorithm_mismatch"
    if _DISCOVER.search(t) and _POS.search(t):
        return "discovery_positive"
    if _DISCOVER.search(t) or _KW.search(t):
        # discovery-related but not clearly positive -> treat as an issue/neutral
        return "discovery_positive" if _POS.search(t) else "discovery_issue"
    # multilingual fallback (non-English rows the English regexes can't read)
    if _ML_REPEAT.search(t):
        return "repetition_issue"
    if _ML_ALGO.search(t):
        return "algorithm_mismatch"
    if _ML_DISCOVER.search(t):
        return "discovery_issue"
    return "general_music_experience"


# ---------- optional Claude upgrade ----------
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {"results": {"type": "array", "items": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "index": {"type": "integer"},
            "label": {"type": "string", "enum": ["relevant", "irrelevant"]},
            "category": {"type": "string", "enum": config.CATEGORIES},
        },
        "required": ["index", "label", "category"]}}},
    "required": ["results"]}

SYS = ("You label Spotify user reviews for a music-discovery research dataset. "
       "For each review decide if it is genuinely about music discovery / "
       "recommendations / algorithm / repetition / shuffle (label) and pick the "
       "best category.")


def claude_available():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
        return True
    except ImportError:
        return False


def classify_claude(rows, batch=40):
    import anthropic
    client = anthropic.Anthropic()
    labels = {}
    for start in range(0, len(rows), batch):
        chunk = rows[start:start + batch]
        prompt = ["Label each review by `index`.\n"]
        for i, r in enumerate(chunk):
            prompt.append(f"[{i}] {r['text'][:400]}")
        for attempt in range(4):
            try:
                resp = client.messages.create(
                    model=os.environ.get("CLAUDE_MODEL", "claude-opus-4-8"),
                    max_tokens=4000, system=SYS,
                    messages=[{"role": "user", "content": "\n".join(prompt)}],
                    output_config={"format": {"type": "json_schema", "schema": SCHEMA}})
                import json
                for o in json.loads(next(b.text for b in resp.content
                                         if b.type == "text"))["results"]:
                    labels[start + o["index"]] = (o["label"], o["category"])
                break
            except anthropic.RateLimitError:
                time.sleep(10 * (attempt + 1))
            except Exception as ex:
                print(f"  claude batch {start} error: {ex}")
                time.sleep(5)
        print(f"  classified {min(start+batch, len(rows))}/{len(rows)}")
    return labels
