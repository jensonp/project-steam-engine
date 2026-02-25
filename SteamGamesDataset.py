import os
import json

dataset = {}
if os.path.exists('backend/data/raw/games.json'):
  with open('backend/data/raw/games.json', 'r', encoding='utf-8') as fin:
    text = fin.read()
    if len(text) > 0:
      dataset = json.loads(text)

for app in dataset:
  appID = app                                         # AppID, unique identifier for each app (string).
  game = dataset[app]             

  name = game['name']                                 # Game name (string).
  releaseDate = game['release_date']                  # Release date (string).
  estimatedOwners = game['estimated_owners']          # Estimated owners (string, e.g.: "0 - 20000").
  peakCCU = game['peak_ccu']                          # Number of concurrent users, yesterday (int).
  required_age = game['required_age']                 # Age required to play, 0 if it is for all audiences (int).
  price = game['price']                               # Price in USD, 0.0 if its free (float).
  dlcCount = game['dlc_count']                        # Number of DLCs, 0 if you have none (int).
  longDesc = game['detailed_description']             # Detailed description of the game (string).
  shortDesc = game['short_description']               # Brief description of the game,
                                                      # does not contain HTML tags (string).
  languages = game['supported_languages']             # Comma-separated enumeration of supporting languages.
  fullAudioLanguages = game['full_audio_languages']   # Comma-separated enumeration of languages with audio support.
  reviews = game['reviews']                           #
  headerImage = game['header_image']                  # Header image URL in the store (string).
  website = game['website']                           # Game website (string).
  supportWeb = game['support_url']                    # Game support URL (string).
  supportEmail = game['support_email']                # Game support email (string).
  supportWindows = game['windows']                    # Does it support Windows? (bool).
  supportMac = game['mac']                            # Does it support Mac? (bool).
  supportLinux = game['linux']                        # Does it support Linux? (bool).
  metacriticScore = game['metacritic_score']          # Metacritic score, 0 if it has none (int).
  metacriticURL = game['metacritic_url']              # Metacritic review URL (string).
  userScore = game['user_score']                      # Users score, 0 if it has none (int).
  positive = game['positive']                         # Positive votes (int).
  negative = game['negative']                         # Negative votes (int).
  scoreRank = game['score_rank']                      # Score rank of the game based on user reviews (string).
  achievements = game['achievements']                 # Number of achievements, 0 if it has none (int).
  recommens = game['recommendations']                 # User recommendations, 0 if it has none (int).
  notes = game['notes']                               # Extra information about the game content (string).
  averagePlaytime = game['average_playtime_forever']  # Average playtime since March 2009, in minutes (int).
  averageplaytime2W = game['average_playtime_2weeks'] # Average playtime in the last two weeks, in minutes (int).
  medianPlaytime = game['median_playtime_forever']    # Median playtime since March 2009, in minutes (int).
  medianPlaytime2W = game['median_playtime_2weeks']   # Median playtime in the last two weeks, in minutes (int).

  packages = game['packages']                         # Available packages.
  for pack in packages:           
    title = pack['title']                             # Package title (string).
    packDesc = pack['description']                    # Package description (string).

    subs = pack['subs']                               # Subpackages.
    for sub in subs:            
      text = sub['text']                              # Subpackage title (string).
      subDesc = sub['description']                    # Subpackage description (string).
      subPrice = sub['price']                         # Subpackage price in USD (float).

  developers = game['developers']                     # Game developers.
  for developer in developers:            
    developerName = developer                         # Developer name (string).

  publishers = game['publishers']                     # Game publishers.
  for publisher in publishers:            
    publisherName = publisher                         # Publisher name (string).

  categories = game['categories']                     # Game categories.
  for category in categories:           
    categoryName = category                           # Category name (string).

  genres = game['genres']                             # Game genres.
  for gender in genres:           
    genderName = gender                               # Gender name (string).

  screenshots = game['screenshots']                   # Game screenshots.
  for screenshot in screenshots:            
    screenshotURL = screenshot                       # Game screenshot URL (string).

  movies = game['movies']                             # Game movies.
  for movie in movies:            
    movieURL = movie                                  # Game movie URL (string).

  tags = game['tags']                                 # Tags.
  for tag in tags:           
    tagKey = tag                                      # Tag key (string, int).

