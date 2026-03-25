/**
 * JS runner for the online compiler: full worker event loop (microtasks + macrotasks).
 * Patches timers / queueMicrotask / Promise#then to track pending work and only
 * postMessage after the queue has been idle across several probe passes.
 *
 * Note: A bare statement line like `{} + []` is parsed as an empty block + unary `+[]` (0),
 * not object + array. Use `console.log({} + [])` or `({} + [])` for expression context.
 */

const origSetTimeout = self.setTimeout.bind(self);
const origSetInterval = self.setInterval.bind(self);
const origClearTimeout = self.clearTimeout.bind(self);
const origClearInterval = self.clearInterval.bind(self);
const origQueueMicrotask = self.queueMicrotask.bind(self);
const origThen = Promise.prototype.then;

/** High range so synthetic setInterval ids rarely collide with engine timer ids. */
const FAKE_INTERVAL_BASE = 9_007_199_254_740_991;

self.onmessage = (e) => {
  const { code: userCode } = e.data;
  let nextIntervalKey = 1;

  const out = [];
  let thrown = null;
  let done = false;

  function sendResult() {
    if (done) return;
    done = true;
    self.postMessage({ lines: out.slice(), thrown });
  }

  const fmt = (x) => {
    try {
      if (typeof x === 'object' && x !== null) return JSON.stringify(x);
      return String(x);
    } catch {
      return String(x);
    }
  };

  const console = {
    log: (...a) => out.push(a.map(fmt).join(' ')),
    info: (...a) => out.push(a.map(fmt).join(' ')),
    warn: (...a) => out.push(`[warn] ${a.map(fmt).join(' ')}`),
    error: (...a) => out.push(`[error] ${a.map(fmt).join(' ')}`),
  };

  let pendingTimeoutTasks = 0;
  const pendingTimeoutIds = new Set();

  let promiseJobs = 0;
  let microtaskJobs = 0;

  let idleStreak = 0;
  const IDLE_STREAK_NEED = 5;

  const fakeIntervals = new Map();

  function bumpAfterTurn() {
    origSetTimeout(scheduleIdlePass, 0);
  }

  function scheduleIdlePass() {
    if (done) return;
    origQueueMicrotask(() => {
      if (done) return;
      origSetTimeout(tickIdleCheck, 0);
    });
  }

  function tickIdleCheck() {
    if (done) return;
    const busy =
      pendingTimeoutTasks > 0 ||
      fakeIntervals.size > 0 ||
      promiseJobs > 0 ||
      microtaskJobs > 0;

    if (busy) {
      idleStreak = 0;
      scheduleIdlePass();
      return;
    }

    idleStreak++;
    if (idleStreak >= IDLE_STREAK_NEED) {
      sendResult();
      return;
    }
    scheduleIdlePass();
  }

  self.queueMicrotask = function (cb) {
    if (typeof cb !== 'function') return origQueueMicrotask(cb);
    microtaskJobs++;
    origQueueMicrotask(() => {
      microtaskJobs--;
      try {
        cb();
      } finally {
        bumpAfterTurn();
      }
    });
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    promiseJobs++;
    return origThen.call(
      this,
      function (v) {
        promiseJobs--;
        try {
          return onFulfilled ? onFulfilled(v) : v;
        } finally {
          bumpAfterTurn();
        }
      },
      function (e) {
        promiseJobs--;
        try {
          return onRejected ? onRejected(e) : Promise.reject(e);
        } finally {
          bumpAfterTurn();
        }
      },
    );
  };

  Promise.prototype.catch = function (onRejected) {
    return this.then(undefined, onRejected);
  };

  self.setTimeout = function (cb, delay, ...args) {
    if (typeof cb !== 'function') return origSetTimeout(cb, delay, ...args);
    pendingTimeoutTasks++;
    const id = origSetTimeout(() => {
      pendingTimeoutIds.delete(id);
      pendingTimeoutTasks--;
      try {
        cb.apply(self, args);
      } finally {
        bumpAfterTurn();
      }
    }, delay, ...args);
    pendingTimeoutIds.add(id);
    return id;
  };

  self.clearTimeout = function (id) {
    if (pendingTimeoutIds.has(id)) {
      pendingTimeoutIds.delete(id);
      pendingTimeoutTasks--;
      bumpAfterTurn();
    }
    return origClearTimeout(id);
  };

  /**
   * Emulate setInterval with chained setTimeouts so "between ticks" has no hidden
   * engine macrotasks — idle detection stays accurate.
   */
  self.setInterval = function (cb, delay, ...args) {
    if (typeof cb !== 'function') return origSetInterval(cb, delay, ...args);

    const key = FAKE_INTERVAL_BASE + nextIntervalKey++;
    const state = {
      cancelled: false,
      /** @type {ReturnType<typeof origSetTimeout> | null} */
      tid: null,
    };

    function scheduleNext() {
      if (state.cancelled) return;
      pendingTimeoutTasks++;
      state.tid = origSetTimeout(() => {
        pendingTimeoutIds.delete(/** @type {any} */ (state.tid));
        pendingTimeoutTasks--;
        if (state.cancelled) {
          bumpAfterTurn();
          return;
        }
        try {
          cb.apply(self, args);
        } finally {
          scheduleNext();
          bumpAfterTurn();
        }
      }, delay, ...args);
      pendingTimeoutIds.add(/** @type {any} */ (state.tid));
    }

    fakeIntervals.set(key, state);
    scheduleNext();
    return key;
  };

  self.clearInterval = function (id) {
    const state = fakeIntervals.get(id);
    if (state) {
      state.cancelled = true;
      fakeIntervals.delete(id);
      if (state.tid !== null && pendingTimeoutIds.has(state.tid)) {
        pendingTimeoutIds.delete(state.tid);
        pendingTimeoutTasks--;
      }
      origClearTimeout(state.tid);
      bumpAfterTurn();
      return;
    }
    return origClearInterval(id);
  };

  try {
    const fn = new Function('console', userCode);
    fn(console);
  } catch (err) {
    thrown = err && err.message ? err.message : String(err);
    sendResult();
    return;
  }

  // Let the current task finish so microtasks scheduled during fn(console) run,
  // then start probing the event loop.
  origSetTimeout(scheduleIdlePass, 0);
};
