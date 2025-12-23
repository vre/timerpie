# TimerPie implemented features

Changes listed in chronological order. Deprecated features marked with ~strikethrough~.

## 2025-11-15

### Vibe Coding - Initial Concept
1. 60-minute clock face, 0/60 at top, 30 at bottom
2. Standard minute markings (major every 5 mins, minor every 1 min)
3. Color dropdown, 6 colors, orange default
4. Mode selector
5. Text input for time
6. Colored area from 0 to given time
7. Timer counts down counter-clockwise (CCW mode)
8. ~Set button~ Go button both sets and starts timer
9. ~Digital timer in center~ removed
10. ~Stop and Reset buttons~ removed
11. Timer endpoints are straight lines, not rounded
12. Support >60 mins with inner circles, max 180 minutes
13. Outer ring always shows countdown, inner rings show full 60-min blocks
14. CW mode: Pie from (60-time) to 60, shrinks clockwise to 0
15. END mode: Pie from current minute to target end time
16. END accepts minutes (0-59) or hh:mm format
17. Black border around colored areas

## 2025-11-16

### Vibe Coding - Multi-Ring System
18. Pie wedge visualization from center (not arc)
19. Z-index: outer ring on top, inner rings underneath
20. 60-120 mins: inner circle at 2/3 radius
21. 120-180 mins: two inner circles at 1/3 and 2/3 radius
22. Inner circles darken progressively (70% middle, 50% innermost)
23. Reference line from center follows timer position on all circles
24. Pure JavaScript/HTML/SVG (no dependencies)
25. Color button dropdown (top left)
26. Mode buttons: CCW, CW, END (mutually exclusive)
27. Time input field (width 5 chars)
28. Marking buttons: 15, 5, - (15min labels, 5min labels, none)
29. Responsive sizing to fit window

## 2025-11-19

### Vibe Coding - Bug Fixes
30. FIX: ES5 compatibility (removed arrow functions, template literals)

## 2025-12-16

### Formalized Development
31. Test-first approach: created tests for existing functionality before new changes
32. Live preview: clock face updates as user types
33. END input: 3-4 digits as HMM/HHMM (e.g., 544 = 5:44, 1234 = 12:34)
34. END mode preview animates: start point updates with real time before timer starts
35. Preview colors at 20% darkness until timer starts
36. Timer completion: clock face blinks with timer color
37. Auto-switch to END mode: 4-digit input or colon in CCW/CW mode switches to END
38. Smart AM/PM: 3-digit time (e.g., 830) picks closest AM/PM within 3-hour window
39. Mode switching while running: changing mode shows remaining time in new visualization
40. Time capping: values exceeding 180 minutes are capped at 180 (all modes)
41. Input field update: on Go, if time was capped, update input to show actual time used
42. CW mode label mirroring: clock numbers flip horizontally so 15 is on left, 45 on right
43. Go button disabled after press: button stays disabled until time input is modified
44. Cookie persistence: saves color, mode (CCW/CW/END), and marks (15/5/-) preferences
45. Full-window clock: SVG scales to fill available browser window space
46. Corner controls: control box positioned in top-left corner, overlaying the clock
47. Controls reorganized: vertical stack with labeled groups
48. Mode switch while running: END shows end time, CCW/CW shows remaining minutes
49. Input field width increased to fit time formats
50. Dark mode: toggle button inverts colors, preference saved in cookie
51. Pause/Resume: Go button becomes Pause when running, Play when paused (CCW/CW modes only)
52. Tab title countdown: shows "M:SS - TimerPie" while running/paused
53. No pause in END mode: target time is fixed, button stays disabled while running
54. END mode short input: 1-4 digit input shows full hh:mm after Go
55. Fullscreen mode: button triggers browser fullscreen API, hides controls
56. Auto-focus: time input field is focused on page load for immediate typing
57. Preset buttons: small buttons (5,10,15,20,25,30,45,60,90) immediately start timer on click
58. Preset button feedback: turns green instantly, fades back to original over 1 second
59. Tooltips: all UI controls have descriptive tooltips
60. Keyboard shortcuts: Space (pause/resume), F (toggle fullscreen), Esc (exit fullscreen), P (toggle PiP)
61. URL sharing: settings encoded in URL hash for bookmarking
62. Picture-in-Picture: floating mini timer using browser PiP API with canvas rendering
63. Alarm sound: beep-beep-beep pattern using Web Audio API (no audio files)
64. Dark mode wedge borders: border matches fill color, only time-following edge shown
65. PWA manifest: installable as standalone app with manifest.json
66. Thicker tick marks: 15-minute marks stroke-width 5, 5-minute marks stroke-width 3
67. PWA icons: SVG source icon with PNG exports (192x192, 512x512)
68. Sound preference in URL hash: sound=off parameter for bookmarking muted state
69. Go button after completion: enabled if input has valid value so user can restart
70. File renamed: clock.html to TimerPie.html
71. Wake lock: keeps screen on while timer is running using Screen Wake Lock API

