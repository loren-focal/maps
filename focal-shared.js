/* ============================================================================
   Focal Control — shared schedule state module
   ============================================================================
   Loaded by both focal-control-dashboard-prototype.html (read-only) and
   focal-scheduling-prototype.html (read/write). This is the single source of
   truth for the schedule's localStorage shape, defaults, and the date-math
   helpers both pages need to derive "is the schedule active right now."

   Exposes one global: window.FocalSchedule. See README.md for the full
   localStorage contract (key, shape, who reads/writes what).
   ============================================================================ */

(function (global) {
  "use strict";

  const STORAGE_KEY = "focal-schedule-state";
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Wednesday closed, 11:30–18:00 Mon/Tue, 11:30–22:00 the rest — matches the reference screenshot's
  // example hours. This is the only definition of the default schedule; both pages import it so a
  // future change to the defaults can't update one page and silently miss the other.
  const DEFAULT_STATE = {
    on: true,
    days: DAYS.map((d, i) => ({
      closed: i === 2,
      start: "11:30",
      end: i <= 1 ? "18:00" : "22:00",
    })),
  };

  function isValidShape(parsed) {
    return !!parsed && Array.isArray(parsed.days) && parsed.days.length === DAYS.length;
  }

  // Returns a deep-enough clone of DEFAULT_STATE so callers can safely mutate their own copy
  // without corrupting the shared default (both callers build per-day working state from this).
  function cloneDefaultState() {
    return { on: DEFAULT_STATE.on, days: DEFAULT_STATE.days.map((d) => ({ ...d })) };
  }

  // Reads and validates the persisted schedule. Returns the parsed state on success, or a fresh
  // clone of DEFAULT_STATE on any failure (missing key, corrupt JSON, or wrong day count) — callers
  // never need their own fallback/try-catch for this key.
  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      return isValidShape(parsed) ? parsed : cloneDefaultState();
    } catch (e) {
      return cloneDefaultState();
    }
  }

  // Persists { on, days: [{closed,start,end}, ...] }. Any extra fields on the day objects (e.g. the
  // scheduling page's in-memory `name`) are intentionally dropped — this is the on-disk shape only.
  function save(state) {
    const payload = {
      on: state.on,
      days: state.days.map((d) => ({ closed: d.closed, start: d.start, end: d.end })),
    };
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Storage can be full or unavailable (private browsing) — the UI already reflects the change
      // in memory, so a failed persist here just means it won't survive a reload. Non-fatal.
    }
  }

  // Real current day/time. DAYS is Monday-first; JS Date#getDay() is Sunday-first (0 = Sun), so remap.
  function getNowDayIndex() {
    return (new Date().getDay() + 6) % 7;
  }
  function getNowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function to12Hour(hhmm) {
    let [h, m] = hhmm.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return h + ":" + String(m).padStart(2, "0") + " " + ampm;
  }

  // True if `state.days[getNowDayIndex()]` is open and the current time falls within its hours.
  // Does not check state.on — callers decide whether the master switch matters for their purpose.
  function isActiveNow(state) {
    const today = state.days[getNowDayIndex()];
    if (today.closed) return false;
    const nowMin = getNowMinutes();
    return nowMin >= toMinutes(today.start) && nowMin < toMinutes(today.end);
  }

  // Finds when the schedule will next become active: today (if not yet started) or the next
  // non-closed day within a 7-day scan. Returns null if every day is closed.
  // Shape: { dayIndex, label: "today" | DAYS[idx], time: "HH:MM" }
  function nextResume(state) {
    const nowDayIdx = getNowDayIndex();
    const nowMin = getNowMinutes();
    const today = state.days[nowDayIdx];
    if (!today.closed && nowMin < toMinutes(today.start)) {
      return { dayIndex: nowDayIdx, label: "today", time: today.start };
    }
    for (let offset = 1; offset <= DAYS.length; offset++) {
      const idx = (nowDayIdx + offset) % DAYS.length;
      const day = state.days[idx];
      if (!day.closed) {
        return { dayIndex: idx, label: DAYS[idx], time: day.start };
      }
    }
    return null;
  }

  global.FocalSchedule = {
    STORAGE_KEY,
    DAYS,
    DEFAULT_STATE,
    load,
    save,
    getNowDayIndex,
    getNowMinutes,
    toMinutes,
    to12Hour,
    isActiveNow,
    nextResume,
  };
})(window);
