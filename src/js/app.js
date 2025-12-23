    // ============================================
    // BACKGROUND TIMER WORKER
    // Web Workers are NOT throttled in background tabs
    // ============================================
    var timerWorker = null;
    try {
      var workerCode = [
        'var endTime = null;',
        'self.onmessage = function(e) {',
        '  if (e.data.type === "start") endTime = e.data.endTime;',
        '  else if (e.data.type === "stop") endTime = null;',
        '};',
        'setInterval(function() {',
        '  if (endTime && Date.now() >= endTime) {',
        '    self.postMessage({ type: "complete" });',
        '    endTime = null;',
        '  }',
        '}, 100);' // Check every 100ms for better accuracy
      ].join('\n');
      var blob = new Blob([workerCode], { type: 'application/javascript' });
      var blobUrl = URL.createObjectURL(blob);
      timerWorker = new Worker(blobUrl);
      URL.revokeObjectURL(blobUrl); // Revoke immediately after worker creation to prevent memory leak
    } catch (e) {
      // Web Worker not available (e.g., file:// protocol) - fallback to main thread
      timerWorker = null;
    }

    // Beep audio is lazy-generated on first alarm (saves ~66KB base64 work on load)

    // Handle worker completion message (runs even in background tabs)
    function handleWorkerComplete() {
      if (!state.running || state.completed) return;
      state.remaining = 0;
      state.running = false;
      state.paused = false;
      ClockLogic.releaseWakeLock();
      document.body.classList.remove('running');
      if (el.goBtn) {
        el.goBtn.classList.remove('running');
        el.goBtn.textContent = 'Go';
        el.goBtn.title = 'Start the timer';
        el.goBtn.disabled = false;
      }
      if (state.animFrame !== null) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = null;
      }
      // Trigger alarm - this is the critical part for background notification
      if (typeof startCompletionBlink === 'function') {
        startCompletionBlink();
      }
      if (typeof updateTitle === 'function') {
        updateTitle();
      }
    }

    if (timerWorker) {
      timerWorker.onmessage = function(e) {
        if (e.data.type === 'complete') {
          handleWorkerComplete();
        }
      };
    }

    // ============================================
    // APPLICATION CONSTANTS
    // ============================================
    const RADIUS = { FULL: 180, MIDDLE: 120, INNER: 60 };
    // Digital mode: ALL rings fit in outer 1/3 zone (180→120)
    const RING_ZONE_OUTER = 180;
    const RING_ZONE_WIDTH = 60;
    const RING_GAP = 2;
    const CENTER = 225;
    const DARKEN = { MIDDLE: 0.7, INNER: 0.5 };
    const TICK = { MAJOR_LENGTH: 15, MINOR_LENGTH: 8, OUTER_OFFSET: 5, LABEL_OFFSET: 35 };
    const PREVIEW_DIM = 0.2;
    const MAX_MINUTES = 180;

    // ============================================
    // APPLICATION STATE
    // ============================================
    const state = {
      color: '#ff6b35',
      mode: 'ccw',
      marks: 5,
      sound: false,
      displayMode: 'analog',
      timeValue: '',
      total: 0,
      remaining: 0,
      running: false,
      paused: false,
      completed: false,
      startTime: null,
      endTime: null,
      animFrame: null,
      previewFrame: null,
      alarmInterval: null,
      completionTime: null,
      overtimeInterval: null
    };
    window.state = state; // Expose for testing

    const el = {
      colorBtn: document.getElementById('colorBtn'),
      colorMenu: document.getElementById('colorMenu'),
      colorOpts: document.querySelectorAll('.color-option'),
      modeBtns: document.querySelectorAll('[data-mode]'),
      markBtns: document.querySelectorAll('[data-marks]'),
      timeInput: document.getElementById('time'),
      goBtn: document.getElementById('goBtn'),
      svg: document.getElementById('clock'),
      wedgeCanvas: document.getElementById('wedgeCanvas'),
      darkModeBtn: document.getElementById('darkModeBtn'),
      soundBtn: document.getElementById('soundBtn'),
      displayModeBtn: document.getElementById('displayModeBtn'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      exitFullscreenBtn: document.getElementById('exitFullscreenBtn'),
      pipBtn: document.getElementById('pipBtn'),
      pipCanvas: document.getElementById('pipCanvas'),
      pipVideo: document.getElementById('pipVideo'),
      infoBtn: document.getElementById('infoBtn'),
      infoModal: document.getElementById('infoModal'),
      infoCloseBtn: document.getElementById('infoCloseBtn'),
      installLink: document.getElementById('installLink'),
      installModal: document.getElementById('installModal'),
      installCloseBtn: document.getElementById('installCloseBtn')
    };
    const wedgeCtx = el.wedgeCanvas ? el.wedgeCanvas.getContext('2d') : null;

    // Canvas and clock wrapper setup
    const clockWrapper = document.getElementById('clockWrapper');
    let canvasScale = 1;

    function resizeClockWrapper() {
      if (!clockWrapper) return;
      const container = clockWrapper.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // SVG viewBox is 480x460 (starts at -15), calculate scale to fit container
      const scaleX = containerWidth / 480;
      const scaleY = containerHeight / 460;
      const scale = Math.min(scaleX, scaleY);
      canvasScale = scale;

      // Size wrapper to scaled dimensions
      const scaledWidth = 480 * scale;
      const scaledHeight = 460 * scale;
      clockWrapper.style.width = scaledWidth + 'px';
      clockWrapper.style.height = scaledHeight + 'px';
      clockWrapper.style.transform = 'translate(-50%, -50%)';

      // Canvas renders at full display resolution for crisp edges
      if (el.wedgeCanvas && wedgeCtx) {
        const dpr = window.devicePixelRatio || 1;
        el.wedgeCanvas.width = scaledWidth * dpr;
        el.wedgeCanvas.height = scaledHeight * dpr;
        el.wedgeCanvas.style.width = scaledWidth + 'px';
        el.wedgeCanvas.style.height = scaledHeight + 'px';
        // Scale context to draw in SVG viewBox coordinates (viewBox starts at -15)
        wedgeCtx.setTransform(scale * dpr, 0, 0, scale * dpr, 15 * scale * dpr, 0);
      }

      // SVG scales via CSS (vector graphics stay crisp)
      if (el.svg) {
        el.svg.style.width = scaledWidth + 'px';
        el.svg.style.height = scaledHeight + 'px';
      }
    }

    resizeClockWrapper();
    window.addEventListener('resize', function() {
      resizeClockWrapper();
      // Redraw canvas after resize (render defined later, called via reference)
      if (typeof render === 'function') render();
    });

    // Create layers for static face, dynamic wedges, and center timer text
    const faceLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const wedgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const timerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    timerText.setAttribute('x', CENTER);
    timerText.setAttribute('y', CENTER);
    timerText.setAttribute('text-anchor', 'middle');
    timerText.setAttribute('dominant-baseline', 'central');
    timerText.setAttribute('font-size', '48');
    timerText.setAttribute('font-weight', 'bold');
    timerText.setAttribute('font-family', "'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace");
    el.svg.appendChild(faceLayer);
    el.svg.appendChild(wedgeLayer);
    el.svg.appendChild(timerText);

    // ============================================
    // APP WRAPPERS (use pure functions with app state)
    // ============================================
    function darken(hex, factor) {
      return ClockLogic.darken(hex, factor);
    }

    function parseInput(input) {
      return ClockLogic.parseInput(input, state.mode, new Date(), MAX_MINUTES);
    }

    function getCircles(time) {
      return ClockLogic.getCircles(time, RADIUS);
    }

    function getLabelPosition(minute) {
      return ClockLogic.getLabelPosition(minute, state.mode, CENTER, RADIUS.FULL + TICK.LABEL_OFFSET);
    }

    function createLabel(minute, fontSize) {
      const pos = getLabelPosition(minute);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', fontSize);
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', document.body.classList.contains('dark') ? '#eee' : '#333');
      text.textContent = minute;
      return text;
    }

    function createClockFace() {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * 360 - 90;
        const rad = angle * Math.PI / 180;
        const quarter = i % 15 === 0; // 0, 15, 30, 45
        const major = i % 5 === 0;
        const outer = RADIUS.FULL + TICK.OUTER_OFFSET;
        const inner = outer - (major ? TICK.MAJOR_LENGTH : TICK.MINOR_LENGTH);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', CENTER + outer * Math.cos(rad));
        line.setAttribute('y1', CENTER + outer * Math.sin(rad));
        line.setAttribute('x2', CENTER + inner * Math.cos(rad));
        line.setAttribute('y2', CENTER + inner * Math.sin(rad));
        line.setAttribute('stroke', document.body.classList.contains('dark') ? '#eee' : '#333');
        line.setAttribute('stroke-width', quarter ? 5 : (major ? 3 : 1));
        g.appendChild(line);
      }

      if (state.marks === 15) {
        [15, 30, 45, 60].forEach(function(m) {
          g.appendChild(createLabel(m, '20'));
        });
      } else if (state.marks === 5) {
        for (let m = 5; m <= 60; m += 5) {
          g.appendChild(createLabel(m, '16'));
        }
      }

      return g;
    }

    function initClockFace() {
      faceLayer.innerHTML = '';
      faceLayer.appendChild(createClockFace());
    }

    function updateTimerText() {
      const isDark = document.body.classList.contains('dark');
      timerText.setAttribute('fill', isDark ? '#eee' : '#333');

      // Only show timer text in digital mode
      if (state.displayMode !== 'digital') {
        timerText.textContent = '';
        return;
      }

      if (state.remaining <= 0) {
        timerText.textContent = '';
        return;
      }

      const mins = Math.floor(state.remaining);
      const secs = Math.round((state.remaining - mins) * 60);
      // Handle edge case where rounding gives 60 seconds
      const displayMins = secs >= 60 ? mins + 1 : mins;
      const displaySecs = secs >= 60 ? 0 : secs;
      timerText.textContent = displayMins + ':' + (displaySecs < 10 ? '0' : '') + displaySecs;
    }

    function updateOvertimeText() {
      if (!state.completed || state.displayMode !== 'digital') return;
      const isDark = document.body.classList.contains('dark');
      timerText.setAttribute('fill', '#fff'); // White on colored background

      const elapsedMs = Date.now() - state.completionTime;
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const mins = Math.floor(elapsedSecs / 60);
      const secs = elapsedSecs % 60;
      timerText.textContent = '-' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function render() {
      const circles = getCircles(state.remaining);

      // Render wedges to canvas using SVG viewBox coordinates
      if (wedgeCtx && el.wedgeCanvas) {
        ClockLogic.renderWedgesToCanvas(
          wedgeCtx,
          480, // SVG viewBox width
          460, // SVG viewBox height
          circles,
          state.mode,
          state.color,
          state.running,
          state.displayMode,
          state.endTime,
          new Date(),
          CENTER,
          document.body.classList.contains('dark')
        );
      }

      // Clear SVG wedge layer (no longer used for rendering, kept for compatibility)
      wedgeLayer.innerHTML = '';

      if (circles.length === 0) {
        // Clear timer text when no circles
        if (state.displayMode === 'digital') {
          timerText.textContent = '';
        }
        return;
      }

      // Update center timer text (digital mode only)
      updateTimerText();
    }

    function startCompletionBlink() {
      state.completed = true;
      state.completionTime = Date.now();
      state.alarmHandle = ClockLogic.playAlarm(state);
      wedgeLayer.innerHTML = '';

      // Announce completion to screen readers
      document.getElementById('timerStatus').textContent = 'Timer completed!';

      const isDark = document.body.classList.contains('dark');

      if (state.displayMode === 'digital') {
        // Digital mode: static colored center + pulsing ring + overtime counter

        // Create static colored center circle (inner 2/3)
        const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerCircle.setAttribute('cx', CENTER);
        centerCircle.setAttribute('cy', CENTER);
        centerCircle.setAttribute('r', RING_ZONE_OUTER - RING_ZONE_WIDTH); // Inner edge = 120
        centerCircle.setAttribute('fill', state.color);
        wedgeLayer.appendChild(centerCircle);

        // Create pulsing ring (outer 1/3 zone) using a donut shape
        const outerR = RING_ZONE_OUTER;
        const innerR = RING_ZONE_OUTER - RING_ZONE_WIDTH;
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = [
          'M', CENTER + outerR, CENTER,
          'A', outerR, outerR, 0, 1, 1, CENTER - outerR, CENTER,
          'A', outerR, outerR, 0, 1, 1, CENTER + outerR, CENTER,
          'M', CENTER + innerR, CENTER,
          'A', innerR, innerR, 0, 1, 0, CENTER - innerR, CENTER,
          'A', innerR, innerR, 0, 1, 0, CENTER + innerR, CENTER,
          'Z'
        ].join(' ');
        ring.setAttribute('d', d);
        ring.setAttribute('fill', state.color);
        ring.setAttribute('fill-rule', 'evenodd');
        ring.setAttribute('class', 'clock-blink-color');
        wedgeLayer.appendChild(ring);

        // Start overtime counter
        updateOvertimeText();
        state.overtimeInterval = setInterval(updateOvertimeText, 1000);
      } else {
        // Analog mode: full circle pulses

        // Create background circle (white in light mode, black in dark mode)
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', CENTER);
        bgCircle.setAttribute('cy', CENTER);
        bgCircle.setAttribute('r', RADIUS.FULL);
        bgCircle.setAttribute('fill', isDark ? '#111' : 'white');
        bgCircle.setAttribute('stroke', isDark ? '#eee' : '#000');
        bgCircle.setAttribute('stroke-width', '2');
        wedgeLayer.appendChild(bgCircle);

        // Create colored circle on top with pulse animation
        const colorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        colorCircle.setAttribute('cx', CENTER);
        colorCircle.setAttribute('cy', CENTER);
        colorCircle.setAttribute('r', RADIUS.FULL);
        colorCircle.setAttribute('fill', state.color);
        colorCircle.setAttribute('class', 'clock-blink-color');
        wedgeLayer.appendChild(colorCircle);
      }
    }

    function stopCompletionBlink() {
      // Always clean up interval defensively (prevents leaks if state.completed is wrong)
      if (state.overtimeInterval) {
        clearInterval(state.overtimeInterval);
        state.overtimeInterval = null;
      }
      if (state.completed) {
        state.completed = false;
        ClockLogic.stopAlarm(state.alarmHandle);
        state.alarmHandle = null;
        timerText.textContent = '';
        wedgeLayer.innerHTML = '';
      }
    }

    var lastAnnouncedMin = -1;
    function updateTitle() {
      if (state.running || state.paused) {
        var mins = Math.floor(state.remaining);
        var secs = Math.round((state.remaining - mins) * 60);
        if (secs >= 60) { mins++; secs = 0; }
        const timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
        document.title = timeStr + ' - TimerPie';
        // Update ARIA live region once per minute to avoid overwhelming screen readers
        if (mins !== lastAnnouncedMin) {
          lastAnnouncedMin = mins;
          document.getElementById('timerStatus').textContent = mins + ' minute' + (mins !== 1 ? 's' : '') + ' remaining';
        }
      } else {
        document.title = 'TimerPie';
        lastAnnouncedMin = -1;
        document.getElementById('timerStatus').textContent = '';
      }
    }

    function animate() {
      const elapsed = (Date.now() - state.startTime) / 60000;
      state.remaining = Math.max(0, state.total - elapsed);

      // In END mode, also check if current time has reached end time
      // Only check when remaining is small (< 2 min) to avoid false positives from mode switching
      if (state.mode === 'end' && state.endTime !== null && state.remaining < 2) {
        const now = new Date();
        const curMin = now.getMinutes() + now.getSeconds() / 60;
        // Check if we've reached or passed the end time
        // Handle hour rollover: if endTime > 30 and curMin < 30, we've rolled over to next hour
        const reachedEndTime = curMin >= state.endTime ||
          (state.endTime > 30 && curMin < 30);
        if (reachedEndTime) {
          state.remaining = 0;
        }
      }

      if (state.remaining <= 0) {
        state.running = false;
        state.paused = false;
        ClockLogic.releaseWakeLock();
        if (timerWorker) timerWorker.postMessage({ type: 'stop' });
        document.body.classList.remove('running');
        el.goBtn.classList.remove('running');
        el.goBtn.textContent = 'Go';
        el.goBtn.title = 'Start the timer';
        // Enable Go button if input has valid value so user can restart
        var parsed = parseInput(el.timeInput.value.trim());
        el.goBtn.disabled = !parsed || !parsed.total;
        updateTitle();
        startCompletionBlink();
        return;
      }

      updateTitle();
      state.animFrame = requestAnimationFrame(animate);
      render();
    }

    function previewAnimate() {
      if (state.running || state.mode !== 'end') {
        state.previewFrame = null;
        return;
      }

      const input = el.timeInput.value.trim();
      if (!input) {
        state.previewFrame = null;
        return;
      }

      const parsed = parseInput(input);
      if (parsed) {
        state.total = parsed.total;
        state.remaining = parsed.total;
        state.endTime = parsed.endTime;
        render();
        state.previewFrame = requestAnimationFrame(previewAnimate);
      } else {
        state.previewFrame = null;
      }
    }

    function stopPreviewAnimation() {
      if (state.previewFrame !== null) {
        cancelAnimationFrame(state.previewFrame);
        state.previewFrame = null;
      }
    }

    function startPreviewAnimation() {
      stopPreviewAnimation();
      if (state.mode === 'end' && !state.running) {
        state.previewFrame = requestAnimationFrame(previewAnimate);
      }
    }

    function start() {
      // Guard against multiple simultaneous starts (race condition)
      if (state.running) return;

      const input = el.timeInput.value.trim();
      if (!input) return;

      const parsed = parseInput(input);
      if (!parsed) return;

      // Stop completion blink if active
      stopCompletionBlink();

      // Cancel preview animation
      stopPreviewAnimation();

      // Cancel any existing animation frame to prevent memory leak
      if (state.animFrame !== null) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = null;
      }

      // Update input field in END mode to show full hh:mm
      if (state.mode === 'end' && !input.includes(':')) {
        // Input was short format (1-4 digits), show full end time
        const endDate = new Date(Date.now() + parsed.total * 60000);
        const h = endDate.getHours();
        const m = endDate.getMinutes();
        el.timeInput.value = h + ':' + (m < 10 ? '0' : '') + m;
      } else if (parsed.total === 180) {
        // Time was capped at max
        if (state.mode === 'end') {
          const endDate = new Date(Date.now() + 180 * 60000);
          const h = endDate.getHours();
          const m = endDate.getMinutes();
          el.timeInput.value = h + ':' + (m < 10 ? '0' : '') + m;
        } else {
          // CCW/CW: check if original input was > 180
          const originalMins = parseFloat(input);
          if (!isNaN(originalMins) && originalMins > 180) {
            el.timeInput.value = '180';
          }
        }
      }

      state.total = parsed.total;
      state.remaining = parsed.total;
      state.startTime = Date.now();

      // Calculate endTime (minute on clock) for mode switching support
      if (parsed.endTime !== null) {
        state.endTime = parsed.endTime;
      } else {
        // Calculate end minute from current time + total minutes
        const endDate = new Date(state.startTime + parsed.total * 60000);
        const endMinute = endDate.getMinutes() + endDate.getSeconds() / 60;
        state.endTime = endMinute;
      }

      state.running = true;
      state.paused = false;
      ClockLogic.requestWakeLock();

      // Start background worker for reliable completion detection
      if (timerWorker) {
        timerWorker.postMessage({
          type: 'start',
          endTime: state.startTime + parsed.total * 60000
        });
      }

      el.goBtn.classList.add('running');
      document.body.classList.add('running');
      if (state.mode === 'end') {
        // No pause in END mode - target time is fixed
        el.goBtn.disabled = true;
      } else {
        el.goBtn.textContent = 'Pause';
        el.goBtn.title = 'Pause the timer';
      }
      animate();
    }

    function pause() {
      if (!state.running || state.paused) return;
      state.paused = true;
      state.running = false;
      ClockLogic.releaseWakeLock();
      if (timerWorker) timerWorker.postMessage({ type: 'stop' });
      document.body.classList.remove('running');
      if (state.animFrame !== null) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = null;
      }
      el.goBtn.classList.remove('running');
      el.goBtn.textContent = 'Play';
      el.goBtn.title = 'Resume timer';
      document.getElementById('timerStatus').textContent = 'Timer paused';
      updateTitle();
    }

    function resume() {
      if (!state.paused) return;
      state.paused = false;
      state.running = true;
      ClockLogic.requestWakeLock();
      document.body.classList.add('running');
      state.startTime = Date.now() - (state.total - state.remaining) * 60000;
      el.goBtn.classList.add('running');
      el.goBtn.textContent = 'Pause';
      el.goBtn.title = 'Pause the timer';
      document.getElementById('timerStatus').textContent = 'Timer resumed';
      animate();
    }

    function handleGoClick() {
      if (state.running) {
        pause();
      } else if (state.paused) {
        resume();
      } else {
        start();
      }
    }

    el.colorBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isOpen = el.colorMenu.classList.toggle('show');
      el.colorBtn.setAttribute('aria-expanded', isOpen);
      if (isOpen) {
        el.colorOpts[0].focus();
      }
    });

    // Keyboard navigation for color menu
    el.colorBtn.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.colorMenu.classList.add('show');
        el.colorBtn.setAttribute('aria-expanded', 'true');
        el.colorOpts[0].focus();
      }
    });

    el.colorMenu.addEventListener('keydown', function(e) {
      var opts = el.colorOpts;
      var current = document.activeElement;
      var idx = Array.prototype.indexOf.call(opts, current);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        opts[(idx + 1) % opts.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        opts[(idx - 1 + opts.length) % opts.length].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        el.colorMenu.classList.remove('show');
        el.colorBtn.setAttribute('aria-expanded', 'false');
        el.colorBtn.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (current.classList.contains('color-option')) {
          current.click();
        }
      }
    });

    document.addEventListener('click', function() {
      el.colorMenu.classList.remove('show');
      el.colorBtn.setAttribute('aria-expanded', 'false');
    });

    for (let i = 0; i < el.colorOpts.length; i++) {
      el.colorOpts[i].setAttribute('tabindex', '0');
      el.colorOpts[i].setAttribute('role', 'menuitem');
      el.colorOpts[i].addEventListener('click', function(e) {
        e.stopPropagation();
        state.color = this.dataset.color;
        el.colorBtn.style.background = state.color;
        el.colorMenu.classList.remove('show');
        el.colorBtn.setAttribute('aria-expanded', 'false');
        el.colorBtn.focus();
        ClockLogic.setCookie('clockColor', state.color, 365);
        ClockLogic.updateHash(state);
        render();
      });
    }

    // Helper to set up mutually exclusive button groups
    function setupButtonGroup(buttons, callback) {
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function() {
          for (let j = 0; j < buttons.length; j++) {
            buttons[j].classList.remove('active');
          }
          this.classList.add('active');
          callback(this);
        });
      }
    }

    function selectButton(buttons, dataAttr, value) {
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
        if (buttons[i].dataset[dataAttr] === String(value)) {
          buttons[i].classList.add('active');
        }
      }
    }

    setupButtonGroup(el.modeBtns, function(btn) {
      state.mode = btn.dataset.mode;
      el.timeInput.placeholder = state.mode === 'end' ? 'hh:mm' : 'mins';
      el.timeInput.title = state.mode === 'end' ? 'End time (hh:mm, hhmm, or mm)' : 'Minutes (1-180)';
      ClockLogic.setCookie('clockMode', state.mode, 365);
      ClockLogic.updateHash(state);

      // Handle mode change
      if (state.running) {
        if (state.mode === 'end') {
          // Calculate and show end time when switching to END while running
          const now = new Date();
          const endDate = new Date(now.getTime() + state.remaining * 60000);
          const h = endDate.getHours();
          const m = endDate.getMinutes();
          const s = endDate.getSeconds();
          el.timeInput.value = h + ':' + (m < 10 ? '0' : '') + m;
          state.endTime = m + s / 60; // Preserve seconds precision
          // No pause in END mode
          el.goBtn.disabled = true;
        } else {
          // Show remaining minutes when switching to CCW/CW while running
          el.timeInput.value = Math.ceil(state.remaining);
          state.endTime = null;
          // Enable pause in CCW/CW modes
          el.goBtn.disabled = false;
          el.goBtn.textContent = 'Pause';
          el.goBtn.title = 'Pause the timer';
        }
      } else if (state.mode === 'end' && !state.running && !state.paused && el.timeInput.value.trim()) {
        // Handle preview animation on mode change (only when not paused)
        const parsed = parseInput(el.timeInput.value.trim());
        if (parsed) {
          state.total = parsed.total;
          state.remaining = parsed.total;
          state.endTime = parsed.endTime;
          startPreviewAnimation();
        }
      } else {
        stopPreviewAnimation();
      }
      // Re-initialize clock face for CW mode label mirroring
      initClockFace();
      render();
    });

    setupButtonGroup(el.markBtns, function(btn) {
      state.marks = parseInt(btn.dataset.marks);
      ClockLogic.setCookie('clockMarks', state.marks, 365);
      ClockLogic.updateHash(state);
      initClockFace();
      render();
    });

    function switchToEndMode() {
      if (state.mode !== 'end') {
        state.mode = 'end';
        selectButton(el.modeBtns, 'mode', 'end');
        el.timeInput.placeholder = 'hh:mm';
      }
    }

    el.timeInput.addEventListener('input', function(e) {
      const value = e.target.value.trim();
      el.goBtn.disabled = !value;

      // Update state and URL hash with time value
      state.timeValue = value;
      ClockLogic.updateHash(state);

      // Reset button when user types - stop any running timer
      if (state.running) {
        state.running = false;
        if (state.animFrame !== null) {
          cancelAnimationFrame(state.animFrame);
          state.animFrame = null;
        }
        if (timerWorker) timerWorker.postMessage({ type: 'stop' });
        document.body.classList.remove('running');
        el.goBtn.classList.remove('running');
        ClockLogic.releaseWakeLock();
        updateTitle();
      }
      state.paused = false;
      el.goBtn.textContent = 'Go';
      el.goBtn.title = 'Start the timer';

      // Stop completion blink when user types
      stopCompletionBlink();

      // Auto-switch to END mode on 4-digit input or colon (when in CCW/CW)
      if (state.mode !== 'end' && !state.running) {
        if (value.includes(':') || (value.length >= 4 && /^\d+$/.test(value))) {
          switchToEndMode();
        }
      }

      // Live preview: update clock face as user types (only when not running)
      if (!state.running) {
        if (value) {
          const parsed = parseInput(value);
          if (parsed) {
            state.total = parsed.total;
            state.remaining = parsed.total;
            state.endTime = parsed.endTime;
            // Start preview animation in END mode
            if (state.mode === 'end') {
              startPreviewAnimation();
            }
          } else {
            state.remaining = 0;
            stopPreviewAnimation();
          }
        } else {
          state.remaining = 0;
          stopPreviewAnimation();
        }
        render();
      }
    });

    el.timeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.target.value.trim()) {
        start();
      }
    });

    el.goBtn.addEventListener('click', handleGoClick);

    // Load preferences from cookies and URL hash
    (function loadPreferences() {
      // First load from cookies
      var savedColor = ClockLogic.getCookie('clockColor');
      if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) {
        state.color = savedColor;
      }

      var savedMode = ClockLogic.getCookie('clockMode');
      if (savedMode && ['ccw', 'cw', 'end'].indexOf(savedMode) !== -1) {
        state.mode = savedMode;
      }

      var savedMarks = ClockLogic.getCookie('clockMarks');
      if (savedMarks !== null) {
        var marksVal = parseInt(savedMarks);
        if ([0, 5, 15].indexOf(marksVal) !== -1) {
          state.marks = marksVal;
        }
      }

      var savedDarkMode = ClockLogic.getCookie('clockDarkMode');
      if (savedDarkMode === '1') {
        document.body.classList.add('dark');
        el.darkModeBtn.textContent = '☀️';
        el.darkModeBtn.title = 'Switch to light mode';
      }

      var savedSound = ClockLogic.getCookie('clockSound');
      if (savedSound === 'on') {
        state.sound = true;
        el.soundBtn.textContent = '🔔';
        el.soundBtn.title = 'Turn alarm off';
      }

      var savedDisplayMode = ClockLogic.getCookie('clockDisplayMode');
      if (savedDisplayMode === 'digital') {
        state.displayMode = 'digital';
        el.displayModeBtn.textContent = '🕐';
        el.displayModeBtn.title = 'Switch to analog display';
      }

      // Then override with URL hash (URL takes priority)
      var hashParams = ClockLogic.parseHash();
      if (hashParams.color && /^[0-9a-fA-F]{6}$/.test(hashParams.color)) {
        state.color = '#' + hashParams.color;
      }
      if (hashParams.mode && ['ccw', 'cw', 'end'].indexOf(hashParams.mode) !== -1) {
        state.mode = hashParams.mode;
      }
      if (hashParams.marks !== undefined) {
        var marksVal = parseInt(hashParams.marks);
        if ([0, 5, 15].indexOf(marksVal) !== -1) {
          state.marks = marksVal;
        }
      }
      if (hashParams.dark === '1') {
        document.body.classList.add('dark');
        el.darkModeBtn.textContent = '☀️';
        el.darkModeBtn.title = 'Switch to light mode';
      }
      if (hashParams.sound === 'on') {
        state.sound = true;
        el.soundBtn.textContent = '🔔';
        el.soundBtn.title = 'Turn alarm off';
      }
      if (hashParams.display === 'digital') {
        state.displayMode = 'digital';
        el.displayModeBtn.textContent = '🕐';
        el.displayModeBtn.title = 'Switch to analog display';
      }
      if (hashParams.time) {
        // Validate time parameter: only allow digits, colon, and decimal point
        var sanitizedTime = hashParams.time.replace(/[^\d:.]/g, '');
        if (sanitizedTime && sanitizedTime.length <= 10) {
          el.timeInput.value = sanitizedTime;
          state.timeValue = sanitizedTime;
          // Parse input to set state.total/remaining (same as input handler)
          var parsed = ClockLogic.parseInput(sanitizedTime, state.mode, new Date(), MAX_MINUTES);
          if (parsed) {
            state.total = parsed.total;
            state.remaining = parsed.total;
            state.endTime = parsed.endTime;
            el.goBtn.disabled = false;
          }
        }
      }

      // Apply mode to UI
      for (var i = 0; i < el.modeBtns.length; i++) {
        el.modeBtns[i].classList.remove('active');
        if (el.modeBtns[i].dataset.mode === state.mode) {
          el.modeBtns[i].classList.add('active');
        }
      }
      el.timeInput.placeholder = state.mode === 'end' ? 'hh:mm' : 'mins';

      // Apply marks to UI
      for (var i = 0; i < el.markBtns.length; i++) {
        el.markBtns[i].classList.remove('active');
        if (parseInt(el.markBtns[i].dataset.marks) === state.marks) {
          el.markBtns[i].classList.add('active');
        }
      }

      // Request notification permission immediately if sound is enabled
      if (state.sound) {
        ClockLogic.requestNotificationPermission();
      }

      // Hide controls if requested via URL (for automated screenshots)
      if (hashParams.controls === '0') {
        document.querySelector('.controls').style.display = 'none';
      }

      // Autostart timer if requested via URL (for automated screenshots)
      if (hashParams.autostart === '1' && !el.goBtn.disabled) {
        el.goBtn.click();
      }
    })();

    // Dark mode toggle
    el.darkModeBtn.addEventListener('click', function() {
      document.body.classList.toggle('dark');
      var isDark = document.body.classList.contains('dark');
      el.darkModeBtn.textContent = isDark ? '☀️' : '🌙';
      el.darkModeBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      // Update PWA theme color to match mode
      var themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute('content', isDark ? '#111' : '#f9fafb');
      ClockLogic.setCookie('clockDarkMode', isDark ? '1' : '0', 365);
      ClockLogic.updateHash(state);
      initClockFace();
    });

    // Sound toggle
    el.soundBtn.addEventListener('click', function() {
      state.sound = !state.sound;
      el.soundBtn.textContent = state.sound ? '🔔' : '🔕';
      el.soundBtn.title = state.sound ? 'Turn alarm off' : 'Turn alarm on';
      ClockLogic.setCookie('clockSound', state.sound ? 'on' : 'off', 365);
      ClockLogic.updateHash(state);
      // Request notification permission when sound is enabled
      if (state.sound) {
        ClockLogic.requestNotificationPermission();
      }
    });

    // Display mode toggle (analog/digital)
    el.displayModeBtn.addEventListener('click', function() {
      state.displayMode = state.displayMode === 'analog' ? 'digital' : 'analog';
      var isDigital = state.displayMode === 'digital';
      el.displayModeBtn.textContent = isDigital ? '🕐' : '🔢';
      el.displayModeBtn.title = isDigital ? 'Switch to analog display' : 'Switch to digital display';
      ClockLogic.setCookie('clockDisplayMode', state.displayMode, 365);
      ClockLogic.updateHash(state);
      render();
    });

    // Focus trap for modals
    function trapFocus(modal, e) {
      if (e.key !== 'Tab') return;
      var focusable = modal.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])');
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Info modal
    el.infoBtn.addEventListener('click', function() {
      el.infoModal.classList.add('show');
      el.infoCloseBtn.focus();
    });

    el.infoCloseBtn.addEventListener('click', function() {
      el.infoModal.classList.remove('show');
      el.infoBtn.focus();
    });

    el.infoModal.addEventListener('click', function(e) {
      if (e.target === el.infoModal) {
        el.infoModal.classList.remove('show');
        el.infoBtn.focus();
      }
    });

    el.infoModal.addEventListener('keydown', function(e) {
      trapFocus(el.infoModal, e);
    });

    // Install instructions modal
    el.installLink.addEventListener('click', function(e) {
      e.preventDefault();
      el.infoModal.classList.remove('show');
      el.installModal.classList.add('show');
      el.installCloseBtn.focus();
    });

    el.installCloseBtn.addEventListener('click', function() {
      el.installModal.classList.remove('show');
      el.infoBtn.focus();
    });

    el.installModal.addEventListener('click', function(e) {
      if (e.target === el.installModal) {
        el.installModal.classList.remove('show');
        el.infoBtn.focus();
      }
    });

    el.installModal.addEventListener('keydown', function(e) {
      trapFocus(el.installModal, e);
    });

    // Fullscreen toggle
    el.fullscreenBtn.addEventListener('click', function() {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
      document.body.classList.add('fullscreen');
    });

    el.exitFullscreenBtn.addEventListener('click', function() {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      document.body.classList.remove('fullscreen');
    });

    // Sync fullscreen class when user exits via Escape key
    document.addEventListener('fullscreenchange', function() {
      if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen');
      }
    });

    // Picture-in-Picture functionality
    var pipState = { active: false, stream: null };
    var PIP_RADIUS = { FULL: 140, MIDDLE: 93, INNER: 47 };

    function renderToCanvas() {
      var canvas = el.pipCanvas;
      var ctx = canvas.getContext('2d');
      var size = 300;
      var center = size / 2;
      var maxRadius = 140;

      // Clear canvas
      var isDark = document.body.classList.contains('dark');
      ctx.fillStyle = isDark ? '#111' : '#fff';
      ctx.fillRect(0, 0, size, size);

      // Draw clock face circle
      ctx.beginPath();
      ctx.arc(center, center, maxRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? '#fff' : '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Handle completion blink
      if (state.completed) {
        // Pulse animation: opacity oscillates between 0 and 1 over 2 seconds
        var blinkPhase = (Date.now() % 2000) / 2000;
        var blinkOpacity = Math.abs(Math.sin(blinkPhase * Math.PI));

        ctx.beginPath();
        ctx.arc(center, center, maxRadius, 0, Math.PI * 2);
        ctx.globalAlpha = blinkOpacity;
        ctx.fillStyle = state.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // Draw wedges using state.remaining (works for both preview and running)
        var time = state.remaining;
        if (time > 0) {
          var circles = ClockLogic.getCircles(time, PIP_RADIUS);

          circles.forEach(function(c) {
            var circleRadius = c.r;
            var darkenFactor = c.r === PIP_RADIUS.INNER ? 0.5 : (c.r === PIP_RADIUS.MIDDLE ? 0.7 : 1);
            var color = c.full ? ClockLogic.darken(state.color, darkenFactor) : state.color;

            if (c.full) {
              ctx.beginPath();
              ctx.arc(center, center, circleRadius, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            } else {
              var startAngle, endAngle;
              if (state.mode === 'cw') {
                startAngle = ((60 - c.t) / 60) * Math.PI * 2 - Math.PI / 2;
                endAngle = -Math.PI / 2;
              } else if (state.mode === 'end') {
                var now = new Date();
                var curMin = now.getMinutes() + now.getSeconds() / 60;
                startAngle = (curMin / 60) * Math.PI * 2 - Math.PI / 2;
                endAngle = (state.endTime / 60) * Math.PI * 2 - Math.PI / 2;
              } else {
                startAngle = -Math.PI / 2;
                endAngle = (c.t / 60) * Math.PI * 2 - Math.PI / 2;
              }
              ctx.beginPath();
              ctx.moveTo(center, center);
              ctx.arc(center, center, circleRadius, startAngle, endAngle);
              ctx.closePath();
              ctx.fillStyle = color;
              ctx.fill();
            }
          });
        }
      }

      // Draw tick marks
      for (var i = 0; i < 60; i++) {
        var angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        var isMajor = i % 5 === 0;
        var innerR = maxRadius * (isMajor ? 0.85 : 0.9);
        var outerR = maxRadius * 0.95;
        ctx.beginPath();
        ctx.moveTo(center + innerR * Math.cos(angle), center + innerR * Math.sin(angle));
        ctx.lineTo(center + outerR * Math.cos(angle), center + outerR * Math.sin(angle));
        ctx.strokeStyle = isDark ? '#fff' : '#000';
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.stroke();
      }
    }

    function updatePip() {
      if (pipState.active) {
        renderToCanvas();
        // Use setTimeout at 30fps to match captureStream(30) rate, saves CPU
        setTimeout(updatePip, 33);
      }
    }

    function startPip() {
      renderToCanvas();

      // Create stream from canvas
      pipState.stream = el.pipCanvas.captureStream(30);
      el.pipVideo.srcObject = pipState.stream;
      el.pipVideo.play().then(function() {
        // Try standard API first, then Safari
        if (el.pipVideo.requestPictureInPicture) {
          el.pipVideo.requestPictureInPicture().then(function() {
            pipState.active = true;
            updatePip();
          }).catch(function(err) {
            console.error('PiP failed:', err);
          });
        } else if (el.pipVideo.webkitSetPresentationMode) {
          el.pipVideo.webkitSetPresentationMode('picture-in-picture');
          pipState.active = true;
          updatePip();
        }
      });
    }

    el.pipBtn.addEventListener('click', function() {
      if (pipState.active) {
        if (document.exitPictureInPicture) {
          document.exitPictureInPicture();
        } else if (el.pipVideo.webkitSetPresentationMode) {
          el.pipVideo.webkitSetPresentationMode('inline');
        }
        return;
      }

      startPip();
    });

    el.pipVideo.addEventListener('leavepictureinpicture', function() {
      pipState.active = false;
      if (pipState.stream) {
        pipState.stream.getTracks().forEach(function(track) { track.stop(); });
        pipState.stream = null;
      }
      el.pipVideo.srcObject = null;
    });

    // Safari PiP event
    el.pipVideo.addEventListener('webkitpresentationmodechanged', function() {
      if (el.pipVideo.webkitPresentationMode !== 'picture-in-picture') {
        pipState.active = false;
        if (pipState.stream) {
          pipState.stream.getTracks().forEach(function(track) { track.stop(); });
          pipState.stream = null;
        }
        el.pipVideo.srcObject = null;
      }
    });

    // Preset buttons - click to immediately start timer
    var presetBtns = document.querySelectorAll('.preset-btn');
    for (var i = 0; i < presetBtns.length; i++) {
      presetBtns[i].title = 'Start ' + presetBtns[i].dataset.preset + ' minute timer';
      presetBtns[i].setAttribute('aria-label', 'Start ' + presetBtns[i].dataset.preset + ' minute timer');
      presetBtns[i].addEventListener('click', function() {
        var btn = this;
        btn.classList.add('pressed');
        setTimeout(function() {
          btn.classList.remove('pressed');
        }, 50);
        el.timeInput.value = this.dataset.preset;
        el.timeInput.dispatchEvent(new Event('input'));
        start();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Ignore if typing in input field
      if (document.activeElement === el.timeInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        // No pause/resume in END mode
        if (state.mode === 'end') return;
        if (state.running) pause();
        else if (state.paused) resume();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
          document.body.classList.add('fullscreen');
        }
      } else if (e.code === 'Escape') {
        if (el.installModal.classList.contains('show')) {
          el.installModal.classList.remove('show');
        } else if (el.infoModal.classList.contains('show')) {
          el.infoModal.classList.remove('show');
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        el.pipBtn.click();
      }
    });

    // Controls visibility - pure JS (no CSS class juggling)
    var clockContainer = document.querySelector('.clock-container');
    var controls = document.querySelector('.controls');
    var isTouchDevice = 'ontouchstart' in window;
    var controlsVisible = true;
    var clickShowActive = false; // Browser: clicked to show, waiting for hover to release

    function setControlsVisible(visible) {
      if (!controls) return;
      controls.style.opacity = visible ? '1' : '0';
      // Touch: block events when hidden. Browser: keep events so hover works.
      if (isTouchDevice) {
        controls.style.pointerEvents = visible ? 'auto' : 'none';
      }
      controlsVisible = visible;
    }

    function resetControls() {
      if (!controls) return;
      controls.style.opacity = '';
      controls.style.pointerEvents = '';
      controlsVisible = true;
      clickShowActive = false;
    }

    // Watch for timer start/stop
    var bodyObserver = new MutationObserver(function(mutations) {
      if (!document || !document.body) return;
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
          if (document.body.classList.contains('running')) {
            // Timer started - hide controls after delay
            setTimeout(function() { setControlsVisible(false); }, 500);
          } else {
            // Timer stopped - show controls
            resetControls();
          }
        }
      });
    });
    if (document.body) {
      bodyObserver.observe(document.body, { attributes: true });
    }

    if (isTouchDevice) {
      // Touch: tap clock to toggle controls
      clockContainer.addEventListener('touchend', function(e) {
        if (!state.running) return;
        if (e.changedTouches.length !== 1) return;
        if (controlsVisible) {
          setControlsVisible(false);
        } else {
          e.preventDefault();
          setControlsVisible(true);
        }
      });

      // Touch: tap on hidden controls area shows them first
      controls.addEventListener('touchend', function(e) {
        e.stopPropagation();
        if (!controlsVisible) {
          e.preventDefault();
          setControlsVisible(true);
        }
      });
    } else {
      // Browser: hover shows/hides controls
      controls.addEventListener('mouseenter', function() {
        if (!state.running) return;
        if (clickShowActive) {
          // Release click-show mode, now in normal hover mode
          clickShowActive = false;
        }
        setControlsVisible(true);
      });

      controls.addEventListener('mouseleave', function() {
        if (!state.running) return;
        setControlsVisible(false);
      });

      // Browser: click on clock to toggle controls
      clockContainer.addEventListener('click', function(e) {
        if (!state.running) return;
        // Ignore if click was inside controls
        if (controls.contains(e.target)) return;

        if (controlsVisible) {
          setControlsVisible(false);
          clickShowActive = false;
        } else {
          setControlsVisible(true);
          clickShowActive = true;
        }
      });
    }

    // Re-request wake lock when page becomes visible again
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && state.running && !state.paused) {
        ClockLogic.requestWakeLock();
      }
    });

    // Clean up resources on page unload
    window.addEventListener('beforeunload', function() {
      // Disconnect mutation observer to prevent errors during cleanup
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      if (state.animFrame) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = null;
      }
      if (state.previewFrame) {
        cancelAnimationFrame(state.previewFrame);
        state.previewFrame = null;
      }
      if (state.overtimeInterval) {
        clearInterval(state.overtimeInterval);
        state.overtimeInterval = null;
      }
      if (timerWorker) {
        timerWorker.postMessage({ type: 'stop' });
      }
      ClockLogic.releaseWakeLock();
      ClockLogic.stopAlarm(state.alarmHandle);
    });

    el.colorBtn.style.background = state.color;
    // Update PWA theme color to match dark/light mode
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      var isDark = document.body.classList.contains('dark');
      themeColorMeta.setAttribute('content', isDark ? '#111' : '#f9fafb');
    }
    // Only disable Go button if no time was loaded from URL
    if (!state.total) {
      el.goBtn.disabled = true;
    }
    el.goBtn.title = 'Start the timer';
    el.timeInput.title = state.mode === 'end' ? 'End time (hh:mm, hhmm, or mm)' : 'Minutes (1-180)';

    // Hide PiP button if not supported (Safari doesn't support canvas-to-PiP)
    // Detect Safari (but not Chrome on iOS which also has Safari UA)
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari || !el.pipCanvas.captureStream || !el.pipVideo.requestPictureInPicture) {
      el.pipBtn.style.display = 'none';
    }

    initClockFace();
    render();
    el.timeInput.focus();