### Security & Accessibility
72. Cookie security: name validation, value encoding, SameSite=Lax attribute
73. URL hash whitelist: only allowed parameters parsed
74. Cookie/hash value validation: color must match hex pattern, mode/marks validated
75. SVG accessibility: role="img", aria-labelledby, title element for screen readers
76. ARIA live region: screen reader announces remaining time once per minute
77. Preset button aria-labels: descriptive labels for screen readers
78. Color menu keyboard navigation: Arrow keys to navigate, Enter/Space to select, Escape to close
79. Performance: darken() function memoized to avoid repeated calculations
80. Web Audio error handling: graceful fallback if AudioContext creation fails

## 2025-12-17

### UI Behavior
81. Auto-hide controls: controls fade to 10% opacity when timer running, show on hover

### Visual Refinements
82. FIX: Dark mode edge - leading edge line fixed for CW and END modes

## 2025-12-18

### Mode Switching
83. Pause button follows mode: switching to END mode while running disables pause, switching to CCW/CW enables it
84. Pause survives mode switch: paused timer preserves remaining time when switching modes
85. Seconds precision: switching to END mode preserves seconds in end time (e.g., 13:45:25 not 13:45:00)
86. Space key respects mode: Space shortcut for pause/resume is disabled in END mode

### Light Mode Styling
87. Light mode pie border: stroke matches fill color (no black border)
88. Moving edge indicator: black edge line in light mode, white in dark mode

### Display Mode Toggle
89. Analog/Digital toggle: button switches between pie (analog) and ring (digital) display modes
90. Digital rings: all rings fit in outer 1/3 of radius (180-120), inner 2/3 empty
91. Center countdown: digital mode shows MM:SS countdown in center
92. Digital completion: static colored center + pulsing ring + overtime counter (-0:01, -0:02...)
93. Display mode preference: saved in cookie and URL hash (display=digital)

### UI Improvements
94. Control layout redesign with segmented button groups and CSS tooltips

### Background Alarm
95. Web Worker for background timer: reliable completion detection even when tab is in background
96. Improved notifications: absolute icon URL, retry mechanism, dock badge (PWA)
97. Pre-cached audio: beep sound generated on page load for faster playback
98. Mobile vibration: Vibration API pattern (750ms on, 375ms off) synced with audio beeps
99. Notification permission: requested only once per session
100. Time value in URL hash: shareable links include timer duration
101. Alarm off by default: notification permission requested only when alarm is enabled

### Bug Fixes
102. FIX: Go button after completion - re-enabled when timer completes so user can restart

## 2025-12-19

### Accessibility
103. CSS focus styles: visible focus indicators for keyboard navigation

### Code Review Fixes
104. FIX: Input validation - reject empty or excessively long input
105. FIX: Wake lock cleanup - release existing lock before requesting new one, prevents listener accumulation
106. FIX: Timer worker accuracy - check interval reduced from 500ms to 100ms
107. FIX: Screen reader completion - announces "Timer completed!" when timer ends
108. FIX: Race condition guard - prevents multiple simultaneous timer starts

### Performance
109. Canvas rendering: dynamic wedge rendering moved from SVG to HTML5 Canvas for 60fps performance, SVG retained for static tick marks and completion animation

### URL Hash Fix
110. FIX: URL hash time parsing - Go button now works when time loaded from URL (parses state properly)

### Build System
111. Dev/release split: `src/` folder with separate JS/CSS files, `npm run build` generates single-file release

### Mobile
112. Touch auto-hide: controls fully hide on touch devices, tap clock to toggle, auto-shows when timer stops

### Code Review Fixes (Dec 19 PM)
113. FIX: Input validation - reject malformed hh:mm input (":5", "10:", etc.) in END mode
114. FIX: Memory leak - revoke worker blob URL after worker creation
115. FIX: Cookie security - reject values over 4KB limit
116. FIX: Accessibility - CSS tooltips now visible on keyboard focus (not just hover)
117. FIX: Performance - PiP render rate matched to 30fps capture rate
118. FIX: END mode - hour rollover edge case handled correctly
119. FIX: Build script - more robust regex for tag stripping
120. FIX: Performance - lazy-generate beep audio (saves ~66KB work on page load)
121. FIX: Accessibility - announce pause/resume to screen readers
122. PWA: theme-color meta tag updates to match selected clock color
123. Standardize on ES6: convert clock-logic.js from var to const/let
124. Controls visibility: pure JS implementation replacing CSS class juggling for reliable hover/click behavior
125. Mobile labels: added side padding to viewBox so 15/45 labels aren't cut off
126. UI defaults: swapped CW/CCW button order, 5-min marks now default
127. Screenshot automation: `scripts/screenshots.sh` with Chrome headless + ImageMagick
128. URL params for automation: `autostart=1` starts timer on load, `controls=0` hides controls
129. FIX: Tooltip line-height inheritance from icon buttons
130. PWA theme-color: follows light/dark mode instead of pie color (cleaner status bar on mobile)
131. Info modal: ℹ️ button shows version number and GitHub link
132. Install instructions: clickable link in info modal shows platform-specific PWA install steps, embedded QR code, focus trapping for accessibility
133. Build-time version: version number injected from package.json during build

## 2025-12-23

### Bug Fixes
134. FIX: Dark mode edge line - moving edge now white in dark mode, black in light mode

## Future

- Safari PiP support: re-enable when Safari supports canvas captureStream with PiP (WebKit bug 181663)
