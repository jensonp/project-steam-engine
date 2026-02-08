# Why Ctrl+Shift+C for Copy in the Terminal?

## Short answer

**Ctrl+C** is reserved by the shell/terminal for **SIGINT** (interrupt): it stops the program running in the foreground. So copy had to use another shortcut. Most Linux terminal emulators use **Ctrl+Shift+C** for copy and **Ctrl+Shift+V** for paste so they don’t conflict with that.

---

## Diagnostic commands (run these in a real Linux terminal)

Run these in your **system terminal** (e.g. GNOME Terminal, Konsole, kitty), not inside an IDE terminal, to see full output. Copy the block and run it, or run line by line.

```bash
# 1. Show terminal type
echo "=== TERM ==="
echo "TERM=$TERM"

# 2. Show control characters (look for intr = ^C — that’s Ctrl+C as “interrupt”)
echo "=== Stty (intr = Ctrl+C) ==="
stty -a

# 3. Show which terminal emulator is running
echo "=== Terminal emulator ==="
ps -o comm= -p $(ps -o ppid= -p $$)

# 4. Optional: show key bindings in current shell (copy-related)
echo "=== Bindings containing copy/C-v/C-c ==="
bind -p 2>/dev/null | grep -iE 'copy|\\C-v|\\C-c' || true
```

To **save the output to a log file** in this directory:

```bash
cd /home/cherryquartzio/Repositories/project-steam-engine/learning

{
  echo "Terminal copy diagnostics — $(date -Iseconds)"
  echo "TERM=$TERM"
  echo "--- stty -a ---"
  stty -a
  echo "--- parent process ---"
  ps -o comm= -p $(ps -o ppid= -p $$)
} > terminal_copy_diagnostic.log 2>&1
```

Then open `terminal_copy_diagnostic.log` to inspect. In `stty -a`, the important part is **`intr = ^C`** — that’s why Ctrl+C can’t be used for copy.
