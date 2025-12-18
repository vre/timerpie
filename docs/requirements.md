# Clock Timer Requirements

## Initial Request
- [x] 1. 60-minute clock face, 0/60 at top, 30 at bottom
- [x] 2. Standard minute markings (major every 5 mins, minor every 1 min)
- [x] 3. Color dropdown, 6 colors, orange default
- [x] 4. Mode selector
- [x] 5. Text input for time
- [x] 6. Colored area from 0 to given time
- [x] 7. Timer counts down counter-clockwise (CCW mode)

## Iteration 1
- [x] 8. ~Set button~ Go button both sets and starts timer
- [x] 9. ~Digital timer in center~ removed
- [x] 10. ~Stop and Reset buttons~ removed
- [x] 11. Timer endpoints are straight lines, not rounded

## Multi-Ring System
- [x] 12. Support >60 mins with inner circles, max 180 minutes
- [x] 13. Outer ring always shows countdown, inner rings show full 60-min blocks

## Additional Modes
- [x] 14. CW mode: Pie from (60-time) to 60, shrinks clockwise to 0
- [x] 15. END mode: Pie from current minute to target end time
- [x] 16. END accepts minutes (0-59) or hh:mm format

## Visual Refinements
- [x] 17. Black border around colored areas
- [x] 18. Pie wedge visualization from center (not arc)
- [x] 19. Z-index: outer ring on top, inner rings underneath
- [x] 20. 60-120 mins: inner circle at 2/3 radius
- [x] 21. 120-180 mins: two inner circles at 1/3 and 2/3 radius
- [x] 22. Inner circles darken progressively (70% middle, 50% innermost)
- [x] 23. Reference line from center follows timer position on all circles

## UI Redesign
- [x] 24. Pure JavaScript/HTML/SVG (no dependencies)
- [x] 25. Color button dropdown (top left)
- [x] 26. Mode buttons: CCW, CW, END (mutually exclusive)
- [x] 27. Time input field (width 5 chars)
- [x] 28. Marking buttons: 15, 5, - (15min labels, 5min labels, none)
- [x] 29. Responsive sizing to fit window

## Features
- [x] 30. Live preview: clock face updates as user types
- [x] 31. END input: 3-4 digits as HMM/HHMM (e.g., 544 → 5:44, 1234 → 12:34)
- [x] 32. END mode preview animates: start point updates with real time before timer starts
- [x] 33. Preview colors at 20% darkness until timer starts
- [x] 34. Timer completion: clock face blinks with timer color (same pulse as Go button)
- [x] 35. Auto-switch to END mode: 4-digit input or colon in CCW/CW mode switches to END
- [x] 36. Smart AM/PM: 3-digit time (e.g., 830) picks closest AM/PM within 3-hour window
- [x] 37. Mode switching while running: changing mode shows remaining time in new visualization
- [x] 38. Time capping: values exceeding 180 minutes are capped at 180 (all modes)
- [x] 39. Input field update: on Go, if time was capped, update input to show actual time used
- [x] 40. CW mode label mirroring: clock numbers flip horizontally so 15 is on left, 45 on right
- [x] 41. Go button disabled after press: button stays disabled until time input is modified
- [x] 42. Cookie persistence: saves color, mode (CCW/CW/END), and marks (15/5/-) preferences
- [x] 43. Full-window clock: SVG scales to fill available browser window space
- [x] 44. Corner controls: control box positioned in top-left corner, overlaying the clock
- [x] 45. Controls reorganized: vertical stack with labeled groups (Mode:, Labels:, Time:)
- [x] 46. Mode switch while running: END shows end time, CCW/CW shows remaining minutes
- [x] 47. Input field width increased to fit time formats
- [x] 48. Dark mode: toggle button inverts colors (white↔black), preference saved in cookie
- [x] 49. Pause/Resume: Go button becomes Pause when running, Play when paused (CCW/CW modes only)
- [x] 51. No pause in END mode: target time is fixed, button stays disabled while running
- [x] 52. END mode short input: 1-4 digit input shows full hh:mm after Go (e.g., "45" → "14:45")
- [x] 50. Tab title countdown: shows "M:SS - TaskTimer" while running/paused, "TaskTimer" when stopped
- [x] 53. Fullscreen mode: ⛶ button triggers browser fullscreen API, hides controls, Escape or button to exit
- [x] 54. Auto-focus: time input field is focused on page load for immediate typing
- [x] 55. Preset buttons: small buttons (5,10,15,20,25,30,45,60,90) immediately start timer on click
- [x] 56. Preset button feedback: turns green instantly, fades back to original over 1 second
- [x] 57. Tooltips: all UI controls have descriptive tooltips, dynamic for mode-dependent elements
- [x] 58. Keyboard shortcuts: Space (pause/resume), F (toggle fullscreen), Esc (exit fullscreen), P (toggle PiP)
- [x] 59. URL sharing: settings encoded in URL hash for bookmarking (color, mode, marks, dark, time)
- [x] 60. Picture-in-Picture: floating mini timer using browser PiP API with canvas rendering (P key, hidden in Safari)
- [x] 62. Alarm sound: beep-beep-beep pattern using Web Audio API (no audio files), toggle button 🔔/🔕, preference saved in cookie
- [x] 63. Dark mode wedge borders: border matches fill color (invisible), only time-following edge shown in white
- [x] 64. PWA manifest: installable as standalone app with manifest.json, theme-color, and Apple mobile web app meta tags
- [x] 65. Thicker tick marks: 15-minute marks stroke-width 5, 5-minute marks stroke-width 3, 1-minute marks stroke-width 1
- [x] 66. PWA icons: SVG source icon with PNG exports (192x192, 512x512) showing 25-minute timer
- [x] 67. Sound preference in URL hash: sound=off parameter for bookmarking muted state
- [x] 68. Go button after completion: enabled if input has valid value so user can restart timer
- [x] 69. File renamed: clock.html → TaskTimer.html
- [x] 70. Wake lock: keeps screen on while timer is running using Screen Wake Lock API, released on pause/stop/typing, re-requested on tab visibility