string = ""
first_app_id = list(dataset.keys())[0]
first_game = dataset[first_app_id]
while string != "quit":
    string = input("ENTER A COMMAND:")
    if string == "quit":
        break
    print(f"{first_game[string]}")


# =============================================================================
# Content-Based Filtering Recommendation System
# =============================================================================

# --- Hard Filters -----------------------------------------------------------
# These remove games that are fundamentally incompatible with user preferences.
# Adjust these to match the target user's constraints.

HARD_FILTERS = {
    "platform": "windows",          # "windows", "mac", or "linux"
    "max_price": 60.0,              # Maximum price in USD (None = no limit)
    "max_required_age": 18,         # User's age (filters out games requiring older)
    "language": None,               # e.g. "English" (None = no filter)
    "min_estimated_owners": 0,      # Minimum lower-bound of estimated owners
}


def parse_owner_lower_bound(owners_str):
    """Parse '0 - 20000' -> 0"""
    try:
        return int(owners_str.split('-')[0].strip().replace(',', ''))
    except (ValueError, IndexError):
        return 0


def passes_hard_filters(game, filters):
    """Return True if a game passes all hard filters."""
    # Platform check
    platform = filters.get("platform")
    if platform and not game.get(platform, False):
        return False

    # Price cap
    max_price = filters.get("max_price")
    if max_price is not None and game.get("price", 0) > max_price:
        return False

    # Age gate
    max_age = filters.get("max_required_age")
    if max_age is not None and game.get("required_age", 0) > max_age:
        return False

    # Language
    lang = filters.get("language")
    if lang and lang.lower() not in game.get("supported_languages", "").lower():
        return False

    # Minimum ownership
    min_owners = filters.get("min_estimated_owners", 0)
    if min_owners > 0:
        lower = parse_owner_lower_bound(game.get("estimated_owners", "0"))
        if lower < min_owners:
            return False

    return True


# --- Scoring Weights ---------------------------------------------------------
# Each scoring dimension has a weight; final score = weighted sum, normalized.

SCORE_WEIGHTS = {
    "genres":       0.25,   # Core game identity
    "tags":         0.25,   # Fine-grained community descriptors
    "categories":   0.10,   # Gameplay features (multiplayer, co-op, etc.)
    "price":        0.10,   # Proximity to preferred price
    "review_ratio": 0.10,   # positive / (positive + negative)
    "metacritic":   0.08,   # Critic score (0-100)
    "popularity":   0.05,   # peak_ccu + recommendations
    "developer":    0.04,   # Studio overlap
    "playtime":     0.03,   # avg playtime as engagement proxy
}


def jaccard_similarity(set_a, set_b):
    """Jaccard similarity between two sets (0-1)."""
    if not set_a and not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union) if union else 0.0


def score_game(candidate, user_profile, weights, all_max):
    """
    Score a candidate game against a user profile.
    Returns a dict of component scores and a total weighted score.
    """
    scores = {}

    # --- Set-overlap dimensions (Jaccard) ---
    scores["genres"] = jaccard_similarity(
        set(candidate.get("genres", [])),
        user_profile.get("genres", set())
    )
    scores["tags"] = jaccard_similarity(
        set(candidate.get("tags", {}).keys() if isinstance(candidate.get("tags"), dict) else candidate.get("tags", [])),
        user_profile.get("tags", set())
    )
    scores["categories"] = jaccard_similarity(
        set(candidate.get("categories", [])),
        user_profile.get("categories", set())
    )

    # --- Developer / Publisher overlap ---
    cand_studios = set(candidate.get("developers", [])) | set(candidate.get("publishers", []))
    scores["developer"] = 1.0 if cand_studios & user_profile.get("studios", set()) else 0.0

    # --- Price proximity (closer to preferred price = higher score) ---
    pref_price = user_profile.get("preferred_price", 0)
    cand_price = candidate.get("price", 0)
    max_price_range = all_max.get("price", 60) or 60
    scores["price"] = 1.0 - min(abs(cand_price - pref_price) / max_price_range, 1.0)

    # --- Review ratio ---
    pos = candidate.get("positive", 0)
    neg = candidate.get("negative", 0)
    scores["review_ratio"] = pos / (pos + neg) if (pos + neg) > 0 else 0.0

    # --- Metacritic (normalize 0-100 → 0-1) ---
    scores["metacritic"] = min(candidate.get("metacritic_score", 0) / 100.0, 1.0)

    # --- Popularity (log-scaled peak_ccu + recommendations) ---
    import math
    pop_raw = candidate.get("peak_ccu", 0) + candidate.get("recommendations", 0)
    max_pop = all_max.get("popularity", 1) or 1
    scores["popularity"] = math.log1p(pop_raw) / math.log1p(max_pop) if max_pop > 0 else 0.0

    # --- Playtime (log-scaled) ---
    pt = candidate.get("average_playtime_forever", 0)
    max_pt = all_max.get("playtime", 1) or 1
    scores["playtime"] = math.log1p(pt) / math.log1p(max_pt) if max_pt > 0 else 0.0

    # --- Weighted total ---
    total = sum(weights.get(k, 0) * v for k, v in scores.items())
    return total, scores


