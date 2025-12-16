# Agent Instructions

## Development Process
- NO CODE before test
- NO BUGFIX before regression test
- AFTER code do refactoring to follow clean code principles
- Keep `docs/requirements.md` up to date

## Project
Single HTML file (`TaskTimerAnalog.html`) with embedded CSS/JS. No dependencies, no build step.

## Testing
```bash
npm test
```
Tests in `tests/clock.test.js` using JSDOM.

## Architecture
- `ClockLogic` object: pure functions (parsing, rendering math, cookies, URL hash)
- `state` object: mutable app state (color, mode, remaining, running, etc.)
- `el` object: cached DOM element references

## Key Patterns
- Persist preference: `setCookie`/`getCookie` + add to `parseHash`/`updateHash` whitelist
- New UI control: Add HTML → add to `el` → add event listener → add `title` tooltip → add `aria-label`
