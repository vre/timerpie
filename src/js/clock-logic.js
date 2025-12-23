    // ============================================
    // PURE FUNCTIONS (testable, no side effects)
    // ============================================
    const darkenCache = {};
    const ClockLogic = {
      darken: function(hex, factor) {
        const key = hex + factor;
        if (darkenCache[key]) return darkenCache[key];
        const r = Math.floor(parseInt(hex.substr(1, 2), 16) * factor);
        const g = Math.floor(parseInt(hex.substr(3, 2), 16) * factor);
        const b = Math.floor(parseInt(hex.substr(5, 2), 16) * factor);
        const result = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
        darkenCache[key] = result;
        return result;
      },

      parseInput: function(input, mode, now, maxMinutes) {
        // Reject empty or excessively long input
        if (!input || input.length > 20) return null;

        if (mode === 'end') {
          if (input.includes(':')) {
            // Validate hh:mm format - require digits on both sides of colon
            if (!/^\d{1,2}:\d{1,2}$/.test(input)) return null;
            const parts = input.split(':').map(Number);
            const h = parts[0];
            const m = parts[1];
            if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;

            const target = new Date(now);
            target.setHours(h, m, 0, 0);
            if (target <= now) {
              target.setDate(target.getDate() + 1);
            }

            const total = Math.min(Math.ceil((target - now) / 60000), maxMinutes);
            return { total: total, endTime: m };
          }

          const num = parseInt(input, 10);
          if (isNaN(num) || num < 0) return null;

          if (input.length >= 3 && input.length <= 4) {
            const h = Math.floor(num / 100);
            const m = num % 100;
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;

            if (h < 12) {
              const amTarget = new Date(now);
              amTarget.setHours(h, m, 0, 0);
              if (amTarget <= now) amTarget.setDate(amTarget.getDate() + 1);

              const pmTarget = new Date(now);
              pmTarget.setHours(h + 12, m, 0, 0);
              if (pmTarget <= now) pmTarget.setDate(pmTarget.getDate() + 1);

              const amMins = Math.ceil((amTarget - now) / 60000);
              const pmMins = Math.ceil((pmTarget - now) / 60000);

              const amValid = amMins <= maxMinutes;
              const pmValid = pmMins <= maxMinutes;

              if (amValid && pmValid) {
                if (amMins <= pmMins) {
                  return { total: Math.min(amMins, maxMinutes), endTime: m };
                } else {
                  return { total: Math.min(pmMins, maxMinutes), endTime: m };
                }
              } else if (amValid) {
                return { total: Math.min(amMins, maxMinutes), endTime: m };
              } else if (pmValid) {
                return { total: Math.min(pmMins, maxMinutes), endTime: m };
              } else {
                if (amMins <= pmMins) {
                  return { total: Math.min(amMins, maxMinutes), endTime: m };
                } else {
                  return { total: Math.min(pmMins, maxMinutes), endTime: m };
                }
              }
            }

            const target = new Date(now);
            target.setHours(h, m, 0, 0);
            if (target <= now) {
              target.setDate(target.getDate() + 1);
            }

            const total = Math.min(Math.ceil((target - now) / 60000), maxMinutes);
            return { total: total, endTime: m };
          }

          if (num < 0 || num >= 60) return null;

          const target = new Date(now);
          target.setMinutes(num, 0, 0);
          if (target <= now) {
            target.setHours(target.getHours() + 1);
          }

          const total = Math.min(Math.ceil((target - now) / 60000), maxMinutes);
          return { total: total, endTime: num };
        }

        const mins = parseFloat(input);
        if (isNaN(mins) || mins <= 0) return null;
        return { total: Math.min(mins, maxMinutes), endTime: null };
      },

      getCircles: function(time, radius) {
        if (time > 120) {
          const outerT = time % 60 || 60;
          return [
            { r: radius.FULL, t: outerT, full: outerT === 60 },
            { r: radius.MIDDLE, t: 60, full: true },
            { r: radius.INNER, t: 60, full: true }
          ];
        }
        if (time > 60) {
          const outerT = time % 60 || 60;
          return [
            { r: radius.FULL, t: outerT, full: outerT === 60 },
            { r: radius.MIDDLE, t: 60, full: true }
          ];
        }
        if (time > 0) {
          return [{ r: radius.FULL, t: time, full: time === 60 }];
        }
        return [];
      },

      getLabelPosition: function(minute, mode, center, labelRadius) {
        let positionMinute = minute % 60;
        if (mode === 'cw') {
          positionMinute = (60 - positionMinute) % 60;
        }
        const angle = (positionMinute / 60) * 360 - 90;
        const rad = angle * Math.PI / 180;
        return {
          x: center + labelRadius * Math.cos(rad),
          y: center + labelRadius * Math.sin(rad)
        };
      },

      getCookie: function(name) {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.indexOf(name + '=') === 0) {
            try {
              return decodeURIComponent(cookie.substring(name.length + 1));
            } catch (e) {
              return null;
            }
          }
        }
        return null;
      },

      setCookie: function(name, value, days) {
        // Validate cookie name (alphanumeric, underscore, hyphen only)
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return;
        const sanitizedValue = encodeURIComponent(String(value));
        // Reject values over 4000 chars to stay within 4KB cookie limit
        if (sanitizedValue.length > 4000) return;
        let expires = '';
        if (days) {
          const date = new Date();
          date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
          expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + sanitizedValue + expires + '; path=/; SameSite=Lax';
      },

      parseHash: function() {
        const hash = window.location.hash.substring(1);
        const params = {};
        const allowedParams = ['color', 'mode', 'marks', 'dark', 'sound', 'time', 'display', 'autostart', 'controls'];
        if (hash) {
          hash.split('&').forEach(function(pair) {
            const parts = pair.split('=');
            if (parts.length === 2 && allowedParams.indexOf(parts[0]) !== -1) {
              params[parts[0]] = decodeURIComponent(parts[1]);
            }
          });
        }
        return params;
      },

      updateHash: function(state) {
        const params = [];
        if (state.color && state.color !== '#ff6b35') {
          params.push('color=' + state.color.substring(1));
        }
        if (state.mode && state.mode !== 'ccw') {
          params.push('mode=' + state.mode);
        }
        if (state.marks !== undefined && state.marks !== 15) {
          params.push('marks=' + state.marks);
        }
        if (document.body.classList.contains('dark')) {
          params.push('dark=1');
        }
        if (state.sound === true) {
          params.push('sound=on');
        }
        if (state.displayMode === 'digital') {
          params.push('display=digital');
        }
        if (state.timeValue) {
          params.push('time=' + encodeURIComponent(state.timeValue));
        }
        const hash = params.length > 0 ? '#' + params.join('&') : '';
        history.replaceState(null, '', window.location.pathname + hash);
      },

      // Generate a WAV beep as base64 data URI (works better in background than Web Audio API)
      generateBeepDataUri: function() {
        const sampleRate = 44100;
        const duration = 0.75;
        const frequency1 = 220; // A3
        const frequency2 = 277; // C#4
        const numSamples = Math.floor(sampleRate * duration);

        // WAV header
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        // RIFF header
        const writeString = function(offset, str) {
          for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
          }
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        writeString(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        // Generate samples with envelope
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          // ADSR envelope
          let env;
          if (t < 0.04) env = t / 0.04; // attack
          else if (t < 0.6) env = 1.0; // sustain
          else env = Math.max(0, 1 - (t - 0.6) / 0.15); // release

          // Two sine waves mixed
          let sample = Math.sin(2 * Math.PI * frequency1 * t) * 0.3 +
                       Math.sin(2 * Math.PI * frequency2 * t) * 0.15;
          sample *= env;

          // Convert to 16-bit PCM
          const pcm = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
          view.setInt16(44 + i * 2, pcm, true);
        }

        // Convert to base64
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return 'data:audio/wav;base64,' + btoa(binary);
      },

      // Cached beep data URI
      beepDataUri: null,

      // Play alarm using HTML5 Audio element (better background support than Web Audio API)
      playAlarm: function(state) {
        if (!state.sound) return null;

        const handle = { audios: [], timeout: null, notifications: [], retryTimeout: null };
        const self = this;

        // Build absolute icon URL for reliability
        const iconUrl = window.location.href.replace(/[^/]*$/, '') + 'icons/icon-192.png';

        // Show system notification for background tabs
        function showNotification(tag, body) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification('Timer Complete', {
                body: body,
                icon: iconUrl,
                tag: tag,
                requireInteraction: true,
                silent: false
              });
              handle.notifications.push(notif);
              return notif;
            } catch (e) {}
          }
          return null;
        }

        showNotification('tasktimer-alarm', 'Your timer has finished!');

        // Retry notification after 3 seconds if document still hidden
        handle.retryTimeout = setTimeout(function() {
          if (document.hidden) {
            showNotification('tasktimer-alarm-retry', 'Timer waiting - click to view');
          }
        }, 3000);

        // Set dock badge (works on macOS PWA)
        if ('setAppBadge' in navigator) {
          navigator.setAppBadge(1).catch(function() {});
        }

        // Vibrate on mobile (pattern matches beep timing: 750ms on, 375ms off, repeat 3x)
        if ('vibrate' in navigator) {
          navigator.vibrate([750, 375, 750, 375, 750]);
        }

        // Generate beep sound (cached)
        if (!this.beepDataUri) {
          this.beepDataUri = this.generateBeepDataUri();
        }

        // Play 3 beeps using Audio elements
        let beepCount = 0;
        const playBeep = function() {
          if (beepCount >= 3) return;
          const audio = new Audio(self.beepDataUri);
          audio.volume = 1.0;
          handle.audios.push(audio);
          audio.play().catch(function() {});
          beepCount++;
          if (beepCount < 3) {
            handle.timeout = setTimeout(playBeep, 1125);
          }
        };

        playBeep();
        return handle;
      },

      stopAlarm: function(alarmHandle) {
        if (alarmHandle) {
          if (alarmHandle.timeout) clearTimeout(alarmHandle.timeout);
          if (alarmHandle.retryTimeout) clearTimeout(alarmHandle.retryTimeout);
          if (alarmHandle.audios) {
            alarmHandle.audios.forEach(function(a) { a.pause(); });
          }
          if (alarmHandle.notifications) {
            alarmHandle.notifications.forEach(function(n) { n.close(); });
          }
          // Clear dock badge
          if ('clearAppBadge' in navigator) {
            navigator.clearAppBadge().catch(function() {});
          }
        }
      },

      // Request notification permission (only once per session)
      notificationRequested: false,
      requestNotificationPermission: function() {
        if (this.notificationRequested) return;
        if ('Notification' in window && Notification.permission === 'default') {
          this.notificationRequested = true;
          Notification.requestPermission();
        }
      },

      // Wake Lock API - keeps screen on while timer runs
      wakeLock: null,

      requestWakeLock: async function() {
        if ('wakeLock' in navigator) {
          // Release existing lock first to prevent listener accumulation
          if (this.wakeLock) {
            try {
              this.wakeLock.release();
            } catch (e) {}
            this.wakeLock = null;
          }
          try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            // Handle automatic release by browser (e.g., tab hidden, low battery)
            const self = this;
            this.wakeLock.addEventListener('release', function() {
              self.wakeLock = null;
            }, { once: true }); // Use once: true to auto-remove listener
          } catch (e) {
            // Wake lock request failed (e.g., low battery, tab not visible)
            this.wakeLock = null;
          }
        }
      },

      releaseWakeLock: function() {
        if (this.wakeLock) {
          this.wakeLock.release();
          this.wakeLock = null;
        }
      },

      // Canvas rendering - pure functions for angle calculations
      getTimerEndAngle: function(timerCircle, mode, endTime, now) {
        if (mode === 'end') {
          const curMin = now.getMinutes() + now.getSeconds() / 60;
          return (curMin / 60) * 360 - 90;
        }
        if (mode === 'cw') {
          return ((60 - timerCircle.t) / 60) * 360 - 90;
        }
        return (timerCircle.t / 60) * 360 - 90;
      },

      getWedgeAngles: function(circle, timerEnd, mode, endTime, now) {
        if (circle.full) {
          return { start: timerEnd, end: timerEnd + 360 };
        }
        if (mode === 'end') {
          const curMin = now.getMinutes() + now.getSeconds() / 60;
          const start = (curMin / 60) * 360 - 90;
          let end = (endTime / 60) * 360 - 90;
          if (end < start) end += 360;
          return { start: start, end: end };
        }
        if (mode === 'cw') {
          return { start: ((60 - circle.t) / 60) * 360 - 90, end: -90 };
        }
        return { start: -90, end: (circle.t / 60) * 360 - 90 };
      },

      // Render wedges to canvas context
      renderWedgesToCanvas: function(ctx, width, height, circles, mode, color, running, displayMode, endTime, now, center, isDark) {
        const self = this;
        ctx.clearRect(-15, 0, width, height); // viewBox starts at -15
        if (circles.length === 0) return;

        const timerEnd = this.getTimerEndAngle(circles[0], mode, endTime, now);
        const opacity = running ? 1 : 0.2;
        const numCircles = circles.length;
        const RING_ZONE_WIDTH = 60;
        const RING_GAP = 2;
        const RING_ZONE_OUTER = 180;
        const DARKEN = { MIDDLE: 0.7, INNER: 0.5 };
        const RADIUS = { INNER: 60 };

        const ringWidth = displayMode === 'digital'
          ? (RING_ZONE_WIDTH - (numCircles - 1) * RING_GAP) / numCircles
          : undefined;

        for (let i = 0; i < circles.length; i++) {
          const c = circles[i];
          let radius = c.r;

          // Digital mode: override radius to fit in outer 1/3 zone
          if (displayMode === 'digital') {
            radius = RING_ZONE_OUTER - i * (ringWidth + RING_GAP);
          }

          const angles = this.getWedgeAngles(c, timerEnd, mode, endTime, now);
          const colorFactor = displayMode === 'digital'
            ? (i === 0 ? 0.85 : (i === 1 ? DARKEN.MIDDLE : DARKEN.INNER))
            : (c.r === RADIUS.INNER ? DARKEN.INNER : DARKEN.MIDDLE);
          const fillColor = c.full ? this.darken(color, colorFactor) : color;

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = fillColor;
          ctx.lineWidth = 2;

          const startRad = angles.start * Math.PI / 180;
          const endRad = angles.end * Math.PI / 180;
          const innerR = displayMode === 'digital' ? radius - ringWidth : 0;

          if (c.full) {
            // Full circle/donut
            ctx.beginPath();
            if (displayMode === 'digital') {
              // Donut shape
              ctx.arc(center, center, radius, 0, Math.PI * 2);
              ctx.arc(center, center, innerR, 0, Math.PI * 2, true);
            } else {
              // Full circle
              ctx.arc(center, center, radius, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.stroke();

            // Edge line
            ctx.beginPath();
            const edgeX = center + radius * Math.cos(startRad);
            const edgeY = center + radius * Math.sin(startRad);
            if (displayMode === 'digital') {
              ctx.moveTo(center + innerR * Math.cos(startRad), center + innerR * Math.sin(startRad));
            } else {
              ctx.moveTo(center, center);
            }
            ctx.lineTo(edgeX, edgeY);
            ctx.stroke();
          } else {
            // Partial wedge
            ctx.beginPath();
            if (displayMode === 'digital') {
              // Ring arc
              ctx.arc(center, center, radius, startRad, endRad);
              ctx.arc(center, center, innerR, endRad, startRad, true);
              ctx.closePath();
            } else {
              // Pie wedge
              ctx.moveTo(center, center);
              ctx.arc(center, center, radius, startRad, endRad);
              ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();

            // Moving edge line
            const movingRad = mode === 'ccw' ? endRad : startRad;
            const movingX = center + radius * Math.cos(movingRad);
            const movingY = center + radius * Math.sin(movingRad);
            ctx.beginPath();
            ctx.strokeStyle = isDark ? '#fff' : '#000';
            if (displayMode === 'digital') {
              ctx.moveTo(center + innerR * Math.cos(movingRad), center + innerR * Math.sin(movingRad));
            } else {
              ctx.moveTo(center, center);
            }
            ctx.lineTo(movingX, movingY);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    };

    // Expose for testing
    if (typeof window !== 'undefined') {
      window.ClockLogic = ClockLogic;
    }
