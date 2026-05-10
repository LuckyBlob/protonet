@AGENTS.md

# Project Rules

## Coding Style (TypeScript/TSX)

1. Never use type inference — always annotate variables explicitly with their type.
2. Always use `const`. Only use `let` when reassignment is genuinely required.
3. Always create local variables for computed values. Exception: read directly from React state tuples (e.g., `goldState[0]`) instead of aliasing into a local.
4. Name local variables descriptively — say what the variable *is*, not just its type.
5. Always parenthesize comparisons and complex expressions, e.g., `if (x < (radius * radius))`.
6. Always favor early returns.
7. Always add scopes (`{}`) to all `if`, `for`, `while`, etc. — no single-line bodies.

## Formatting

1. Opening brace `{` on its own line.
2. Blank line after `{` and before `}` for code scopes.
3. Same rule applies to JSX expression scopes wrapped in `()` — `(` on its own line, blank line after, blank line before `)`.
4. JSX/HTML tags do **not** get blank lines inside — indentation is sufficient.
5. JSX tags with multiple attributes: `<` on its own line, tag name next line, each attribute on its own line, `>` on its own line.

## Strict equality

Always use `===` and `!==`, never `==` or `!=`.