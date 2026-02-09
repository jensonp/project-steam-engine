#!/usr/bin/env python3

import json
import psycopg2
import psycopg2.extras
from pathlib import Path
import sys

# === CONFIGURATION ===
JSON_PATH = Path.home() / "Repositories/project-steam-engine/backend/data/raw/games.json"
DB_CONFIG = {
    # "host": "localhost",  # Commented out to use Unix socket (peer auth)
    # "port": 5432,         # Not needed for Unix socket
    "database": "steam_collab",
    "user": "cherryquartzio"
}

# Memory optimization settings
BATCH_SIZE = 1000  # Insert 1000 rows at a time (tune based on available memory)
COMMIT_EVERY = 10000  # Commit every 10k rows

def create_table(conn):
    """Create/recreate the games table matching phase4_load_data.sql schema."""
    with conn.cursor() as cur:
        cur.execute("""
            DROP TABLE IF EXISTS game_tags CASCADE;
            DROP TABLE IF EXISTS tags CASCADE;
            DROP TABLE IF EXISTS user_games CASCADE;
            DROP TABLE IF EXISTS games CASCADE;
            
            CREATE TABLE games (
                app_id              INTEGER PRIMARY KEY,
                game_name           VARCHAR(500) NOT NULL,
                estimated_owners    VARCHAR(50),
                peak_ccu            INTEGER DEFAULT 0,
                required_age        INTEGER DEFAULT 0,
                price               DECIMAL(10,2) DEFAULT 0.00,
                long_description    TEXT, 
                short_description   TEXT,
                support_languages   TEXT,
                full_audio_languages TEXT,
                reviews             TEXT,
                header_image        VARCHAR(500),
                metacritic_score    INTEGER DEFAULT 0,
                metacritic_url      VARCHAR(500),
                user_score          INTEGER DEFAULT 0,
                positive_votes      INTEGER DEFAULT 0,
                negative_votes      INTEGER DEFAULT 0,
                score_rank          INTEGER DEFAULT 0,
                achievements        INTEGER DEFAULT 0,
                recommendations     INTEGER DEFAULT 0,
                average_playtime    INTEGER DEFAULT 0,
                median_playtime     INTEGER DEFAULT 0,
                developers          VARCHAR(500),
                publishers          VARCHAR(500),
                categories          TEXT,
                genres              TEXT,
                tags                TEXT,
                windows_support     BOOLEAN DEFAULT FALSE,
                mac_support         BOOLEAN DEFAULT FALSE,
                linux_support       BOOLEAN DEFAULT FALSE
            );
        """)
        conn.commit()
        print("[Success] Created games table")

def parse_game(app_id, game):
    """Parse a single game entry into a tuple for batch insert."""
    try:
        return (
            int(app_id),
            game.get('name', 'Unknown')[:500],
            game.get('estimated_owners', '')[:50],
            int(game.get('peak_ccu', 0) or 0),
            int(game.get('required_age', 0) or 0),
            float(game.get('price', 0) or 0),
            game.get('detailed_description', ''),
            game.get('short_description', ''),
            game.get('supported_languages', ''),
            game.get('full_audio_languages', ''),
            game.get('reviews', ''),
            game.get('header_image', '')[:500],
            int(game.get('metacritic_score', 0) or 0),
            game.get('metacritic_url', '')[:500] if game.get('metacritic_url') else '',
            int(game.get('user_score', 0) or 0),
            int(game.get('positive', 0) or 0),
            int(game.get('negative', 0) or 0),
            int(game.get('score_rank', 0) or 0) if game.get('score_rank') else 0,
            int(game.get('achievements', 0) or 0),
            int(game.get('recommendations', 0) or 0),
            int(game.get('average_playtime_forever', 0) or 0),
            int(game.get('median_playtime_forever', 0) or 0),
            ','.join(game.get('developers', []))[:500],
            ','.join(game.get('publishers', []))[:500],
            ','.join(game.get('categories', [])),
            ','.join(game.get('genres', [])),
            ','.join(game.get('tags', {}).keys()) if isinstance(game.get('tags'), dict) else ''
        )
    except Exception as e:
        print(f"[Error] Error parsing app {app_id}: {e}", file=sys.stderr)
        return None

def load_games_batch(conn, limit=None):
    """
    Load games using batch inserts for better memory efficiency.
    Uses execute_values for fast batch inserts.
    """
    print(f"📂 Loading JSON from: {JSON_PATH}")
    print(f"   Batch size: {BATCH_SIZE}, Commit every: {COMMIT_EVERY}")
    
    # Load JSON - this still loads entire file
    # For truly massive files, consider ijson library for streaming
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        dataset = json.load(f)
    
    print(f"   Found {len(dataset):,} games in JSON")
    
    loaded = 0
    skipped = 0
    batch = []
    
    insert_sql = """
        INSERT INTO games (
            app_id, game_name, estimated_owners,
            peak_ccu, required_age, price,
            long_description, short_description, support_languages,
            full_audio_languages, reviews, header_image,
            metacritic_score, metacritic_url, user_score,
            positive_votes, negative_votes, score_rank,
            achievements, recommendations, average_playtime,
            median_playtime, developers, publishers,
            categories, genres, tags, windows_support,
            mac_support, linux_support
        ) VALUES %s
        ON CONFLICT (app_id) DO NOTHING
    """
    
    with conn.cursor() as cur:
        for app_id, game in dataset.items():
            parsed = parse_game(app_id, game)
            
            if parsed:
                batch.append(parsed)
                
                # Insert batch when it reaches BATCH_SIZE
                if len(batch) >= BATCH_SIZE:
                    psycopg2.extras.execute_values(cur, insert_sql, batch)
                    loaded += len(batch)
                    batch = []  # Clear batch to free memory
                    
                    # Commit periodically
                    if loaded % COMMIT_EVERY == 0:
                        conn.commit()
                        print(f"  💾 Committed {loaded:,} games")
                    elif loaded % 5000 == 0:
                        print(f"  ... processing {loaded:,} games")
            else:
                skipped += 1
            
            # Check limit
            if limit and loaded >= limit:
                break
        
        # Insert remaining batch
        if batch:
            psycopg2.extras.execute_values(cur, insert_sql, batch)
            loaded += len(batch)
            batch = []  # Clear memory
        
        conn.commit()
    
    print(f"Loaded {loaded:,} games ({skipped:,} skipped)")
    return loaded

