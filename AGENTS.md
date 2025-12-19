# Agent Instructions

## Development Process
- FIRST think is there a need for larger refactoring or architecture change, and then how to implement based on principles from:
  - Code Complete by Steve McConnell
  - The Pragmatic Programmer by Hunt & Thomas
  - Inclusive Design Patterns by Heydon Pickering
  - The Web Application Hacker's Handbook
- NO CODE before test
- NO BUGFIX before regression test
- AFTER code do refactoring to follow clean code principles
- Keep `docs/requirements.md` up to date
- Oneliner commit messages starting with verb, no coauthors

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