def build_user_profile_from_games(game_ids, dataset):
    """
    Build a user profile from a list of game IDs the user has played/liked.
    Aggregates genres, tags, categories, studios, and preferred price.
    """
    profile = {
        "genres": set(),
        "tags": set(),
        "categories": set(),
        "studios": set(),
        "preferred_price": 0.0,
    }
    prices = []
    for gid in game_ids:
        g = dataset.get(str(gid), dataset.get(gid))
        if not g:
            continue
        profile["genres"].update(g.get("genres", []))
        tags = g.get("tags", {})
        profile["tags"].update(tags.keys() if isinstance(tags, dict) else tags)
        profile["categories"].update(g.get("categories", []))
        profile["studios"].update(g.get("developers", []))
        profile["studios"].update(g.get("publishers", []))
        prices.append(g.get("price", 0))
    if prices:
        profile["preferred_price"] = sum(prices) / len(prices)
    return profile


def compute_global_maxes(dataset):
    """Pre-compute global max values for normalization."""
    import math
    max_price = max((g.get("price", 0) for g in dataset.values()), default=60)
    max_pop = max((g.get("peak_ccu", 0) + g.get("recommendations", 0) for g in dataset.values()), default=1)
    max_pt = max((g.get("average_playtime_forever", 0) for g in dataset.values()), default=1)
    return {"price": max_price, "popularity": max_pop, "playtime": max_pt}


def recommend(user_game_ids, dataset, hard_filters, weights, top_n=10):
    """
    Main recommendation function.
    1. Build user profile from liked games.
    2. Hard-filter candidates.
    3. Score & rank remaining games.
    4. Return top N.
    """
    user_profile = build_user_profile_from_games(user_game_ids, dataset)
    all_max = compute_global_maxes(dataset)
    user_set = set(str(gid) for gid in user_game_ids)

    scored = []
    for app_id, game in dataset.items():
        if app_id in user_set:
            continue  # skip games the user already owns
        if not passes_hard_filters(game, hard_filters):
            continue
        total, breakdown = score_game(game, user_profile, weights, all_max)
        scored.append((app_id, game.get("name", "Unknown"), total, breakdown))

    scored.sort(key=lambda x: x[2], reverse=True)
    return scored[:top_n]


# --- Example Usage -----------------------------------------------------------
if dataset:
    # Pick first 3 games as "games the user liked" for demonstration
    sample_liked = list(dataset.keys())[:3]
    print("\n" + "=" * 90)
    print("CONTENT-BASED RECOMMENDATIONS")
    print("=" * 90)
    print(f"User profile built from games: {[dataset[g]['name'] for g in sample_liked]}\n")

    results = recommend(sample_liked, dataset, HARD_FILTERS, SCORE_WEIGHTS, top_n=10)

    print(f"{'Rank':<5} {'Name':40} {'Score':>8}  {'Genres':>7} {'Tags':>6} {'Review':>7} {'Meta':>5}")
    print("-" * 90)
    for i, (aid, name, total, bd) in enumerate(results, 1):
        print(f"{i:<5} {name[:38]:40} {total:8.4f}  "
              f"{bd['genres']:7.3f} {bd['tags']:6.3f} {bd['review_ratio']:7.3f} {bd['metacritic']:5.2f}")


# Print estimated_owners, peak_ccu, and price for first 5 games
app_ids = list(dataset.keys())[:5]

print(f"{'Name':40} {'Estimated Owners':20} {'Peak CCU':10} {'Price'}")
print("-" * 80)

for app_id in app_ids:
    game = dataset[app_id]
    print(f"{game['name'][:38]:40} {game['estimated_owners']:20} {game['peak_ccu']:<10} ${game['price']:.2f}")