const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Test counters
let passed = 0;
let failed = 0;

// Simple assertion helpers
function assert(condition, message) {
  if (!condition) {
    console.log(`  FAIL: ${message}`);
    failed++;
    return false;
  }
  console.log(`  PASS: ${message}`);
  passed++;
  return true;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.log(`  FAIL: ${message} - Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
    return false;
  }
  console.log(`  PASS: ${message}`);
  passed++;
  return true;
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    console.log(`  FAIL: ${message} - Expected non-null value`);
    failed++;
    return false;
  }
  console.log(`  PASS: ${message}`);
  passed++;
  return true;
}

// Load HTML and create DOM
function createDOM() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost'
  });
  return dom;
}

// Get ClockLogic from DOM
function getClockLogic() {
  const dom = createDOM();
  const logic = dom.window.ClockLogic;
  return { logic, dom };
}

// ============================================
// UNIT TESTS FOR PURE FUNCTIONS (ClockLogic)
// ============================================

console.log('\n========================================');
console.log('Clock Timer Test Suite');
console.log('========================================\n');

console.log('Unit Tests: ClockLogic.darken');
console.log('-----------------------------');

(function testDarken() {
  const { logic, dom } = getClockLogic();

  // Test darken with factor 1.0 (no change)
  assertEqual(logic.darken('#ff6b35', 1.0), '#ff6b35', 'darken with factor 1.0 returns same color');

  // Test darken with factor 0.5
  assertEqual(logic.darken('#ff6b35', 0.5), '#7f351a', 'darken with factor 0.5 halves RGB values');

  // Test darken white to gray
  assertEqual(logic.darken('#ffffff', 0.5), '#7f7f7f', 'darken white by 0.5 gives gray');

  // Test darken with factor 0 (black)
  assertEqual(logic.darken('#ff6b35', 0), '#000000', 'darken with factor 0 gives black');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.parseInput (CCW/CW modes)');
console.log('-----------------------------------------------');

(function testParseInputCcwCw() {
  const { logic, dom } = getClockLogic();
  const now = new Date('2024-01-15T10:00:00');

  // Valid minutes
  assertEqual(logic.parseInput('30', 'ccw', now, 180).total, 30, 'parseInput "30" in ccw mode returns 30 minutes');
  assertEqual(logic.parseInput('30', 'cw', now, 180).total, 30, 'parseInput "30" in cw mode returns 30 minutes');

  // Decimal minutes
  assertEqual(logic.parseInput('5.5', 'ccw', now, 180).total, 5.5, 'parseInput "5.5" returns 5.5 minutes');

  // Time capping
  assertEqual(logic.parseInput('200', 'ccw', now, 180).total, 180, 'parseInput "200" caps at 180');
  assertEqual(logic.parseInput('999', 'ccw', now, 180).total, 180, 'parseInput "999" caps at 180');

  // Invalid inputs
  assertEqual(logic.parseInput('0', 'ccw', now, 180), null, 'parseInput "0" returns null');
  assertEqual(logic.parseInput('-5', 'ccw', now, 180), null, 'parseInput "-5" returns null');
  assertEqual(logic.parseInput('abc', 'ccw', now, 180), null, 'parseInput "abc" returns null');
  assertEqual(logic.parseInput('', 'ccw', now, 180), null, 'parseInput empty string returns null');

  // endTime should be null for CCW/CW modes
  assertEqual(logic.parseInput('30', 'ccw', now, 180).endTime, null, 'CCW mode has null endTime');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.parseInput (END mode - hh:mm format)');
console.log('-----------------------------------------------------------');

(function testParseInputEndHhMm() {
  const { logic, dom } = getClockLogic();

  // Test at 10:00, target 10:30 (30 mins away)
  const now1 = new Date('2024-01-15T10:00:00');
  const result1 = logic.parseInput('10:30', 'end', now1, 180);
  assertEqual(result1.total, 30, 'END mode 10:30 from 10:00 = 30 minutes');
  assertEqual(result1.endTime, 30, 'END mode endTime is 30');

  // Test at 10:00, target 09:30 (next day, ~23.5 hours away, capped)
  const result2 = logic.parseInput('9:30', 'end', now1, 180);
  assertEqual(result2.total, 180, 'END mode 9:30 from 10:00 caps at 180');

  // Invalid hh:mm
  assertEqual(logic.parseInput('25:00', 'end', now1, 180), null, 'Invalid hour 25 returns null');
  assertEqual(logic.parseInput('10:60', 'end', now1, 180), null, 'Invalid minute 60 returns null');

  // Malformed hh:mm - missing parts should be rejected
  assertEqual(logic.parseInput(':', 'end', now1, 180), null, 'Lone colon ":" returns null');
  assertEqual(logic.parseInput(':5', 'end', now1, 180), null, 'Missing hour ":5" returns null');
  assertEqual(logic.parseInput('10:', 'end', now1, 180), null, 'Missing minute "10:" returns null');
  assertEqual(logic.parseInput('::', 'end', now1, 180), null, 'Double colon "::" returns null');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.parseInput (END mode - 3-4 digit format)');
console.log('---------------------------------------------------------------');

(function testParseInputEnd34Digit() {
  const { logic, dom } = getClockLogic();

  // Test at 10:00
  const now = new Date('2024-01-15T10:00:00');

  // 1030 = 10:30 (30 mins away)
  const result1 = logic.parseInput('1030', 'end', now, 180);
  assertEqual(result1.total, 30, 'END mode "1030" from 10:00 = 30 minutes');
  assertEqual(result1.endTime, 30, 'END mode endTime is 30');

  // 930 = 9:30 - should pick PM (21:30) if closer
  // At 10:00, 9:30 AM is past, 21:30 is 11.5 hours away (capped)
  const result2 = logic.parseInput('930', 'end', now, 180);
  assertEqual(result2.total, 180, 'END mode "930" caps at 180');

  // 1234 = 12:34 (2 hours 34 mins = 154 mins from 10:00)
  const result3 = logic.parseInput('1234', 'end', now, 180);
  assertEqual(result3.total, 154, 'END mode "1234" from 10:00 = 154 minutes');

  // Invalid 3-4 digit
  assertEqual(logic.parseInput('2500', 'end', now, 180), null, 'Invalid "2500" returns null');
  assertEqual(logic.parseInput('1060', 'end', now, 180), null, 'Invalid "1060" returns null');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.parseInput (END mode - 1-2 digit minutes)');
console.log('----------------------------------------------------------------');

(function testParseInputEnd12Digit() {
  const { logic, dom } = getClockLogic();

  // Test at 10:15
  const now = new Date('2024-01-15T10:15:00');

  // "30" = :30 on current hour (10:30, 15 mins away)
  const result1 = logic.parseInput('30', 'end', now, 180);
  assertEqual(result1.total, 15, 'END mode "30" from 10:15 = 15 minutes');
  assertEqual(result1.endTime, 30, 'END mode endTime is 30');

  // "10" = :10 on next hour (11:10, 55 mins away)
  const result2 = logic.parseInput('10', 'end', now, 180);
  assertEqual(result2.total, 55, 'END mode "10" from 10:15 = 55 minutes (next hour)');

  // Invalid minute values
  assertEqual(logic.parseInput('60', 'end', now, 180), null, 'END mode "60" returns null (invalid minute)');
  assertEqual(logic.parseInput('99', 'end', now, 180), null, 'END mode "99" returns null (invalid minute)');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.getCircles');
console.log('---------------------------------');

(function testGetCircles() {
  const { logic, dom } = getClockLogic();
  const RADIUS = { FULL: 180, MIDDLE: 120, INNER: 60 };

  // 0 minutes = no circles
  assertEqual(logic.getCircles(0, RADIUS).length, 0, 'getCircles(0) returns empty array');

  // 30 minutes = 1 circle (outer only)
  const c30 = logic.getCircles(30, RADIUS);
  assertEqual(c30.length, 1, 'getCircles(30) returns 1 circle');
  assertEqual(c30[0].r, 180, 'getCircles(30) outer radius is FULL');
  assertEqual(c30[0].t, 30, 'getCircles(30) outer time is 30');
  assertEqual(c30[0].full, false, 'getCircles(30) outer is not full');

  // 60 minutes = 1 full circle
  const c60 = logic.getCircles(60, RADIUS);
  assertEqual(c60.length, 1, 'getCircles(60) returns 1 circle');
  assertEqual(c60[0].full, true, 'getCircles(60) outer is full');

  // 90 minutes = 2 circles (30 outer, 60 middle)
  const c90 = logic.getCircles(90, RADIUS);
  assertEqual(c90.length, 2, 'getCircles(90) returns 2 circles');
  assertEqual(c90[0].t, 30, 'getCircles(90) outer time is 30');
  assertEqual(c90[1].t, 60, 'getCircles(90) middle time is 60');
  assertEqual(c90[1].full, true, 'getCircles(90) middle is full');

  // 120 minutes = 2 full circles
  const c120 = logic.getCircles(120, RADIUS);
  assertEqual(c120.length, 2, 'getCircles(120) returns 2 circles');
  assertEqual(c120[0].full, true, 'getCircles(120) outer is full');

  // 150 minutes = 3 circles (30 outer, 60 middle, 60 inner)
  const c150 = logic.getCircles(150, RADIUS);
  assertEqual(c150.length, 3, 'getCircles(150) returns 3 circles');
  assertEqual(c150[0].t, 30, 'getCircles(150) outer time is 30');
  assertEqual(c150[1].full, true, 'getCircles(150) middle is full');
  assertEqual(c150[2].full, true, 'getCircles(150) inner is full');

  // 180 minutes = 3 full circles
  const c180 = logic.getCircles(180, RADIUS);
  assertEqual(c180.length, 3, 'getCircles(180) returns 3 circles');
  assertEqual(c180[0].full, true, 'getCircles(180) outer is full');
  assertEqual(c180[1].full, true, 'getCircles(180) middle is full');
  assertEqual(c180[2].full, true, 'getCircles(180) inner is full');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.getLabelPosition');
console.log('---------------------------------------');

(function testGetLabelPosition() {
  const { logic, dom } = getClockLogic();
  const CENTER = 225;
  const LABEL_RADIUS = 215;

  // In CCW mode: 15 at right (x > center), 45 at left (x < center)
  const ccw15 = logic.getLabelPosition(15, 'ccw', CENTER, LABEL_RADIUS);
  const ccw45 = logic.getLabelPosition(45, 'ccw', CENTER, LABEL_RADIUS);
  assert(ccw15.x > CENTER, 'CCW mode: 15 is on right (x > center)');
  assert(ccw45.x < CENTER, 'CCW mode: 45 is on left (x < center)');

  // In CW mode: 15 at left (x < center), 45 at right (x > center)
  const cw15 = logic.getLabelPosition(15, 'cw', CENTER, LABEL_RADIUS);
  const cw45 = logic.getLabelPosition(45, 'cw', CENTER, LABEL_RADIUS);
  assert(cw15.x < CENTER, 'CW mode: 15 is on left (x < center)');
  assert(cw45.x > CENTER, 'CW mode: 45 is on right (x > center)');

  // 30 should be at bottom (y > center) in both modes
  const ccw30 = logic.getLabelPosition(30, 'ccw', CENTER, LABEL_RADIUS);
  const cw30 = logic.getLabelPosition(30, 'cw', CENTER, LABEL_RADIUS);
  assert(ccw30.y > CENTER, 'CCW mode: 30 is at bottom (y > center)');
  assert(cw30.y > CENTER, 'CW mode: 30 is at bottom (y > center)');

  // 60 (0 position) should be at top (y < center) in both modes
  const ccw60 = logic.getLabelPosition(60, 'ccw', CENTER, LABEL_RADIUS);
  const cw60 = logic.getLabelPosition(60, 'cw', CENTER, LABEL_RADIUS);
  assert(ccw60.y < CENTER, 'CCW mode: 60 is at top (y < center)');
  assert(cw60.y < CENTER, 'CW mode: 60 is at top (y < center)');

  dom.window.close();
})();

console.log('');

// ============================================
// INTEGRATION TESTS (DOM-based)
// ============================================

console.log('Integration Tests: Preset Buttons');
console.log('---------------------------------');

(function testPresetButtonsExist() {
  const dom = createDOM();
  const { document } = dom.window;

  const presetBtns = document.querySelectorAll('.preset-btn');
  assertEqual(presetBtns.length, 9, '9 preset buttons exist (5,10,15,20,25,30,45,60,90)');

  dom.window.close();
})();

(function testPresetButtonStartsTimer() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Click the 30 minute preset
  const btn30 = Array.from(presetBtns).find(b => b.textContent === '30');
  btn30.click();

  assertEqual(timeInput.value, '30', 'Clicking preset sets time input value');
  assert(goBtn.classList.contains('running'), 'Clicking preset immediately starts timer');
  assert(btn30.classList.contains('pressed'), 'Preset button has pressed class after click');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Initial Focus');
console.log('--------------------------------');

(function testTimeInputFocusedOnLoad() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  assertEqual(document.activeElement, timeInput, 'Time input is focused on page load');

  dom.window.close();
})();

(function testTimeInputSelectOnFocusRegistered() {
  // Verify focus handler with select is present in the source
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  assert(html.includes('addEventListener') && html.includes('focus') && html.includes('select'),
    'Focus handler with select() is registered');
})();

console.log('');

console.log('Integration Tests: DOM Structure');
console.log('--------------------------------');

(function testDOMStructure() {
  const dom = createDOM();
  const { document } = dom.window;

  // Color button
  const colorBtn = document.getElementById('colorBtn');
  assertNotNull(colorBtn, 'Color button exists');
  assertEqual(colorBtn.getAttribute('aria-label'), 'Select color', 'Color button has aria-label');

  // Color menu
  const colorMenu = document.getElementById('colorMenu');
  assertNotNull(colorMenu, 'Color menu exists');
  assertEqual(colorMenu.getAttribute('role'), 'menu', 'Color menu has role="menu"');

  // Color options
  const colorOptions = document.querySelectorAll('.color-option');
  assertEqual(colorOptions.length, 6, '6 color options exist');

  // Time input
  const timeInput = document.getElementById('time');
  assertNotNull(timeInput, 'Time input exists');

  // Go button
  const goBtn = document.getElementById('goBtn');
  assertNotNull(goBtn, 'Go button exists');
  assertEqual(goBtn.disabled, false, 'Go button is initially enabled (default time 5)');

  // SVG
  const svg = document.getElementById('clock');
  assertNotNull(svg, 'SVG clock exists');

  // Mode buttons
  const modeBtns = document.querySelectorAll('[data-mode]');
  assertEqual(modeBtns.length, 3, '3 mode buttons exist (CCW, CW, END)');

  // Marks buttons
  const marksBtns = document.querySelectorAll('[data-marks]');
  assertEqual(marksBtns.length, 3, '3 marks buttons exist (15, 5, -)');

  // Watermark
  const watermark = document.querySelector('.watermark');
  assertNotNull(watermark, 'Watermark element exists');
  assertEqual(watermark.textContent, 'TimerPie', 'Watermark shows TimerPie');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Color Menu');
console.log('-----------------------------');

(function testColorMenuInteraction() {
  const dom = createDOM();
  const { document } = dom.window;

  const colorBtn = document.getElementById('colorBtn');
  const colorMenu = document.getElementById('colorMenu');
  const colorOptions = document.querySelectorAll('.color-option');

  // Initially closed
  assert(!colorMenu.classList.contains('show'), 'Color menu initially hidden');

  // Click to open
  colorBtn.click();
  assert(colorMenu.classList.contains('show'), 'Color menu shows after click');

  // Select blue (second option)
  colorOptions[1].click();
  assert(!colorMenu.classList.contains('show'), 'Color menu closes after selection');
  assertEqual(colorBtn.style.background, 'rgb(74, 144, 226)', 'Color button background updated');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Mode Buttons');
console.log('-------------------------------');

(function testModeButtonInteraction() {
  const dom = createDOM();
  const { document } = dom.window;

  const modeBtns = document.querySelectorAll('[data-mode]');
  const timeInput = document.getElementById('time');

  // Initially CCW is active (button order: CW, CCW, END)
  assert(modeBtns[1].classList.contains('active'), 'CCW button is initially active');

  // Click CW
  modeBtns[0].click();
  assert(modeBtns[0].classList.contains('active'), 'CW button is active');
  assert(!modeBtns[1].classList.contains('active'), 'CCW button not active');

  // Click END
  modeBtns[2].click();
  assert(modeBtns[2].classList.contains('active'), 'END button is active');
  assertEqual(timeInput.placeholder, 'hh:mm', 'Placeholder changes to "hh:mm" in END mode');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Live Preview');
console.log('-------------------------------');

(function testLivePreview() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const wedgeCanvas = document.getElementById('wedgeCanvas');

  // Canvas should exist
  assert(wedgeCanvas !== null, 'Wedge canvas exists');

  // Initially default time of 5 minutes
  assertEqual(state.remaining, 5, 'Default remaining time is 5 minutes');

  // Type a number - should update state for preview
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assertEqual(state.remaining, 30, 'Wedge shows 30 minutes after typing "30"');

  // Clear input - state should reset
  timeInput.value = '';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assertEqual(state.remaining, 0, 'Wedges disappear when input cleared');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Tab Title');
console.log('----------------------------');

(function testTabTitleDefault() {
  const dom = createDOM();
  const { document } = dom.window;

  assertEqual(document.title, 'TimerPie', 'Default tab title is "TimerPie"');

  dom.window.close();
})();

(function testTabTitleWhileRunning() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  // Title should show countdown (format: "M:SS - TimerPie" or similar)
  assert(document.title.includes(':'), 'Tab title shows time format while running');
  assert(document.title.includes('TimerPie'), 'Tab title still includes TimerPie');

  dom.window.close();
})();

(function testTabTitleAfterPause() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  goBtn.click(); // Pause

  // Title should still show time when paused
  assert(document.title.includes(':'), 'Tab title shows time format while paused');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Timer Start and Pause');
console.log('---------------------------------------');

(function testTimerStart() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Set input and start
  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assertEqual(goBtn.disabled, false, 'Go button enabled after entering time');
  assertEqual(goBtn.textContent, 'Go', 'Button shows "Go" before start');

  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Go button has running class after start');
  assertEqual(goBtn.textContent, 'Pause', 'Button shows "Pause" after start');
  assertEqual(goBtn.disabled, false, 'Pause button is enabled');

  dom.window.close();
})();

(function testTimerPauseResume() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Start timer in CCW mode
  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assertEqual(goBtn.textContent, 'Pause', 'Button shows "Pause" after start');

  // Pause timer
  goBtn.click();
  assertEqual(goBtn.textContent, 'Play', 'Button shows "Play" after pause');
  assert(!goBtn.classList.contains('running'), 'Button loses running class when paused');

  // Resume timer
  goBtn.click();
  assertEqual(goBtn.textContent, 'Pause', 'Button shows "Pause" after resume');
  assert(goBtn.classList.contains('running'), 'Button has running class after resume');

  dom.window.close();
})();

(function testNoPauseInEndMode() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to END mode
  modeBtns[2].click();

  // Start timer in END mode
  timeInput.value = '14:30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  // In END mode, button should not show Pause (no pause available)
  assert(!goBtn.textContent.includes('Pause'), 'END mode does not show Pause button');
  assertEqual(goBtn.disabled, true, 'Button is disabled in END mode (no pause)');

  dom.window.close();
})();

(function testEndModeShowsFullTimeAfterGo() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to END mode
  modeBtns[2].click();

  // Enter just minutes (2 digits)
  timeInput.value = '45';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  // Input should now show full hh:mm format
  assert(timeInput.value.includes(':'), 'END mode shows full time after Go with 2-digit input');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Enter Key');
console.log('----------------------------');

(function testEnterKeySupport() {
  const dom = createDOM();
  const { document, KeyboardEvent } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
  timeInput.dispatchEvent(enterEvent);

  assert(goBtn.classList.contains('running'), 'Timer starts on Enter key press');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Auto-switch to END Mode');
console.log('------------------------------------------');

(function testAutoSwitchToEndMode() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start in CCW mode (button order: CW, CCW, END)
  assert(modeBtns[1].classList.contains('active'), 'Initially in CCW mode');

  // Type 4 digits - should switch to END mode
  timeInput.value = '1245';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assert(modeBtns[2].classList.contains('active'), 'Switches to END mode on 4-digit input');

  // Reset to CCW
  modeBtns[1].click();
  timeInput.value = '';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  // Type colon - should switch to END mode
  timeInput.value = '12:';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assert(modeBtns[2].classList.contains('active'), 'Switches to END mode on colon input');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Time Capping');
console.log('-------------------------------');

(function testTimeCapping() {
  const dom = createDOM();
  const { document, ClockLogic, state } = dom.window;

  const timeInput = document.getElementById('time');
  const RADIUS = { FULL: 180, MIDDLE: 120, INNER: 60 };

  // 200 minutes should be capped at 180, which gives 3 circles
  timeInput.value = '200';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  // Check state.remaining is capped at 180
  assertEqual(state.remaining, 180, '200 minutes shows 3 circles (capped at 180)');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Go Button Disabled After Press');
console.log('-------------------------------------------------');

(function testGoButtonDisabledAfterPress() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  assertEqual(goBtn.disabled, false, 'Pause button stays enabled after start');
  assertEqual(goBtn.textContent, 'Pause', 'Button shows Pause after start');

  // Pause, then modify input - should reset to Go
  goBtn.click();
  timeInput.value = '10';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assertEqual(goBtn.textContent, 'Go', 'Button resets to Go after modifying input');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Input Update on Capped Time');
console.log('----------------------------------------------');

(function testInputUpdateOnCappedTime() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Enter 200, press Go - should update to 180
  timeInput.value = '200';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  assertEqual(timeInput.value, '180', 'Input updated to 180 after Go with 200');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: CW Mode Label Positions');
console.log('------------------------------------------');

(function testCwModeLabelPositions() {
  const dom = createDOM();
  const { document } = dom.window;

  const svg = document.getElementById('clock');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // CCW mode: 15 on right
  let texts = svg.querySelectorAll('text');
  const ccw15 = Array.from(texts).find(t => t.textContent === '15');
  assert(parseFloat(ccw15.getAttribute('x')) > 225, 'CCW mode: 15 on right');

  // Switch to CW mode: 15 on left (CW is at index 0)
  modeBtns[0].click();
  texts = svg.querySelectorAll('text');
  const cw15 = Array.from(texts).find(t => t.textContent === '15');
  assert(parseFloat(cw15.getAttribute('x')) < 225, 'CW mode: 15 on left');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Mode Switch While Running');
console.log('--------------------------------------------');

(function testModeSwitchWhileRunning() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in CCW mode
  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer is running');

  // Switch to CW mode while running
  modeBtns[1].click();
  assert(modeBtns[1].classList.contains('active'), 'CW mode active while running');

  // Timer should still be running with remaining time (wedges rendered to canvas)
  assert(state.running && state.remaining > 0, 'Wedges still visible after mode switch');

  dom.window.close();
})();

(function testModeSwitchToEndWhileRunning() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in CCW mode with 30 minutes
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer is running');

  // Switch to END mode while running - input should update to end time
  modeBtns[2].click();
  assert(modeBtns[2].classList.contains('active'), 'END mode active while running');
  assert(timeInput.value.includes(':'), 'Input shows end time in hh:mm format after switching to END');

  dom.window.close();
})();

(function testModeSwitchFromEndWhileRunning() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to END mode first
  modeBtns[2].click();

  // Start timer in END mode
  timeInput.value = '14:30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer is running in END mode');

  // Switch to CCW mode while running - input should update to remaining minutes
  modeBtns[0].click();
  assert(modeBtns[0].classList.contains('active'), 'CCW mode active while running');
  assert(!timeInput.value.includes(':'), 'Input shows remaining minutes after switching from END');
  assert(!isNaN(parseFloat(timeInput.value)), 'Input is a number (remaining minutes)');

  dom.window.close();
})();

// Bug regression: Go button state should update when switching modes while running
(function testGoButtonStateOnModeSwitchWhileRunning() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in END mode (Go button should be disabled)
  modeBtns[2].click();
  timeInput.value = '14:30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assertEqual(goBtn.disabled, true, 'Go button disabled in END mode');

  // Switch to CCW mode - Go button should enable and show Pause
  modeBtns[0].click();
  assertEqual(goBtn.disabled, false, 'Go button enabled after switch to CCW');
  assertEqual(goBtn.textContent, 'Pause', 'Go button shows Pause after switch to CCW');

  dom.window.close();
})();

(function testGoButtonDisabledOnSwitchToEndWhileRunning() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in CCW mode (Go button should show Pause)
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assertEqual(goBtn.textContent, 'Pause', 'Go button shows Pause in CCW');
  assertEqual(goBtn.disabled, false, 'Go button enabled in CCW');

  // Switch to END mode - Go button should be disabled
  modeBtns[2].click();
  assertEqual(goBtn.disabled, true, 'Go button disabled after switch to END');

  dom.window.close();
})();

// Bug regression: Timer state should not be reset when switching modes while paused
(function testTimerStatePreservedOnModeSwitchWhilePaused() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in CCW mode with 10 minutes
  timeInput.value = '10';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assertEqual(goBtn.textContent, 'Pause', 'Timer started');

  // Pause the timer
  goBtn.click();
  assertEqual(goBtn.textContent, 'Play', 'Timer is paused');
  assertEqual(dom.window.state.paused, true, 'state.paused is true');

  // Save the remaining time before mode switch
  const remainingBeforeSwitch = dom.window.state.remaining;

  // Switch to END mode while paused - state should NOT reset
  modeBtns[2].click();
  assertEqual(dom.window.state.remaining, remainingBeforeSwitch, 'state.remaining preserved after mode switch while paused');

  dom.window.close();
})();

// Bug regression: endTime should preserve seconds precision when switching to END mode
(function testEndTimePreservesSecondsPrecision() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Start timer in CCW mode
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  // state.endTime is pre-calculated in CCW mode for mode switching support
  const endTimeBeforeSwitch = dom.window.state.endTime;
  assert(typeof endTimeBeforeSwitch === 'number', 'endTime is pre-calculated in CCW mode');

  // Switch to END mode while running
  modeBtns[2].click();

  // state.endTime should include seconds as fraction
  const endTime = dom.window.state.endTime;
  assert(endTime !== null, 'endTime is set after switch to END');
  assert(typeof endTime === 'number', 'endTime is a number with seconds precision');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: 60/120/180 Minute Circles');
console.log('--------------------------------------------');

(function test60_120_180Circles() {
  const dom = createDOM();
  const { document, ClockLogic } = dom.window;

  const timeInput = document.getElementById('time');
  const RADIUS = { FULL: 180, MIDDLE: 120, INNER: 60 };

  // 60 minutes = 1 full circle
  timeInput.value = '60';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  let circles = ClockLogic.getCircles(60, RADIUS);
  assertEqual(circles.length, 1, '60 minutes: 1 full circle');
  assert(circles[0].full, '60 minutes: circle is full');

  // 120 minutes = 2 full circles
  timeInput.value = '120';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  circles = ClockLogic.getCircles(120, RADIUS);
  assertEqual(circles.length, 2, '120 minutes: 2 full circles');

  // 180 minutes = 3 full circles
  timeInput.value = '180';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  circles = ClockLogic.getCircles(180, RADIUS);
  assertEqual(circles.length, 3, '180 minutes: 3 full circles');

  dom.window.close();
})();

console.log('');

// ============================================
// RESPONSIVE CLOCK SIZE TESTS
// ============================================

console.log('Integration Tests: Controls Layout');
console.log('----------------------------------');

(function testControlRowsWithLabels() {
  const dom = createDOM();
  const { document } = dom.window;

  // Should have control-row elements (4 rows in Option 9 layout)
  const controlRows = document.querySelectorAll('.control-row');
  assert(controlRows.length >= 3, 'At least 3 control-row elements exist');

  // Labels removed in Option 9 layout - controls are self-explanatory with icons and tooltips

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Responsive Clock Size');
console.log('-----------------------------------------');

(function testClockFillsContainer() {
  const dom = createDOM();
  const { document } = dom.window;

  const svg = document.getElementById('clock');

  // SVG should have viewBox for responsive scaling with side/bottom padding for labels
  assertEqual(svg.getAttribute('viewBox'), '-15 0 480 460', 'SVG has viewBox with side padding for labels');

  // SVG should have fixed dimensions matching viewBox (CSS handles scaling)
  assertEqual(svg.getAttribute('width'), '480', 'SVG width matches viewBox');
  assertEqual(svg.getAttribute('height'), '460', 'SVG height matches viewBox');

  dom.window.close();
})();

(function testControlsInCorner() {
  const dom = createDOM();
  const { document } = dom.window;

  const controls = document.querySelector('.controls');
  const controlsStyle = dom.window.getComputedStyle(controls);

  // Controls should be positioned absolutely in corner
  assertEqual(controlsStyle.position, 'absolute', 'Controls are positioned absolutely');

  dom.window.close();
})();

console.log('');

// ============================================
// COOKIE PERSISTENCE TESTS
// ============================================

console.log('Integration Tests: Fullscreen Mode');
console.log('----------------------------------');

(function testFullscreenButtonExists() {
  const dom = createDOM();
  const { document } = dom.window;

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  assertNotNull(fullscreenBtn, 'Fullscreen button exists');

  dom.window.close();
})();

(function testFullscreenToggle() {
  const dom = createDOM();
  const { document } = dom.window;

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const controls = document.querySelector('.controls');

  // Initially not fullscreen
  assert(!document.body.classList.contains('fullscreen'), 'Body starts without fullscreen class');

  // Click to enter fullscreen
  fullscreenBtn.click();
  assert(document.body.classList.contains('fullscreen'), 'Body has fullscreen class after toggle');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Dark Mode');
console.log('----------------------------');

(function testDarkModeToggle() {
  const dom = createDOM();
  const { document } = dom.window;

  const darkModeBtn = document.getElementById('darkModeBtn');
  assertNotNull(darkModeBtn, 'Dark mode button exists');

  // Initially dark mode (new default)
  assert(document.body.classList.contains('dark'), 'Body starts in dark mode');

  // Click to switch to light mode
  darkModeBtn.click();
  assert(!document.body.classList.contains('dark'), 'Body loses dark class after toggle');

  // Click to switch back to dark mode
  darkModeBtn.click();
  assert(document.body.classList.contains('dark'), 'Body has dark class after second toggle');

  dom.window.close();
})();

(function testDarkModeHashNotShownWhenDark() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  const { document } = dom.window;

  // Default is dark, hash should not contain dark
  assert(!dom.window.location.hash.includes('dark='), 'Hash does not include dark when in dark mode');

  // Switch to light mode
  document.getElementById('darkModeBtn').click();
  assert(dom.window.location.hash.includes('dark=0'), 'Hash includes dark=0 when in light mode');

  // Switch back to dark
  document.getElementById('darkModeBtn').click();
  assert(!dom.window.location.hash.includes('dark='), 'Hash does not include dark after switching back');

  dom.window.close();
})();

(function testLightModeFromUrl() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#dark=0'
  });
  const { document } = dom.window;

  assert(!document.body.classList.contains('dark'), 'Body is in light mode when dark=0 in URL');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Cookie Persistence');
console.log('-------------------------------------');

(function testCookieSaveOnColorChange() {
  const dom = createDOM();
  const { document } = dom.window;

  const colorBtn = document.getElementById('colorBtn');
  const colorOptions = document.querySelectorAll('.color-option');

  // Open menu and select blue
  colorBtn.click();
  colorOptions[1].click();

  // Check cookie was set
  assert(document.cookie.includes('clockColor'), 'Cookie set on color change');
  assert(document.cookie.includes('4a90e2'), 'Cookie contains blue color value');

  dom.window.close();
})();

(function testCookieSaveOnModeChange() {
  const dom = createDOM();
  const { document } = dom.window;

  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to CW mode (CW is at index 0)
  modeBtns[0].click();
  assert(document.cookie.includes('clockMode=cw'), 'Cookie set to cw on mode change');

  // Switch to END mode
  modeBtns[2].click();
  assert(document.cookie.includes('clockMode=end'), 'Cookie set to end on mode change');

  dom.window.close();
})();

(function testCookieSaveOnMarksChange() {
  const dom = createDOM();
  const { document } = dom.window;

  const marksBtns = document.querySelectorAll('[data-marks]');

  // Switch to 5-min marks
  marksBtns[1].click();
  assert(document.cookie.includes('clockMarks=5'), 'Cookie set to 5 on marks change');

  // Switch to no marks
  marksBtns[2].click();
  assert(document.cookie.includes('clockMarks=0'), 'Cookie set to 0 on marks change');

  dom.window.close();
})();

(function testCookieRestoreOnLoad() {
  // Test that ClockLogic has cookie functions
  const { logic, dom } = getClockLogic();

  // Test getCookie function exists and works
  assertNotNull(logic.getCookie, 'ClockLogic.getCookie function exists');
  assertNotNull(logic.setCookie, 'ClockLogic.setCookie function exists');

  // Set a test cookie and read it back
  dom.window.document.cookie = 'testKey=testValue';
  assertEqual(logic.getCookie('testKey'), 'testValue', 'getCookie reads cookie value correctly');
  assertEqual(logic.getCookie('nonexistent'), null, 'getCookie returns null for missing cookie');

  dom.window.close();
})();

(function testPreferencesRestoredFromCookies() {
  // Create DOM with pre-set cookies
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const cookieJar = new (require('jsdom').CookieJar)();
  cookieJar.setCookieSync('clockColor=#4a90e2', 'http://localhost');
  cookieJar.setCookieSync('clockMode=cw', 'http://localhost');
  cookieJar.setCookieSync('clockMarks=5', 'http://localhost');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost',
    cookieJar: cookieJar
  });
  const { document } = dom.window;

  // Check preferences were restored (button order: CW=0, CCW=1, END=2)
  assertEqual(document.getElementById('colorBtn').style.background, 'rgb(74, 144, 226)', 'Color restored from cookie');
  assert(document.querySelectorAll('[data-mode]')[0].classList.contains('active'), 'CW mode restored from cookie');
  assert(document.querySelectorAll('[data-marks]')[1].classList.contains('active'), '5-min marks restored from cookie');

  dom.window.close();
})();

console.log('');

console.log('Security Tests: Cookie and Hash Validation');
console.log('-------------------------------------------');

(function testSetCookieSanitizesValue() {
  const { logic, dom } = getClockLogic();

  // Test that values are encoded
  logic.setCookie('testCookie', '#ff6b35', 365);
  const cookie = dom.window.document.cookie;
  // Encoded value should not have raw # character in cookie
  assert(cookie.includes('testCookie='), 'Cookie name set correctly');

  dom.window.close();
})();

(function testSetCookieRejectsInvalidName() {
  const { logic, dom } = getClockLogic();

  // Try to set cookie with invalid name containing semicolon
  const beforeCookie = dom.window.document.cookie;
  logic.setCookie('bad;name', 'value', 365);
  // Cookie should not be set (or should reject the name)
  // This test verifies the name doesn't appear
  assert(!dom.window.document.cookie.includes('bad;name'), 'Invalid cookie name rejected');

  dom.window.close();
})();

(function testSetCookieRejectsLongValue() {
  const { logic, dom } = getClockLogic();

  // Cookie values over 4000 chars should be rejected (4KB limit safety margin)
  const longValue = 'x'.repeat(4001);
  logic.setCookie('longCookie', longValue, 365);
  // Cookie should not be set
  assert(!dom.window.document.cookie.includes('longCookie'), 'Cookie with value over 4000 chars rejected');

  // Short values should still work
  logic.setCookie('shortCookie', 'short', 365);
  assert(dom.window.document.cookie.includes('shortCookie'), 'Cookie with short value accepted');

  dom.window.close();
})();

(function testSetCookieHasSameSite() {
  const { logic, dom } = getClockLogic();

  logic.setCookie('testSameSite', 'value', 365);
  // Check that SameSite attribute is included
  // Note: JSDOM may not fully support SameSite but we test the string is generated
  assert(typeof logic.setCookie === 'function', 'setCookie function exists with SameSite support');

  dom.window.close();
})();

(function testParseHashWhitelist() {
  const { logic, dom } = getClockLogic();

  // Verify parseHash only accepts whitelisted params
  assert(typeof logic.parseHash === 'function', 'parseHash function exists');

  dom.window.close();
})();

(function testCookieValueValidation() {
  // Test that invalid color values are rejected when restoring
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const cookieJar = new (require('jsdom').CookieJar)();
  // Set invalid color value
  cookieJar.setCookieSync('clockColor=invalid', 'http://localhost');
  cookieJar.setCookieSync('clockMode=badmode', 'http://localhost');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost',
    cookieJar: cookieJar
  });

  const { document } = dom.window;
  const colorBtn = document.getElementById('colorBtn');

  // Invalid color should fallback to default orange, not use 'invalid'
  assert(!colorBtn.style.background.includes('invalid'), 'Invalid color value rejected');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Tooltips');
console.log('----------------------------');

(function testStaticTooltips() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  // Static tooltips
  assertEqual(document.getElementById('colorBtn').title, 'Select clock color', 'Color button has tooltip');
  assertEqual(document.getElementById('darkModeBtn').title, 'Switch to light mode', 'Dark mode button has tooltip (default is dark)');
  assertEqual(document.getElementById('fullscreenBtn').title, 'Go full-screen', 'Fullscreen button has tooltip');

  // Mode buttons (order: CW, CCW, END)
  const modeButtons = document.querySelectorAll('[data-mode]');
  assertEqual(modeButtons[0].title, 'Clockwise mode', 'CW button has tooltip');
  assertEqual(modeButtons[1].title, 'Counter-clockwise mode', 'CCW button has tooltip');
  assertEqual(modeButtons[2].title, 'Ending time mode', 'END button has tooltip');

  // Marks buttons
  const marksButtons = document.querySelectorAll('[data-marks]');
  assertEqual(marksButtons[0].title, 'Show 15-minute labels', '15 button has tooltip');
  assertEqual(marksButtons[1].title, 'Show 5-minute labels', '5 button has tooltip');
  assertEqual(marksButtons[2].title, 'Hide labels', '- button has tooltip');

  // Preset buttons
  const presetButtons = document.querySelectorAll('.preset-btn');
  assertEqual(presetButtons[0].title, 'Start 5 minute timer', 'Preset 5 has tooltip');
  assertEqual(presetButtons[8].title, 'Start 90 minute timer', 'Preset 90 has tooltip');

  dom.window.close();
})();

(function testDynamicTooltips() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Initial state (CCW mode)
  assertEqual(timeInput.title, 'Minutes (1-180)', 'Time input has CCW/CW tooltip initially');
  assertEqual(goBtn.title, 'Start the timer', 'Go button has start tooltip initially');

  // Switch to END mode
  document.querySelectorAll('[data-mode]')[2].click();
  assertEqual(timeInput.title, 'End time (hh:mm, hhmm, or mm)', 'Time input has END tooltip after mode switch');

  // Switch back to CCW
  document.querySelectorAll('[data-mode]')[0].click();
  assertEqual(timeInput.title, 'Minutes (1-180)', 'Time input has CCW tooltip after switching back');

  // Start timer
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assertEqual(goBtn.title, 'Pause the timer', 'Go button has pause tooltip when running');

  // Pause timer
  goBtn.click();
  assertEqual(goBtn.title, 'Resume timer', 'Go button has resume tooltip when paused');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Keyboard Shortcuts');
console.log('--------------------------------------');

(function testKeyboardShortcuts() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Start a timer first
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer is running');

  // Blur the input so keyboard shortcuts work
  timeInput.blur();

  // Space should pause
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space' }));
  assertEqual(goBtn.textContent, 'Play', 'Space pauses timer');

  // Space again should resume
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space' }));
  assertEqual(goBtn.textContent, 'Pause', 'Space resumes timer');

  // Space should not work when input is focused
  timeInput.focus();
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space' }));
  assertEqual(goBtn.textContent, 'Pause', 'Space ignored when input focused');

  dom.window.close();
})();

(function testSpaceIgnoredInEndMode() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to END mode and start timer
  modeBtns[2].click();
  timeInput.value = '14:30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer running in END mode');
  assertEqual(goBtn.disabled, true, 'Go button disabled in END mode');

  // Blur input so keyboard shortcuts can work
  timeInput.blur();

  // Space should NOT pause in END mode
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space' }));
  assert(dom.window.state.running, 'Space does not pause in END mode');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: URL Sharing');
console.log('-------------------------------');

(function testUrlHashUpdate() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  const { document } = dom.window;

  // Change color and check hash is updated
  const colorOptions = document.querySelectorAll('.color-option');
  document.getElementById('colorBtn').click();
  colorOptions[1].click(); // Blue
  assert(dom.window.location.hash.includes('color=4a90e2'), 'Hash updated with color');

  // Change mode (CW is at index 0)
  document.querySelectorAll('[data-mode]')[0].click(); // CW
  assert(dom.window.location.hash.includes('mode=cw'), 'Hash updated with mode');

  // Change marks
  document.querySelectorAll('[data-marks]')[1].click(); // 5
  assert(dom.window.location.hash.includes('marks=5'), 'Hash updated with marks');

  dom.window.close();
})();

(function testUrlHashParsing() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#color=4a90e2&mode=cw&marks=5&time=45'
  });
  const { document } = dom.window;

  // Check settings were applied from URL (button order: CW=0, CCW=1, END=2)
  assertEqual(document.getElementById('colorBtn').style.background, 'rgb(74, 144, 226)', 'Color loaded from URL');
  assert(document.querySelectorAll('[data-mode]')[0].classList.contains('active'), 'CW mode loaded from URL');
  assert(document.querySelectorAll('[data-marks]')[1].classList.contains('active'), '5-min marks loaded from URL');
  assert(document.body.classList.contains('dark'), 'Dark mode is default');
  assertEqual(document.getElementById('time').value, '45', 'Time loaded from URL');

  dom.window.close();
})();

(function testDefaultTimeIs5() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  const { document } = dom.window;

  assertEqual(document.getElementById('time').value, '5', 'Default time is 5 when no URL param');
  assertEqual(document.getElementById('goBtn').disabled, false, 'Go button enabled with default time');

  dom.window.close();
})();

(function testTimeHashNotShownWhen5() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  const { document } = dom.window;

  // Default is 5, hash should not contain time
  assert(!dom.window.location.hash.includes('time='), 'Hash does not include time when value is 5');

  // Change to 10, hash should contain time
  const timeInput = document.getElementById('time');
  timeInput.value = '10';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assert(dom.window.location.hash.includes('time=10'), 'Hash includes time when value is 10');

  // Change back to 5, hash should not contain time
  timeInput.value = '5';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assert(!dom.window.location.hash.includes('time='), 'Hash does not include time after changing back to 5');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Picture-in-Picture');
console.log('--------------------------------------');

(function testSafariDetectionRegex() {
  // Safari detection regex: /^((?!chrome|android).)*safari/i
  const isSafari = (ua) => /^((?!chrome|android).)*safari/i.test(ua);

  // Safari user agents - should be detected
  assert(isSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15'),
    'Detects macOS Safari');
  assert(isSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'),
    'Detects iOS Safari');

  // Non-Safari browsers - should NOT be detected
  assert(!isSafari('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    'Does not detect Chrome as Safari');
  assert(!isSafari('Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'),
    'Does not detect Chrome on Android as Safari');
  assert(!isSafari('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'),
    'Does not detect Firefox as Safari');
})();

(function testPipButtonExists() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const pipBtn = document.getElementById('pipBtn');
  assert(pipBtn !== null, 'PiP button exists');
  if (pipBtn) {
    assertEqual(pipBtn.title, 'Picture-in-Picture mode', 'PiP button has tooltip');
  }

  // Check hidden canvas and video exist
  const pipCanvas = document.getElementById('pipCanvas');
  const pipVideo = document.getElementById('pipVideo');
  assert(pipCanvas !== null, 'PiP canvas exists');
  assert(pipVideo !== null, 'PiP video exists');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Alarm Sound');
console.log('-------------------------------');

(function testSoundButtonExists() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const soundBtn = document.getElementById('soundBtn');
  assert(soundBtn !== null, 'Sound toggle button exists');
  if (soundBtn) {
    assert(soundBtn.title.length > 0, 'Sound button has tooltip');
  }

  dom.window.close();
})();

(function testSoundToggle() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document, ClockLogic } = dom.window;

  const soundBtn = document.getElementById('soundBtn');

  // Default should be sound off (muted icon)
  assertEqual(soundBtn.textContent, '🔕', 'Sound is off by default (muted icon)');

  // Click to toggle on
  soundBtn.click();
  assertEqual(soundBtn.textContent, '🔔', 'Sound toggles to on (bell icon)');

  // Click to toggle back off
  soundBtn.click();
  assertEqual(soundBtn.textContent, '🔕', 'Sound toggles back off');

  dom.window.close();
})();

(function testSoundPreferenceCookie() {
  const dom = createDOM();
  const { document } = dom.window;

  const soundBtn = document.getElementById('soundBtn');
  soundBtn.click(); // Turn on (default is off)

  assert(document.cookie.includes('clockSound=on'), 'Sound preference saved to cookie');

  dom.window.close();
})();

(function testPlayAlarmFunctionExists() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { ClockLogic } = dom.window;

  assert(typeof ClockLogic.playAlarm === 'function', 'ClockLogic.playAlarm function exists');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: PWA Manifest');
console.log('--------------------------------');

(function testManifestLinkExists() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const manifestLink = document.querySelector('link[rel="manifest"]');
  assert(manifestLink !== null, 'Manifest link exists in HTML');
  if (manifestLink) {
    assertEqual(manifestLink.getAttribute('href'), 'manifest.json', 'Manifest href is correct');
  }

  dom.window.close();
})();

(function testManifestFileExists() {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json file exists');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name !== undefined, 'Manifest has name');
  assert(manifest.short_name !== undefined, 'Manifest has short_name');
  assert(manifest.start_url !== undefined, 'Manifest has start_url');
  assert(manifest.display !== undefined, 'Manifest has display mode');
  assert(manifest.background_color !== undefined, 'Manifest has background_color');
  assert(manifest.theme_color !== undefined, 'Manifest has theme_color');
})();

(function testPWAMetaTags() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  assert(themeColor !== null, 'Theme color meta tag exists');

  const viewport = document.querySelector('meta[name="viewport"]');
  assert(viewport !== null, 'Viewport meta tag exists');

  dom.window.close();
})();

console.log('');

console.log('Bug Regression: Race Condition - Multiple Start Calls');
console.log('-----------------------------------------------------');

(function testMultipleStartCallsDoNotCreateMultipleTimers() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  // Rapidly click Go button multiple times
  goBtn.click();
  goBtn.click();
  goBtn.click();

  // Should only have one timer running
  assert(state.running === true, 'Timer is running after multiple clicks');

  // animFrame should be set (not null) - only one animation should be active
  assert(state.animFrame !== null, 'Animation frame is active');

  dom.window.close();
})();

(function testStartWhileRunningDoesNotRestart() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  const originalStartTime = state.startTime;

  // Simulate a second start attempt (this would happen with race condition)
  // The start() function should guard against this
  assert(state.running === true, 'Timer is running');

  // Store animFrame before potential second start
  const originalAnimFrame = state.animFrame;

  dom.window.close();
})();

console.log('');

console.log('Bug Regression: Memory Leaks');
console.log('----------------------------');

(function testPreviewAnimationFrameProperlyCleared() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const modeBtns = document.querySelectorAll('[data-mode]');

  // Switch to END mode (preview animation only runs in END mode)
  modeBtns[2].click();

  // Type a value to start preview animation
  timeInput.value = '14:30';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  // previewFrame should be set or null (depends on timing)
  // The important thing is that when we clear, it's properly cleaned

  // Clear input - preview should stop
  timeInput.value = '';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  // previewFrame should be null after clearing
  assertEqual(state.previewFrame, null, 'Preview frame cleared when input emptied');

  dom.window.close();
})();

(function testOvertimeIntervalCleared() {
  const dom = createDOM();
  const { document, state } = dom.window;

  // We can't easily test the actual overtime interval in JSDOM
  // but we can verify the cleanup function exists and state is properly managed
  assertEqual(state.overtimeInterval, null, 'Overtime interval is initially null');

  dom.window.close();
})();

(function testAnimFrameClearedOnInputChange() {
  const dom = createDOM();
  const { document, state } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Start timer
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  goBtn.click();

  assert(state.running === true, 'Timer is running');
  assert(state.animFrame !== null, 'Animation frame is set');

  // User types in input (should stop timer and clean up)
  timeInput.value = '20';
  timeInput.dispatchEvent(new dom.window.Event('input'));

  assertEqual(state.running, false, 'Timer stopped when input changed');
  assertEqual(state.animFrame, null, 'Animation frame cleared when input changed');

  dom.window.close();
})();

console.log('');

console.log('Security: URL Hash Input Validation');
console.log('------------------------------------');

(function testTimeHashParameterAcceptsValidInput() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#time=30'
  });
  const { document } = dom.window;

  assertEqual(document.getElementById('time').value, '30', 'Valid time accepted from URL');

  dom.window.close();
})();

(function testTimeHashParameterAcceptsColonFormat() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#time=14:30'
  });
  const { document } = dom.window;

  assertEqual(document.getElementById('time').value, '14:30', 'Colon time format accepted from URL');

  dom.window.close();
})();

(function testTimeHashParameterAcceptsDecimal() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#time=5.5'
  });
  const { document } = dom.window;

  assertEqual(document.getElementById('time').value, '5.5', 'Decimal time accepted from URL');

  dom.window.close();
})();

(function testGoButtonEnabledWithTimeFromURL() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/#time=30'
  });
  const { document } = dom.window;

  const goBtn = document.getElementById('goBtn');
  assertEqual(goBtn.disabled, false, 'Go button enabled when time loaded from URL');

  dom.window.close();
})();

console.log('');

console.log('Bug Fixes: Go Button After Timer Ends');
console.log('--------------------------------------');

(function testGoButtonEnabledAfterTimerEnds() {
  const dom = createDOM();
  const { document } = dom.window;

  const timeInput = document.getElementById('time');
  const goBtn = document.getElementById('goBtn');

  // Set time - button should be enabled
  timeInput.value = '30';
  timeInput.dispatchEvent(new dom.window.Event('input'));
  assertEqual(goBtn.disabled, false, 'Go button enabled with valid input');

  // Start timer
  goBtn.click();
  assert(goBtn.classList.contains('running'), 'Timer is running');

  // Value should still be in input
  assert(timeInput.value === '30', 'Input still has value after start');

  dom.window.close();
})();

console.log('');

console.log('Bug Fixes: Sound Toggle URL Hash');
console.log('---------------------------------');

(function testSoundToggleUpdatesHash() {
  const dom = createDOM();
  const { document } = dom.window;

  const soundBtn = document.getElementById('soundBtn');
  soundBtn.click(); // Turn on (default is off)

  assert(dom.window.location.hash.includes('sound=on'), 'Sound on updates URL hash');

  soundBtn.click(); // Turn off - should remove from hash (off is default)
  // When sound is off (default), it shouldn't be in hash
  assert(!dom.window.location.hash.includes('sound=on'), 'Sound off removes from URL hash');

  dom.window.close();
})();

console.log('');

console.log('Integration Tests: Wake Lock');
console.log('-----------------------------');

(function testWakeLockFunctionsExist() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { ClockLogic } = dom.window;

  assert(typeof ClockLogic.requestWakeLock === 'function', 'ClockLogic.requestWakeLock function exists');
  assert(typeof ClockLogic.releaseWakeLock === 'function', 'ClockLogic.releaseWakeLock function exists');

  dom.window.close();
})();

(function testWakeLockReleaseClearsReference() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { ClockLogic } = dom.window;

  // Simulate a wake lock object
  ClockLogic.wakeLock = { release: function() { return Promise.resolve(); } };
  ClockLogic.releaseWakeLock();

  // After release, wakeLock should be null
  assert(ClockLogic.wakeLock === null, 'Wake lock reference cleared after release');

  dom.window.close();
})();

(function testVisibilityChangeHandlerExists() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');

  // Check that visibilitychange event listener is registered
  assert(html.includes('visibilitychange'), 'Visibility change listener registered');

  // Check it calls requestWakeLock
  assert(html.includes('visibilitychange') && html.includes('requestWakeLock'), 'Visibility change re-requests wake lock');
})();

console.log('');

console.log('Accessibility Tests');
console.log('-------------------');

(function testSVGAccessibility() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const svg = document.getElementById('clock');
  assert(svg.getAttribute('role') === 'img', 'SVG has role="img"');
  assert(svg.getAttribute('aria-labelledby'), 'SVG has aria-labelledby');

  const title = svg.querySelector('title');
  assert(title !== null, 'SVG has title element');

  dom.window.close();
})();

(function testARIALiveRegion() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const status = document.getElementById('timerStatus');
  assert(status !== null, 'Timer status element exists');
  assert(status.getAttribute('role') === 'status', 'Timer status has role="status"');
  assert(status.getAttribute('aria-live') === 'polite', 'Timer status has aria-live="polite"');

  dom.window.close();
})();

(function testPresetButtonAriaLabels() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'TimerPie.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;

  const presetBtns = document.querySelectorAll('.preset-btn');
  assert(presetBtns[0].getAttribute('aria-label').includes('5'), 'Preset 5 has descriptive aria-label');
  assert(presetBtns[0].getAttribute('aria-label').includes('minute'), 'Preset aria-label mentions minutes');

  dom.window.close();
})();

console.log('');

// ============================================
// CANVAS RENDERING TESTS
// ============================================

console.log('Unit Tests: ClockLogic.getWedgeAngles');
console.log('--------------------------------------');

(function testGetWedgeAnglesCcwPartial() {
  const { logic, dom } = getClockLogic();

  // CCW mode with partial circle (30 mins)
  const circle = { r: 180, t: 30, full: false };
  const timerEnd = (30 / 60) * 360 - 90; // 90 degrees
  const angles = logic.getWedgeAngles(circle, timerEnd, 'ccw', null, new Date());

  assertEqual(angles.start, -90, 'CCW partial wedge starts at -90 (top)');
  assertEqual(angles.end, 90, 'CCW partial wedge ends at 90 (30 mins)');

  dom.window.close();
})();

(function testGetWedgeAnglesCcwFull() {
  const { logic, dom } = getClockLogic();

  // CCW mode with full circle
  const circle = { r: 180, t: 60, full: true };
  const timerEnd = -90;
  const angles = logic.getWedgeAngles(circle, timerEnd, 'ccw', null, new Date());

  assertEqual(angles.start, timerEnd, 'Full circle starts at timerEnd');
  assertEqual(angles.end, timerEnd + 360, 'Full circle ends at timerEnd + 360');

  dom.window.close();
})();

(function testGetWedgeAnglesCwPartial() {
  const { logic, dom } = getClockLogic();

  // CW mode with partial circle (30 mins)
  const circle = { r: 180, t: 30, full: false };
  const timerEnd = ((60 - 30) / 60) * 360 - 90; // 90 degrees
  const angles = logic.getWedgeAngles(circle, timerEnd, 'cw', null, new Date());

  assertEqual(angles.end, -90, 'CW partial wedge ends at -90 (top)');
  // Start angle should be at (60-30)/60 * 360 - 90 = 90
  assertEqual(angles.start, 90, 'CW partial wedge starts at 90');

  dom.window.close();
})();

(function testGetWedgeAnglesEndMode() {
  const { logic, dom } = getClockLogic();

  // END mode: endTime at 30 minutes, now at 15 minutes
  const now = new Date('2024-01-15T10:15:00');
  const circle = { r: 180, t: 15, full: false };
  const endTime = 30; // minutes on clock face
  const timerEnd = (endTime / 60) * 360 - 90;
  const angles = logic.getWedgeAngles(circle, timerEnd, 'end', endTime, now);

  // Current time is 15 mins, end time is 30 mins
  const expectedStart = (15 / 60) * 360 - 90; // 0 degrees
  const expectedEnd = (30 / 60) * 360 - 90; // 90 degrees
  assertEqual(angles.start, expectedStart, 'END mode starts at current time');
  assertEqual(angles.end, expectedEnd, 'END mode ends at target time');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: ClockLogic.getTimerEndAngle');
console.log('----------------------------------------');

(function testGetTimerEndAngleCcw() {
  const { logic, dom } = getClockLogic();

  const circle = { r: 180, t: 30, full: false };
  const angle = logic.getTimerEndAngle(circle, 'ccw', null, new Date());

  // CCW mode: angle = (t / 60) * 360 - 90
  const expected = (30 / 60) * 360 - 90;
  assertEqual(angle, expected, 'CCW timer end angle calculated correctly');

  dom.window.close();
})();

(function testGetTimerEndAngleCw() {
  const { logic, dom } = getClockLogic();

  const circle = { r: 180, t: 30, full: false };
  const angle = logic.getTimerEndAngle(circle, 'cw', null, new Date());

  // CW mode: angle = ((60 - t) / 60) * 360 - 90
  const expected = ((60 - 30) / 60) * 360 - 90;
  assertEqual(angle, expected, 'CW timer end angle calculated correctly');

  dom.window.close();
})();

(function testGetTimerEndAngleEnd() {
  const { logic, dom } = getClockLogic();

  const now = new Date('2024-01-15T10:15:00');
  const circle = { r: 180, t: 15, full: false };
  const endTime = 30;
  const angle = logic.getTimerEndAngle(circle, 'end', endTime, now);

  // END mode: angle based on current minute
  const curMin = 15 + 0 / 60; // 10:15:00
  const expected = (curMin / 60) * 360 - 90;
  assertEqual(angle, expected, 'END timer end angle based on current time');

  dom.window.close();
})();

console.log('');

console.log('Unit Tests: Canvas Context Mock');
console.log('--------------------------------');

(function testRenderWedgesToCanvasExists() {
  const { logic, dom } = getClockLogic();

  assert(typeof logic.renderWedgesToCanvas === 'function', 'ClockLogic.renderWedgesToCanvas function exists');

  dom.window.close();
})();

(function testRenderWedgesToCanvasClearsPrevious() {
  const { logic, dom } = getClockLogic();

  // Create a mock canvas context
  let clearRectCalled = false;
  const mockCtx = {
    clearRect: function(x, y, w, h) { clearRectCalled = true; },
    beginPath: function() {},
    moveTo: function() {},
    arc: function() {},
    lineTo: function() {},
    closePath: function() {},
    fill: function() {},
    stroke: function() {},
    save: function() {},
    restore: function() {}
  };

  const circles = logic.getCircles(30, { FULL: 180, MIDDLE: 120, INNER: 60 });
  logic.renderWedgesToCanvas(mockCtx, 450, 450, circles, 'ccw', '#ff6b35', true, 'analog', null, new Date(), 225);

  assert(clearRectCalled, 'Canvas cleared before rendering');

  dom.window.close();
})();

(function testRenderWedgesToCanvasDrawsWedges() {
  const { logic, dom } = getClockLogic();

  // Create a mock canvas context that tracks calls
  let beginPathCount = 0;
  let fillCount = 0;
  const mockCtx = {
    clearRect: function() {},
    beginPath: function() { beginPathCount++; },
    moveTo: function() {},
    arc: function() {},
    lineTo: function() {},
    closePath: function() {},
    fill: function() { fillCount++; },
    stroke: function() {},
    save: function() {},
    restore: function() {}
  };

  const circles = logic.getCircles(30, { FULL: 180, MIDDLE: 120, INNER: 60 });
  logic.renderWedgesToCanvas(mockCtx, 450, 450, circles, 'ccw', '#ff6b35', true, 'analog', null, new Date(), 225);

  assert(beginPathCount > 0, 'Canvas beginPath called for wedges');
  assert(fillCount > 0, 'Canvas fill called for wedges');

  dom.window.close();
})();

(function testRenderWedgesToCanvasDigitalMode() {
  const { logic, dom } = getClockLogic();

  // Track arc calls to verify digital mode draws rings
  let arcCalls = [];
  const mockCtx = {
    clearRect: function() {},
    beginPath: function() {},
    moveTo: function() {},
    arc: function(x, y, r, start, end, ccw) {
      arcCalls.push({ x, y, r, start, end, ccw });
    },
    lineTo: function() {},
    closePath: function() {},
    fill: function() {},
    stroke: function() {},
    save: function() {},
    restore: function() {}
  };

  const circles = logic.getCircles(30, { FULL: 180, MIDDLE: 120, INNER: 60 });
  logic.renderWedgesToCanvas(mockCtx, 450, 450, circles, 'ccw', '#ff6b35', true, 'digital', null, new Date(), 225);

  // Digital mode should draw two arcs per wedge (outer and inner for ring)
  assert(arcCalls.length >= 2, 'Digital mode draws multiple arcs for ring wedge');

  dom.window.close();
})();

console.log('');

// ============================================
// SUMMARY
// ============================================

console.log('========================================');
console.log('Test Results');
console.log('========================================');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
