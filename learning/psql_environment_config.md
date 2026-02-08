# PostgreSQL Environment Variables Configuration Guide

## Current Status (from diagnostics)

**No PostgreSQL environment variables are currently set.**

This means psql is using defaults:
- **PGHOST:** `/var/run/postgresql` (Unix socket)
- **PGPORT:** `5432`
- **PGDATABASE:** Your system username (`cherryquartzio` in real terminal)
- **PGUSER:** Your system username (`cherryquartzio` in real terminal)

---

## Important PostgreSQL Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PGHOST` | Database server host/socket | `localhost` or Unix socket |
| `PGPORT` | Database server port | `5432` |
| `PGDATABASE` | Default database name | System username |
| `PGUSER` | Database username/role | System username |
| `PGPASSWORD` | Password (NOT recommended) | None |
| `PGSSLMODE` | SSL connection mode | `prefer` |
| `PGDATA` | Data directory (for server) | Varies by install |
| `PSQL_HISTORY` | Location of command history | `~/.psql_history` |
| `PAGER` | Pager for output | Auto-detect (usually `less`) |
| `PSQL_EDITOR` | Editor for `\e` command | `$EDITOR` or `vi` |

---

## Diagnostic Commands

### Check current PostgreSQL environment variables

```bash
# Show all PG* variables
env | grep '^PG'

# Check specific variables
echo "PGHOST=$PGHOST"
echo "PGPORT=$PGPORT"
echo "PGDATABASE=$PGDATABASE"
echo "PGUSER=$PGUSER"
echo "PGSSLMODE=$PGSSLMODE"
```

### Test connection with current settings

```bash
# Show what psql would connect to
psql -c '\conninfo'

# Or just see the connection attempt
psql
```

### Check PostgreSQL version and server status

```bash
# Client version
psql --version

# Server status (systemd)
systemctl status postgresql

# Or check if process is running
ps aux | grep postgres
```

---

## How to Set Environment Variables

### Option 1: Temporary (current shell session only)

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=mydb
export PGUSER=myuser
export PGSSLMODE=require
```

Test it:
```bash
psql -c '\conninfo'
```

### Option 2: Permanent (add to shell config)

Edit `~/.bashrc` (or `~/.bash_profile` or `~/.zshrc` depending on your shell):

```bash
# Open your shell config
nano ~/.bashrc

# Add these lines at the end:
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=cherryquartzio
export PGUSER=cherryquartzio
# export PGPASSWORD=mysecret  # NOT RECOMMENDED - see below

# Save and reload
source ~/.bashrc
```

### Option 3: Per-project (.envrc with direnv)

If you have `direnv` installed, create `.envrc` in your project:

```bash
# Create .envrc in project root
cat > .envrc <<'EOF'
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=steam_engine
export PGUSER=cherryquartzio
EOF

# Allow direnv to use it
direnv allow
```

Now these vars are set automatically when you `cd` into the project.

---

## Recommended Configuration for Your Project

Based on your earlier errors, here's what you should set:

```bash
# Add to ~/.bashrc
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=cherryquartzio    # or 'postgres' to connect to default DB
export PGUSER=cherryquartzio        # matches your PostgreSQL role
```

Then:
```bash
source ~/.bashrc
psql  # should connect without errors now
```

---

## Security Note: PGPASSWORD

**DO NOT** use `PGPASSWORD` in environment variables or config files. It's insecure.

**Better alternatives:**

### 1. Use `.pgpass` file (recommended)

Create `~/.pgpass` with format: `hostname:port:database:username:password`

```bash
# Create .pgpass
cat > ~/.pgpass <<'EOF'
localhost:5432:*:cherryquartzio:your_password_here
EOF

# Set correct permissions (required)
chmod 600 ~/.pgpass
```

Now psql will automatically use the password from this file.

### 2. Use peer authentication (local Unix socket)

For local development, edit `/etc/postgresql/<version>/main/pg_hba.conf`:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             cherryquartzio                          peer
```

This lets you connect without a password when your OS user matches the PostgreSQL role.

---

## Verification Commands

After setting environment variables, run these to verify:

```bash
# 1. Check variables are set
env | grep '^PG'

# 2. Test connection
psql -c '\conninfo'

# 3. Check what database you're connected to
psql -c 'SELECT current_database(), current_user;'

# 4. Full connection test
psql -c 'SELECT version();'
```

---

## Common Scenarios

### Scenario 1: Connect to a specific database without setting PGDATABASE

```bash
# Still uses PGUSER, PGHOST, PGPORT from environment
psql -d my_other_database
```

### Scenario 2: Override environment variables temporarily

```bash
# Override PGHOST just for this command
PGHOST=remote.server.com psql -d mydb
```

### Scenario 3: Connect as a different user

```bash
# Override PGUSER
psql -U postgres -d postgres
```

---

## Troubleshooting

### Problem: "role does not exist"
- Set `PGUSER` to match an existing PostgreSQL role
- Or create the role: `sudo -u postgres createuser cherryquartzio`

### Problem: "database does not exist"
- Set `PGDATABASE` to an existing database (e.g., `postgres`)
- Or create it: `createdb cherryquartzio`

### Problem: Environment variables not taking effect
- Reload your shell: `source ~/.bashrc`
- Or start a new terminal session
- Check they're actually set: `echo $PGUSER`

---

## Save Diagnostic Output

To save a snapshot of your PostgreSQL environment:

```bash
cd /home/cherryquartzio/Repositories/project-steam-engine/learning

{
  echo "PostgreSQL Environment - $(date)"
  echo "=== Environment Variables ==="
  env | grep '^PG'
  echo ""
  echo "=== Connection Info ==="
  psql -c '\conninfo' 2>&1
  echo ""
  echo "=== Server Version ==="
  psql -c 'SELECT version();' 2>&1
} > psql_env_snapshot.log
```

---

## Your Project Configuration (.envrc)

**IMPORTANT:** Your project already has `.envrc` in the root, but it has issues:

```bash
# Current .envrc (INCORRECT PORT!)
export PGHOST=localhost
export PGPORT=8080        # ❌ WRONG - PostgreSQL uses 5432, not 8080
export PGDATABASE=steam_learning
export PGUSER=postgres
```

**Should be:**

```bash
export PGHOST=localhost
export PGPORT=5432        # ✓ Correct PostgreSQL port
export PGDATABASE=steam_learning
export PGUSER=cherryquartzio  # or 'postgres' if that's your role
```

If you have `direnv` installed, just fix the port and run:
```bash
direnv allow
```

If you don't have `direnv`, manually source it:
```bash
source .envrc
```

---

## Quick Reference Card

```bash
# Set up for local development (add to ~/.bashrc)
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=cherryquartzio
export PGUSER=cherryquartzio

# Reload config
source ~/.bashrc

# Verify
psql -c '\conninfo'

# Create password file (optional)
echo "localhost:5432:*:cherryquartzio:password" > ~/.pgpass
chmod 600 ~/.pgpass
```