## Security & Accessibility
- [x] 71. Cookie security: name validation, value encoding, SameSite=Lax attribute
- [x] 72. URL hash whitelist: only allowed parameters parsed (color, mode, marks, dark, sound, time)
- [x] 73. Cookie/hash value validation: color must match hex pattern, mode/marks validated against allowed values
- [x] 74. SVG accessibility: role="img", aria-labelledby, title element for screen readers
- [x] 75. ARIA live region: screen reader announces remaining time once per minute
- [x] 76. Preset button aria-labels: descriptive labels for screen readers (e.g., "Start 5 minute timer")
- [x] 77. Color menu keyboard navigation: Arrow keys to navigate, Enter/Space to select, Escape to close
- [x] 78. Performance: darken() function memoized to avoid repeated calculations
- [x] 79. Web Audio error handling: graceful fallback if AudioContext creation fails

## Responsive Design
- [x] 80. Auto-hide controls: controls fade to 10% opacity when timer running, show on hover (for narrow screens)

## Mode Switching
- [x] 81. Pause button follows mode: switching to END mode while running disables pause, switching to CCW/CW enables it
- [x] 82. Pause survives mode switch: paused timer preserves remaining time when switching modes
- [x] 83. Seconds precision: switching to END mode preserves seconds in end time (e.g., 13:45:25 not 13:45:00)
- [x] 84. Space key respects mode: Space shortcut for pause/resume is disabled in END mode

## Visual Refinements (v2)
- [x] 85. Light mode pie border: stroke matches fill color (no black border)
- [x] 86. Moving edge indicator: black edge line in light mode, white in dark mode

## Display Mode Toggle
- [x] 87. Analog/Digital toggle: A/D button switches between pie (analog) and ring (digital) display modes
- [x] 88. Digital rings: all rings fit in outer 1/3 of radius (180→120), inner 2/3 empty
- [x] 89. Center countdown: digital mode shows MM:SS countdown in center
- [x] 90. Digital completion: static colored center + pulsing ring + overtime counter (-0:01, -0:02...)
- [x] 91. Display mode preference: saved in cookie and URL hash (display=digital)

## UI Improvements
- [x] 92. Control layout redesign with segmented button groups and CSS tooltips

## Background Alarm
- [x] 93. Web Worker for background timer: reliable completion detection even when tab is in background or on different virtual desktop
- [x] 94. Improved notifications: absolute icon URL, retry mechanism, dock badge (PWA)
- [x] 95. Pre-cached audio: beep sound generated on page load for faster playback
- [x] 96. Mobile vibration: Vibration API pattern (750ms on, 375ms off) synced with audio beeps
- [x] 97. Time value in URL hash: shareable links include timer duration
- [x] 98. Alarm off by default: notification permission requested only when alarm is enabled

## Future Enhancements
- [ ] 61. Safari PiP support: re-enable when Safari supports canvas captureStream with PiP (check WebKit bug 181663)
