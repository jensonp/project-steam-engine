# load_games.py Memory Optimization Guide

**Problem:** The original script can crash due to high memory usage when loading large JSON files.

---

## Memory Issues in Original Script

### 1. ❌ Loads Entire JSON into Memory (Line 67)

```python
dataset = json.load(f)  # Loads ALL data at once
```

**Impact:** If `games.json` is 500MB, this uses 500MB+ of RAM immediately.

### 2. ❌ Individual INSERT Statements (Line 76-124)

```python
for app_id, game in dataset.items():
    cur.execute("INSERT INTO games ...")  # One at a time
```

**Impact:** 
- Slow (network roundtrip for each row)
- More memory overhead per transaction
- Database has to parse 50,000+ individual statements

### 3. ⚠️ Commits Every 10,000 Rows

```python
if loaded % 10000 == 0:
    conn.commit()
```

**Impact:** Good, but could be tuned better.

---

## Optimizations Applied

### ✅ 1. Batch Inserts with `execute_values()`

**Original (slow):**
```python
for game in games:
    cur.execute("INSERT ... VALUES (%s, %s, ...)", (val1, val2, ...))
```

**Optimized (fast):**
```python
batch = []  # Collect 1000 games
for game in games:
    batch.append((val1, val2, ...))
    if len(batch) >= 1000:
        execute_values(cur, "INSERT ... VALUES %s", batch)
        batch = []  # Clear memory
```

**Benefits:**
- **10-50x faster** - Single network call for 1000 rows
- **Less memory** - Batch is cleared after insert
- **Efficient parsing** - Database parses one statement

### ✅ 2. Configurable Batch Size

```python
BATCH_SIZE = 1000  # Tune based on available memory
```

**Guidelines:**
- **Low memory (4GB):** BATCH_SIZE = 500
- **Normal (8GB+):** BATCH_SIZE = 1000 (default)
- **High memory (16GB+):** BATCH_SIZE = 5000

### ✅ 3. Streaming for HUGE Files (Optional)

Uses `ijson` library to stream JSON without loading entire file:

```python
import ijson
parser = ijson.kvitems(f, '')  # Stream objects one at a time
for app_id, game in parser:    # Never loads entire file
    process(game)
```

**When to use:**
- JSON file > 500MB
- System has < 8GB RAM
- Cursor keeps crashing

**Installation:**
```bash
pip install ijson
```

### ✅ 4. Memory Cleanup

```python
batch = []
# ... add items to batch
execute_values(cur, sql, batch)
batch = []  # Explicitly clear to free memory
```

### ✅ 5. Progress Indicators

```python
if loaded % 5000 == 0:
    print(f"... processing {loaded:,} games")
```

Helps identify where crashes occur.

---

## Comparison

| Method | Speed | Memory | Use Case |
|--------|-------|--------|----------|
| **Original** | 1x (baseline) | High | Small files (<100MB) |
| **Batch Insert** | 10-50x faster | Medium | Most cases (recommended) |
| **Streaming** | 5-20x faster | Very Low | Huge files (>500MB) |

---

## How to Use Optimized Script

### Basic Usage (Recommended)

```bash
# Use optimized version
python learning/scripts/load_games_optimized.py
```

### With Custom Batch Size

Edit the script:
```python
BATCH_SIZE = 500      # For low memory systems
COMMIT_EVERY = 5000   # Commit less frequently
```

### For HUGE Files (Streaming)

```bash
# Install ijson first
pip install ijson

# Script auto-detects file size and uses streaming if >500MB
python learning/scripts/load_games_optimized.py
```

### Test with Limited Data

Edit line 222:
```python
load_method(conn, limit=1000)  # Load only 1000 games for testing
```

---

## Memory Usage Estimates

Assuming 50,000 games in JSON:

| Method | Peak Memory | Time (estimate) |
|--------|-------------|-----------------|
| Original | ~800MB | ~5 minutes |
| Batch (1000) | ~300MB | ~30 seconds |
| Streaming | ~100MB | ~1 minute |

---

## Troubleshooting

### Still Running Out of Memory?

1. **Reduce BATCH_SIZE:**
   ```python
   BATCH_SIZE = 250  # Smaller batches
   ```

2. **Use streaming method:**
   ```bash
   pip install ijson
   # Edit script, line 222: use load_games_streaming
   ```

3. **Limit data for testing:**
   ```python
   load_method(conn, limit=5000)  # Test with 5k games
   ```

4. **Check system memory:**
   ```bash
   free -h  # Linux
   ```

5. **Close other applications** (browser, IDE) while running

### Cursor Still Crashes?

**Option 1: Run in terminal (not in Cursor)**
```bash
# Run script outside Cursor
cd ~/Repositories/project-steam-engine
python learning/scripts/load_games_optimized.py
```

**Option 2: Use even smaller batches**
```python
BATCH_SIZE = 100
COMMIT_EVERY = 1000
```

**Option 3: Split the JSON file**
```bash
# Use jq to split games.json into smaller files
jq -c 'to_entries[0:10000] | from_entries' games.json > games_part1.json
jq -c 'to_entries[10000:20000] | from_entries' games.json > games_part2.json
# Load each part separately
```

---

## Monitoring Memory Usage

### During Script Execution

```bash
# In another terminal, watch memory
watch -n 1 'ps aux | grep python'

# Or use htop
htop
```

### Check JSON File Size First

```bash
ls -lh ~/Repositories/project-steam-engine/backend/data/raw/games.json
```

If >100MB, use optimized version.

---

## Quick Reference

```bash
# Check file size
ls -lh backend/data/raw/games.json

# If < 100MB: use original (works fine)
python learning/scripts/load_games.py

# If 100-500MB: use batch optimized (recommended)
python learning/scripts/load_games_optimized.py

# If > 500MB: install ijson and use streaming
pip install ijson
python learning/scripts/load_games_optimized.py
```

---

## Additional PostgreSQL Optimizations

### Disable Indexes During Load (Advanced)

```sql
-- Before loading
DROP INDEX IF EXISTS idx_games_price;
DROP INDEX IF EXISTS idx_games_positive;
DROP INDEX IF EXISTS idx_games_metacritic;

-- Load data (much faster without indexes)
-- ... run script ...

-- Recreate indexes after
CREATE INDEX idx_games_price ON games (price);
CREATE INDEX idx_games_positive ON games (positive_votes);
CREATE INDEX idx_games_metacritic ON games (metacritic_score);
```

### Use COPY for Maximum Speed (Advanced)

PostgreSQL's `COPY` command is fastest but requires CSV format:

```python
# Export JSON to CSV, then:
cur.copy_from(open('games.csv'), 'games', sep=',')
```

This is 2-5x faster than batch inserts but more complex.

---

## Summary

**Default recommendation:** Use `load_games_optimized.py` with batch inserts. It's **10-50x faster** and uses **60% less memory** than the original.
