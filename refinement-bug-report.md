# CS125 Refinement and Bug Fix Report

Date: 2026-03-17

## Scope
- Refined existing behavior and fixed bugs only.
- Added OS-aware filtering to search flow per request.
- Removed unnecessary lesson/placeholder files.

## Requested Fixes Completed

### 1) OS-aware search filtering from frontend menu
- Added an `Operating system` filter option (`Any`, `Windows`, `macOS`, `Linux`) to the query UI.
- Added a `Use My OS` button that detects the user platform and applies it to the OS filter.
- Search requests now implicitly include detected/selected OS when present.
- Backend search now validates and applies OS filter to native support columns:
  - `windows_support = TRUE`
  - `mac_support = TRUE`
  - `linux_support = TRUE`

Files:
- `frontend/src/app/pages/query-screen/query-screen.ts`
- `frontend/src/app/pages/query-screen/query-screen.html`
- `frontend/src/app/pages/query-screen/query-screen.css`
- `frontend/src/app/services/backend-service.ts`
- `backend/src/routes/search.routes.ts`
- `backend/src/services/search.service.ts`

### 2) Card hover title bug
- Removed game-name hover tooltip from card titles (normal and glass card variants).
- This stops title text from appearing on hover unexpectedly.

Files:
- `frontend/src/app/components/game-card/game-card.component.html`
- `frontend/src/app/components/game-card/game-card.component.ts`

## Additional Bugs Found and Fixed

### A) Empty search results did not navigate to results page
- Before: query page stayed in place when search returned zero results.
- After: query flow tracks pending search/recommendation requests and navigates to results page even with empty arrays, allowing the existing “No results found” state to render.

File:
- `frontend/src/app/pages/query-screen/query-screen.ts`

### B) Loading state race across multiple streams
- Before: a single `isLoading` value was overwritten by independent subscriptions (`search`, `recommendations`, `profile`) causing inconsistent UI state.
- After: loading state is derived from separate internal flags (`isSearchLoading || isRecommendationLoading`) with profile loading tracked independently.

File:
- `frontend/src/app/pages/query-screen/query-screen.ts`

### C) App state bootstrap could break on corrupted localStorage
- Before: `JSON.parse(localStorage.appState)` had no guard.
- After: added safe parse and fallback to defaults, plus guarded persistence writes.

File:
- `frontend/src/app/services/backend-service.ts`

## Cleanup Performed
- Removed unnecessary lesson file:
  - `frontend/src/learning/05-dependency-injection.ts`
- Removed empty placeholder files:
  - `HelloWorld.py`
  - `SteamGamesDataset.py`

## Test and Build Verification
- Backend tests: passed (`31/31`)
- Frontend tests: passed (`68/68`)
- Backend build: passed (`tsc`)
- Frontend build: passed (`ng build --configuration development --verbose`)

## Test Updates Added
- Route integration tests now cover OS query validation/delegation.
- Search service unit tests now cover SQL OS clause generation.

Files:
- `backend/src/routes/__tests__/search.routes.test.ts`
- `backend/src/services/__tests__/search.service.test.ts`
