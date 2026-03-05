#!/usr/bin/env python3
"""
Two-pass AST mutation for Pandoc-to-XeLaTeX table rendering:

1. Table Column Allocation: Forces Pandoc p{width} generation by expanding
   separator row widths to match actual cell content, ensuring total width
   exceeds 72 chars (the threshold for paragraph column descriptors).

2. Token-Level Boundary Injection: Injects Zero-Width Spaces (U+200B) into
   inline code blocks at camelCase boundaries, underscores, and periods.
   This provides the TeX engine with zero-penalty glue nodes, overriding
   the infinite hyphenation penalty of \ttfamily and allowing line breaks
   within \texttt{} macros inside table cells.
"""
import sys
import re


def process_markdown_ast(input_path: str, output_path: str) -> None:
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    processed_lines = []
    table_buffer = []
    in_table = False
    in_code_block = False

    table_row_pattern = re.compile(r'^\s*\|(.*)\|\s*$')
    separator_pattern = re.compile(r'^\s*\|(?:\s*:?-+:?\s*\|)+\s*$')
    inline_code_pattern = re.compile(r'(`[^`]+`)')

    def inject_zwsp_into_code(text: str) -> str:
        """
        Injects Unicode U+200B (Zero-Width Space) into backtick-delimited
        inline code at camelCase boundaries, underscores, periods, HYPHENS,
        and FORWARD SLASHES to provide TeX with zero-penalty glue nodes.
        """
        def replacer(match):
            code_content = match.group(1)
            # Expanded structural boundaries: period, underscore, hyphen, forward slash
            mutated = re.sub(r'([._\-/])', '\\1\u200B', code_content)
            # Inject ZWSP at camelCase boundaries
            mutated = re.sub(r'([a-z])([A-Z])', '\\1\u200B\\2', mutated)
            return mutated
        return inline_code_pattern.sub(replacer, text)

    def process_table_buffer(tb: list) -> list:
        if not tb:
            return []

        sep_idx = -1
        for i, line in enumerate(tb):
            if separator_pattern.match(line):
                sep_idx = i
                break

        if sep_idx == -1:
            return tb

        col_widths = {}
        # Pass 1: Measure column dimensions and inject ZWSP into content rows
        for i, line in enumerate(tb):
            if i == sep_idx:
                continue

            mutated_line = inject_zwsp_into_code(line)
            tb[i] = mutated_line

            match = table_row_pattern.match(mutated_line)
            if match:
                cols = [c.strip() for c in match.group(1).split('|')]
                for col_idx, col_content in enumerate(cols):
                    # Measure visual length excluding invisible ZWSP characters
                    length = len(col_content.replace('\u200b', ''))
                    if col_idx not in col_widths or length > col_widths[col_idx]:
                        col_widths[col_idx] = length

        # Pass 2: Reallocate separator dash widths with mathematical clamping
        match = table_row_pattern.match(tb[sep_idx])
        if match:
            sep_cols = [c.strip() for c in match.group(1).split('|')]
            new_sep_cols = []
            for col_idx, col_content in enumerate(sep_cols):
                left_align = col_content.startswith(':')
                right_align = col_content.endswith(':')

                # Raw visual width
                raw_width = col_widths.get(col_idx, 3)

                # The Clamping Function: Floor of 12 dashes, Ceiling of 75 dashes.
                # This prevents paragraph-heavy columns from skewing the Pandoc AST ratio
                # and starving adjacent columns of fractional \textwidth.
                target_width = min(max(raw_width, 12), 75)

                if left_align and right_align:
                    new_col = ':' + '-' * (target_width - 2) + ':'
                elif left_align:
                    new_col = ':' + '-' * (target_width - 1)
                elif right_align:
                    new_col = '-' * (target_width - 1) + ':'
                else:
                    new_col = '-' * target_width
                new_sep_cols.append(new_col)

            tb[sep_idx] = '| ' + ' | '.join(new_sep_cols) + ' |\n'

        return tb

    for line in lines:
        stripped = line.strip()

        # Track fenced code blocks — skip mutation inside them
        if stripped.startswith('```'):
            in_code_block = not in_code_block
            if in_table:
                processed_lines.extend(process_table_buffer(table_buffer))
                table_buffer = []
                in_table = False
            processed_lines.append(line)
            continue

        if in_code_block:
            processed_lines.append(line)
            continue

        if table_row_pattern.match(line):
            in_table = True
            table_buffer.append(line)
        else:
            if in_table:
                processed_lines.extend(process_table_buffer(table_buffer))
                table_buffer = []
                in_table = False
            # Apply ZWSP injection to non-table lines for global consistency
            processed_lines.append(inject_zwsp_into_code(line))

    if in_table:
        processed_lines.extend(process_table_buffer(table_buffer))

    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(processed_lines)

    print(f"✅ Processed {input_path} -> {output_path}")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.stderr.write(
            "Usage: python3 fix_tables.py <input.md> <output.md>\n"
        )
        sys.exit(1)
    process_markdown_ast(sys.argv[1], sys.argv[2])
