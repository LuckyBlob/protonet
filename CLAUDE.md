@AGENTS.md

# Project Rules

## Coding Style (TypeScript/TSX)

Never use type inference — always annotate variables explicitly.
Always use const. Only let when reassignment is needed.
Always create local variables for computed values. Exception: read directly from React state tuples.
Name local variables descriptively.
Always parenthesize comparisons and complex expressions.
Always favor early returns.
Always add scopes ({}) to all if, for, while, etc.

## Formatting

Opening { on its own line.
Closing } on its own line.
No blank line immediately after { or immediately before }.
JSX () scopes follow the same rule: ( on its own line, ) on its own line, no blank lines inside.
Blank lines are suggested to seperate group of elements, for example between multiple local variables and multiple function calls.
JSX/HTML tags don't get blank lines — indentation is sufficient.
JSX tags with multiple attributes: < on its own line, tag name next line, each attribute on its own line, > on its own line.

## Strict equality

Always use `===` and `!==`, never `==` or `!=`.