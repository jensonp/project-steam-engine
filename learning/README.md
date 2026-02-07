# PostgreSQL Learning Roadmap

## Current Status
- [ ] PostgreSQL 18.1 installed
- [ ] Server running (localhost:8080)
- [ ] Learning folder created
- [ ] Create practice database

## Learning Exercises
| File | Topic | Status |
|------|-------|--------|
| `00_tutorial_setup.sql` | PostgreSQL Tutorial Tables | Ready |
| `01_basics.sql` | CREATE, INSERT, SELECT | Ready |
| `02_joins.sql` | JOINs + Collaborative Filtering | Ready |
| `03_indexes.sql` | Indexes (Chapter 11) | Ready |

## Quick Start
```bash
# Create learning database
psql -h localhost -p 8080 -c "CREATE DATABASE steam_learning;"

# Run lesson 1
psql -h localhost -p 8080 -d steam_learning -f learning/sql/01_basics.sql

# Interactive mode
psql -h localhost -p 8080 -d steam_learning
```

## Docs to Read
1. [Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
2. [Queries](https://www.postgresql.org/docs/current/queries.html)
3. [Joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN)
4. [Indexes](https://www.postgresql.org/docs/current/indexes.html)
