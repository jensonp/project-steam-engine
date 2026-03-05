#!/usr/bin/env python3
"""Scan a markdown file for malformed tables and report issues."""

import re
import sys

def check_tables(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    in_code_block = False
    issues = []
    table_start = None
    table_lines = []
    col_count = None

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Track code blocks to skip them
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            # If we were in a table, end it
            if table_start is not None:
                _check_table(table_start, table_lines, col_count, issues)
                table_start = None
                table_lines = []
                col_count = None
            continue

        if in_code_block:
            continue

        is_table_line = '|' in stripped and not stripped.startswith('>')

        if is_table_line:
            if table_start is None:
                table_start = i
                table_lines = [(i, stripped)]
                # Count columns from header
                col_count = _count_cols(stripped)
            else:
                table_lines.append((i, stripped))
        else:
            if table_start is not None:
                _check_table(table_start, table_lines, col_count, issues)
                table_start = None
                table_lines = []
                col_count = None

    # Check any remaining table at EOF
    if table_start is not None:
        _check_table(table_start, table_lines, col_count, issues)

    return issues


def _count_cols(line):
    """Count the number of columns in a table row."""
    stripped = line.strip().strip('|')
    return len(stripped.split('|'))


def _is_separator(line):
    """Check if a line is a valid table separator (e.g., |---|---|)."""
    stripped = line.strip().strip('|')
    cells = [c.strip() for c in stripped.split('|')]
    return all(re.match(r'^:?-{1,}:?$', c) for c in cells if c)


def _check_table(start_line, table_lines, expected_cols, issues):
    """Validate a table block and report issues."""
    if len(table_lines) < 2:
        # A single pipe line isn't necessarily a table, but flag if it looks like one
        line_no, content = table_lines[0]
        if content.count('|') >= 2:
            issues.append((line_no, "SINGLE_ROW",
                           f"Possible incomplete table (only 1 row): {content[:80]}"))
        return

    # Check for separator row (should be the 2nd line of the table)
    _, second_line = table_lines[1]
    has_separator = _is_separator(second_line)

    if not has_separator:
        issues.append((start_line, "MISSING_SEPARATOR",
                       f"Table starting at line {start_line} has no separator row "
                       f"(line {table_lines[1][0]}): {second_line[:80]}"))

    # Check column consistency
    for line_no, content in table_lines:
        if _is_separator(content):
            continue
        cols = _count_cols(content)
        if cols != expected_cols:
            issues.append((line_no, "COL_MISMATCH",
                           f"Expected {expected_cols} columns but found {cols}: "
                           f"{content[:80]}"))

    # Check that rows start and end with pipes
    for line_no, content in table_lines:
        stripped = content.strip()
        if not stripped.startswith('|'):
            issues.append((line_no, "MISSING_LEADING_PIPE",
                           f"Row missing leading '|': {stripped[:80]}"))
        if not stripped.endswith('|'):
            issues.append((line_no, "MISSING_TRAILING_PIPE",
                           f"Row missing trailing '|': {stripped[:80]}"))

    # Check for empty cells that might indicate formatting issues
    for line_no, content in table_lines:
        if _is_separator(content):
            continue
        if '||' in content:
            issues.append((line_no, "EMPTY_CELL",
                           f"Possible empty cell (consecutive pipes): {content[:80]}"))


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "backend-deep-dive.md"
    issues = check_tables(filepath)

    if not issues:
        print("✅ No table issues found!")
    else:
        print(f"⚠️  Found {len(issues)} potential table issue(s):\n")
        for line_no, issue_type, msg in sorted(issues, key=lambda x: x[0]):
            print(f"  Line {line_no:>5} [{issue_type}]")
            print(f"           {msg}\n")


if __name__ == "__main__":
    main()
