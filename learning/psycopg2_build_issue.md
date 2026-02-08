# psycopg2 Build Issue - Diagnosis and Solution

**Date:** 2026-02-07  
**Diagnostic log:** `learning/python_dev_diagnostic.log`

---

## The Problem

When running `pip install psycopg2`, you get:

```
fatal error: Python.h: No such file or directory
   36 | #include <Python.h>
```

---

## Root Cause (Confirmed by Diagnostics)

| Component | Status | Details |
|-----------|--------|---------|
| Python | ✓ Installed | Python 3.14.2 at `/usr/bin/python3` |
| **python3-devel** | **❌ NOT installed** | **THIS IS THE PROBLEM** |
| Python.h | ❌ Missing | Expected at `/usr/include/python3.14/Python.h` but doesn't exist |
| PostgreSQL | ✓ Working | `pg_config` version 18.1 found |
| C Compiler | ✓ Installed | gcc 15.2.1 |

**Conclusion:** You're missing the Python development headers package (`python3-devel`).

---

## Why This Happens

**psycopg2** is a Python PostgreSQL adapter that includes C extensions. To build it from source, pip needs to compile C code, which requires:

1. **Python runtime** ✓ (you have this)
2. **Python development headers** ❌ (you're missing this - includes `Python.h`)
3. **PostgreSQL development tools** ✓ (you have this now)
4. **C compiler** ✓ (you have gcc)

The **python3-devel** package provides header files (`.h`) and other files needed to compile Python C extensions.

---

## Solution Options

### Option 1: Install python3-devel (compile from source)

```bash
# Install Python development headers
sudo dnf install python3-devel

# Verify installation
rpm -q python3-devel

# Check Python.h now exists
ls -l /usr/include/python3.14/Python.h

# Now install psycopg2
pip install psycopg2
```

**Pros:** 
- Compiles for your exact system
- Slightly better performance (marginal)

**Cons:**
- Requires development packages
- Takes longer to install
- More can go wrong

---

### Option 2: Use psycopg2-binary (RECOMMENDED)

```bash
# Install precompiled binary version
pip install psycopg2-binary
```

**Pros:**
- No compilation needed
- No development packages required
- Fast installation
- Works perfectly for 99% of use cases

**Cons:**
- Slightly larger package size
- Not recommended for production (according to psycopg2 docs, though widely used)

---

## Verification Commands

After installing either way, verify it works:

```bash
# Test import
python3 -c "import psycopg2; print(psycopg2.__version__)"

# Test connection (adjust credentials)
python3 -c "
import psycopg2
try:
    conn = psycopg2.connect('dbname=postgres user=cherryquartzio')
    print('✓ Connection successful')
    conn.close()
except Exception as e:
    print(f'Connection failed: {e}')
"
```

---

## Technical Details from Diagnostics

```
Python version: 3.14.2
Python location: /usr/bin/python3 -> python3.14
Expected Python.h location: /usr/include/python3.14/Python.h
Actual Python.h status: Does not exist

python3-devel package: NOT installed
Available package: python3-devel.x86_64 (confirmed in dnf search)

pg_config: Working (PostgreSQL 18.1)
gcc: Working (GCC 15.2.1)
```

---

## Recommended Action

**For your use case (learning/development), use psycopg2-binary:**

```bash
pip install psycopg2-binary
```

This avoids all compilation issues and gets you up and running immediately.

If you later need production deployment and want to compile from source, you can:
1. Install `python3-devel`
2. Uninstall `psycopg2-binary`
3. Install `psycopg2`

---

## Related Files

- Full diagnostic output: `learning/python_dev_diagnostic.log`
- PostgreSQL config guide: `learning/psql_environment_config.md`
