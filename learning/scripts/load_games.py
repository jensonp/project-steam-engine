#!/usr/bin/env python3
"""
Phase 4: Load Steam Games from JSON into PostgreSQL
Matches the user's modified games table schema in phase4_load_data.sql
"""
import json
import psycopg2
from pathlib import Path

# === CONFIGURATION ===
JSON_PATH = Path.home() / "cs125/backend/data/raw/games.json"
DB_CONFIG = {
    "host": "localhost",
    "port": 8080,
    "database": "steam_collab",  # Use existing database
    "user": "postgres"
}

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
                release_date        VARCHAR(50) NOT NULL,
                estimated_owners    VARCHAR(50),
                peak_ccu            INTEGER DEFAULT 0,
                required_age        INTEGER DEFAULT 0,
                price               DECIMAL(10,2) DEFAULT 0.00,
                dlc_count           INTEGER DEFAULT 0,
                long_description    TEXT, 
                short_description   TEXT,
                support_languages   TEXT,
                full_audio_languages TEXT,
                reviews             TEXT,
                header_image        VARCHAR(500),
                website             VARCHAR(500),
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
                tags                TEXT
            );
        """)
        conn.commit()
        print("✅ Created games table")

def load_games(conn, limit=None):
    """Load games from JSON file."""
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        dataset = json.load(f)
    
    loaded = 0
    skipped = 0
    
    with conn.cursor() as cur:
        for app_id, game in dataset.items():
            try:
                # Extract fields with safe defaults
                cur.execute("""
                    INSERT INTO games (
                        app_id, game_name, release_date, estimated_owners,
                        peak_ccu, required_age, price, dlc_count,
                        long_description, short_description, support_languages,
                        full_audio_languages, reviews, header_image, website,
                        metacritic_score, metacritic_url, user_score,
                        positive_votes, negative_votes, score_rank,
                        achievements, recommendations, average_playtime,
                        median_playtime, developers, publishers,
                        categories, genres, tags
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (app_id) DO NOTHING
                """, (
                    int(app_id),
                    game.get('name', 'Unknown')[:500],
                    game.get('release_date', 'Unknown')[:50],
                    game.get('estimated_owners', '')[:50],
                    int(game.get('peak_ccu', 0) or 0),
                    int(game.get('required_age', 0) or 0),
                    float(game.get('price', 0) or 0),
                    int(game.get('dlc_count', 0) or 0),
                    game.get('detailed_description', ''),
                    game.get('short_description', ''),
                    game.get('supported_languages', ''),
                    game.get('full_audio_languages', ''),
                    game.get('reviews', ''),
                    game.get('header_image', '')[:500],
                    game.get('website', '')[:500] if game.get('website') else '',
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
                ))
                
                loaded += 1
                
                if loaded % 10000 == 0:
                    conn.commit()
                    print(f"  ... loaded {loaded} games")
                
                if limit and loaded >= limit:
                    break
                    
            except Exception as e:
                skipped += 1
                if skipped <= 5:
                    print(f"⚠️  Skipped app {app_id}: {e}")
        
        conn.commit()
    
    print(f"✅ Loaded {loaded} games ({skipped} skipped)")
    return loaded

def create_indexes(conn):
    """Create indexes for common queries."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_games_price ON games (price);
            CREATE INDEX IF NOT EXISTS idx_games_positive ON games (positive_votes);
            CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games (metacritic_score);
        """)
        conn.commit()
        print("✅ Created indexes")

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
        print(f"\n🎮 Top games by positive reviews:")
        for name, pos in top_games:
            print(f"   {name[:40]:40} {pos:,}")

def main():
    print("🚀 Phase 4: Loading Steam Games from JSON")
    print(f"   JSON: {JSON_PATH}")
    print(f"   Database: {DB_CONFIG['database']}")
    print()
    
    # Connect
    conn = psycopg2.connect(**DB_CONFIG)
    
    try:
        # Step 1: Create table
        create_table(conn)
        
        # Step 2: Load data (set limit=1000 for testing, None for all)
        load_games(conn, limit=None)
        
        # Step 3: Create indexes
        create_indexes(conn)
        
        # Step 4: Show stats
        show_stats(conn)
        
    finally:
        conn.close()
    
    print("\n✅ Phase 4 Complete!")

if __name__ == "__main__":
    main()