def load_games_streaming(conn, limit=None):
    """
    MOST MEMORY EFFICIENT: Stream JSON without loading entire file.
    Requires 'ijson' library: pip install ijson
    
    Only use this if games.json is HUGE (>500MB) and causing crashes.
    """
    try:
        import ijson
    except ImportError:
        print("[Error] ijson not installed. Run: pip install ijson")
        print("   Falling back to batch method...")
        return load_games_batch(conn, limit)
    
    print(f"📂 Streaming JSON from: {JSON_PATH}")
    print(f"   Batch size: {BATCH_SIZE}, Commit every: {COMMIT_EVERY}")
    
    loaded = 0
    skipped = 0
    batch = []
    
    insert_sql = """
        INSERT INTO games (
            app_id, game_name, estimated_owners,
            peak_ccu, required_age, price,
            long_description, short_description, support_languages,
            full_audio_languages, reviews, header_image,
            metacritic_score, metacritic_url, user_score,
            positive_votes, negative_votes, score_rank,
            achievements, recommendations, average_playtime,
            median_playtime, developers, publishers,
            categories, genres, tags, windows_support,
            mac_support, linux_support
        ) VALUES %s
        ON CONFLICT (app_id) DO NOTHING
    """
    
    with open(JSON_PATH, 'rb') as f:
        # Stream JSON objects one at a time
        parser = ijson.kvitems(f, '')
        
        with conn.cursor() as cur:
            for app_id, game in parser:
                parsed = parse_game(app_id, game)
                
                if parsed:
                    batch.append(parsed)
                    
                    if len(batch) >= BATCH_SIZE:
                        psycopg2.extras.execute_values(cur, insert_sql, batch)
                        loaded += len(batch)
                        batch = []
                        
                        if loaded % COMMIT_EVERY == 0:
                            conn.commit()
                            print(f"  💾 Committed {loaded:,} games")
                        elif loaded % 5000 == 0:
                            print(f"  ... processing {loaded:,} games")
                else:
                    skipped += 1
                
                if limit and loaded >= limit:
                    break
            
            # Insert remaining
            if batch:
                psycopg2.extras.execute_values(cur, insert_sql, batch)
                loaded += len(batch)
            
            conn.commit()
    
    print(f"Loaded {loaded:,} games ({skipped:,} skipped)")
    return loaded

def create_indexes(conn):
    """Create indexes for common queries."""
    print("🔍 Creating indexes...")
    with conn.cursor() as cur:
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_games_price ON games (price);
            CREATE INDEX IF NOT EXISTS idx_games_positive ON games (positive_votes);
            CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games (metacritic_score);
        """)
        conn.commit()
        print("Success: Created indexes")

def show_stats(conn):
    """Show summary statistics."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM games")
        total = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM games WHERE price = 0")
        free = cur.fetchone()[0]
        
        cur.execute("SELECT AVG(price) FROM games WHERE price > 0")
        avg_price = cur.fetchone()[0]
        
        cur.execute("""
            SELECT game_name, positive_votes 
            FROM games 
            ORDER BY positive_votes DESC 
            LIMIT 5
        """)
        top_games = cur.fetchall()
        
        print(f"\n📊 Statistics:")
        print(f"   Total games: {total:,}")
        print(f"   Free games: {free:,} ({free*100//total if total > 0 else 0}%)")
        print(f"   Avg paid price: ${avg_price:.2f}" if avg_price else "   Avg paid price: N/A")
        print(f"\nTop games by positive reviews:")
        for name, pos in top_games:
            print(f"   {name[:40]:40} {pos:,}")

def main():
    print("Loading Steam Games... (OPTIMIZED)")
    print(f"  JSON: {JSON_PATH}")
    print(f"  Database: {DB_CONFIG['database']}")
    print()
    
    # Check file size
    file_size_mb = JSON_PATH.stat().st_size / (1024 * 1024)
    print(f"   JSON file size: {file_size_mb:.1f} MB")
    
    # Choose method based on file size
    if file_size_mb > 500:
        print("Attention: Large file detected, using streaming method")
        load_method = load_games_streaming
    else:
        print("Using batch insert method")
        load_method = load_games_batch
    
    print()
    
    # Connect
    conn = psycopg2.connect(**DB_CONFIG)
    
    try:
        # Step 1: Create table
        create_table(conn)
        
        # Step 2: Load data
        # Set limit=1000 for testing, None for all
        load_method(conn, limit=None)
        
        # Step 3: Create indexes
        create_indexes(conn)
        
        # Step 4: Show stats
        show_stats(conn)
        
    finally:
        conn.close()
    
    print("\nGames loaded successfully!")

if __name__ == "__main__":
    main()
