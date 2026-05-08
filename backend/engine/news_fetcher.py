import os
import re
import logging
import urllib.request
import urllib.parse
import json

logger = logging.getLogger(__name__)

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
NEWS_API_URL = "https://newsapi.org/v2/everything"

# Financial domain keywords to prioritize
FINANCE_KEYWORDS = {
    "bnpl", "buy-now-pay-later", "fintech", "banking", "credit", "loan",
    "digital", "payment", "acquisition", "startup", "investment", "risk",
    "regulation", "compliance", "fraud", "lending", "mortgage", "insurance",
    "cryptocurrency", "blockchain", "ai", "machine learning", "southeast asia",
    "emerging markets", "millennials", "branch", "mobile banking", "neobank",
}


def extract_keywords(scenario: str) -> str:
    """
    Extract the most financially relevant keywords from the scenario.
    Prioritizes domain-specific financial terms.
    """
    stopwords = {
        "we", "should", "our", "the", "a", "an", "in", "to", "for",
        "of", "and", "or", "is", "are", "will", "would", "could",
        "that", "this", "with", "have", "has", "been", "be", "at",
        "by", "from", "as", "on", "it", "its", "into", "do", "does",
        "within", "whether", "can", "not", "more", "any", "about",
        "next", "quarter", "fully", "launch", "acquire", "shut", "down",
    }

    words = re.findall(r'\b[a-zA-Z][a-zA-Z\-]{2,}\b', scenario.lower())
    words = [w for w in words if w not in stopwords]

    # Score: finance keywords first, then general words
    finance_terms = [w for w in words if w in FINANCE_KEYWORDS]
    other_terms = [w for w in words if w not in FINANCE_KEYWORDS]

    # Build query: prefer finance terms, fill with others
    selected = []
    seen = set()
    for w in finance_terms + other_terms:
        if w not in seen:
            seen.add(w)
            selected.append(w)
        if len(selected) >= 4:
            break

    # If we have very generic terms, add financial context
    query = " ".join(selected)
    if not any(w in FINANCE_KEYWORDS for w in selected):
        query = "fintech " + query

    logger.info(f"News query: '{query}'")
    return query


def fetch_news(scenario: str, max_articles: int = 5) -> str:
    """
    Fetch recent news headlines relevant to the scenario.
    Returns a formatted string to inject into agent prompts.
    Returns empty string if key not set or request fails.
    """
    # Re-read key each call so it picks up runtime env vars
    api_key = os.getenv("NEWS_API_KEY", "")
    if not api_key:
        logger.info("NEWS_API_KEY not set — skipping news injection.")
        return ""

    try:
        query = extract_keywords(scenario)
        if not query:
            return ""

        params = urllib.parse.urlencode({
            "q":        query,
            "language": "en",
            "sortBy":   "relevancy",
            "pageSize": max_articles + 3,  # fetch extra, filter below
            "apiKey":   api_key,
        })

        url = f"{NEWS_API_URL}?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "FinAgent/1.0"})

        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())

        articles = data.get("articles", [])
        if not articles:
            logger.info("No news articles found for query.")
            return ""

        # Filter out removed/irrelevant articles
        filtered = [
            a for a in articles
            if a.get("title") and a["title"] != "[Removed]"
            and a.get("source", {}).get("name")
        ]

        if not filtered:
            logger.info("All articles were filtered out.")
            return ""

        lines = [
            "RELEVANT RECENT NEWS — use this real-world market context to inform your analysis:",
        ]

        for i, article in enumerate(filtered[:max_articles], 1):
            title  = article.get("title", "").strip()
            source = article.get("source", {}).get("name", "Unknown")
            date   = (article.get("publishedAt") or "")[:10]
            desc   = (article.get("description") or "").strip()

            lines.append(f"\n{i}. [{source} | {date}] {title}")
            if desc and len(desc) > 20:
                lines.append(f"   {desc[:180]}{'...' if len(desc) > 180 else ''}")

        result = "\n".join(lines)
        logger.info(f"Injecting {len(filtered[:max_articles])} news articles into agent context.")
        return result

    except Exception as e:
        logger.warning(f"News fetch failed: {e}")
        return ""