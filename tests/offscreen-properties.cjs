'use strict';

// Deterministic black-box state-machine exercise for engine/offscreen.js.
// Run with: node tests/offscreen-properties.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../engine/offscreen.js'), 'utf8');
const INITIAL_SEED = 0x5eedc0de;
let seed = INITIAL_SEED;
function random(n) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % n;
}

const workers = [];
const activeTimers = new Map();
const timerHistory = new Map();
let timerId = 0;
let listener;
let failNextConstructor = false;
let totalRequests = 0;
const requests = [];
const events = [];

class FakeWorker {
  constructor() {
    if (failNextConstructor) { failNextConstructor = false; throw new Error('planned constructor failure'); }
    this.posts = [];
    this.terminated = 0;
    workers.push(this);
  }
  postMessage(message) {
    if (this.failNextPost) { this.failNextPost = false; throw new Error('planned postMessage failure'); }
    this.posts.push(message);
  }
  terminate() { this.terminated++; }
}

const context = vm.createContext({
  Worker: FakeWorker,
  chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
  setTimeout(fn) { const id = ++timerId; activeTimers.set(id, fn); timerHistory.set(id, fn); return id; },
  clearTimeout(id) { activeTimers.delete(id); }
});
vm.runInContext(source, context);

function send() {
  const rec = { replies: [], id: null, worker: null };
  requests.push(rec); totalRequests++;
  const keep = listener({ type: 'FURIPOP_ENGINE', text: `text-${totalRequests}`, dictionary: [] }, {}, value => rec.replies.push(value));
  assert.equal(keep, true, 'engine messages must remain asynchronous');
  rec.worker = workers.at(-1) || null;
  rec.id = rec.worker?.posts.at(-1)?.id ?? null;
  return rec;
}

function answeredExactlyOnceAtMost() {
  for (const r of requests) assert.ok(r.replies.length <= 1, `request ${r.id} received ${r.replies.length} replies`);
}
function liveRequest(r) { return r && r.replies.length === 0 && r.id !== null; }
function pending() { return requests.filter(liveRequest); }
function currentWorker() {
  const p = pending();
  return p.length ? p.at(-1).worker : workers.at(-1);
}
function remember(label, fn) {
  events.push(label);
  fn();
  answeredExactlyOnceAtMost();
}
function response(r) {
  if (!liveRequest(r)) return;
  r.worker.onmessage({ data: { id: r.id, tokens: [{ reading: 'ok' }] } });
  assert.equal(r.replies.length, 1, 'current-generation matching response must settle its request');
}
function fireTimer(id) {
  const fn = timerHistory.get(id);
  assert.ok(fn, 'selected a timer that was never created');
  activeTimers.delete(id);
  fn();
}
function failureCodes(rs, code) {
  for (const r of rs) assert.equal(r.replies[0]?.code, code, `request ${r.id} should fail as ${code}; got ${JSON.stringify(r.replies)}`);
}

try {
  // Guarantee broad contract coverage, including stale callbacks which reuse a fresh request id.
  remember('bootstrap two concurrent requests', () => { send(); send(); });
  const gen1 = workers[0], gen1Msg = gen1.onmessage, gen1Err = gen1.onerror;
  const gen1TimerIds = [...activeTimers.keys()];
  const first = requests[0], second = requests[1];
  remember('resolve one of concurrent requests', () => response(first));
  remember('timeout remaining request', () => fireTimer([...activeTimers.keys()][0]));
  failureCodes([second], 'ENGINE_TIMEOUT');
  const recovered = send(), gen2 = workers[1];
  remember('old response spoofing fresh id', () => gen1Msg({ data: { id: recovered.id, tokens: [] } }));
  remember('old error and old timer after recovery', () => { gen1Err({ preventDefault() {} }); for (const id of gen1TimerIds) timerHistory.get(id)(); });
  assert.equal(recovered.replies.length, 0, 'old generation callbacks must not affect a new request');
  remember('recover response', () => response(recovered));
  assert.equal(gen2.terminated, 0);

  // Constructor, send, runtime error, message deserialization error and timeout recovery.
  remember('retire idle worker before constructor failure', () => gen2.onerror({ preventDefault() {} }));
  failNextConstructor = true;
  const constructorFailure = send();
  assert.equal(constructorFailure.replies[0]?.code, 'ENGINE_LOAD_FAILED', `constructor failure reply missing: ${JSON.stringify(constructorFailure.replies)}`);
  const postFailurePending = send();
  const gen3 = postFailurePending.worker;
  gen3.failNextPost = true;
  const postFailureTrigger = send();
  failureCodes([postFailurePending, postFailureTrigger], 'ENGINE_LOAD_FAILED');
  const errorPending1 = send(), errorPending2 = send(), gen4 = errorPending1.worker;
  remember('worker runtime error drains generation', () => gen4.onerror({ preventDefault() {} }));
  failureCodes([errorPending1, errorPending2], 'ENGINE_LOAD_FAILED');
  const messageErrPending = send(), gen5 = messageErrPending.worker;
  remember('messageerror drains generation', () => gen5.onmessageerror());
  failureCodes([messageErrPending], 'ENGINE_LOAD_FAILED');

  // 240 seeded operations across many generations, with concurrency and late event replay.
  for (let i = 0; i < 240; i++) {
    const choice = random(8);
    if (choice === 0 || pending().length === 0 && choice < 5) {
      remember('send', () => send());
    } else if (choice === 1) {
      const p = pending();
      if (p.length) remember('matching response', () => response(p[random(p.length)]));
      else remember('send fallback', () => send());
    } else if (choice === 2) {
      const ids = [...activeTimers.keys()];
      if (ids.length) remember('active timeout', () => fireTimer(ids[random(ids.length)]));
      else remember('send fallback', () => send());
    } else if (choice === 3) {
      const w = currentWorker();
      if (w && w.onmessageerror) remember('messageerror', () => w.onmessageerror());
      else remember('send fallback', () => send());
    } else if (choice === 4) {
      const w = currentWorker();
      if (w && w.onerror) remember('runtime error', () => w.onerror({ preventDefault() {} }));
      else remember('send fallback', () => send());
    } else if (choice === 5) {
      // Make postMessage throw on next request against an existing generation, if available.
      const w = currentWorker();
      if (w && pending().some(r => r.worker === w)) { w.failNextPost = true; remember('postMessage throw', () => send()); }
      else remember('send fallback', () => send());
    } else if (choice === 6) {
      // Replay an old callback with the newest live id; generation identity must dominate id equality.
      const fresh = pending().at(-1);
      const stale = workers.find(w => w !== fresh?.worker && w.onmessage);
      if (fresh && stale) remember('stale callback spoof', () => stale.onmessage({ data: { id: fresh.id, tokens: [] } }));
      else remember('send fallback', () => send());
    } else {
      // Invoke an already-cleared timeout callback to model queued timer delivery.
      const old = [...timerHistory.keys()].filter(id => !activeTimers.has(id));
      if (old.length) remember('stale timer callback', () => fireTimer(old[random(old.length)]));
      else remember('send fallback', () => send());
    }
  }

  // Finish by resolving any remaining requests, then verify all timers are cleared.
  for (const r of pending()) remember('final response', () => response(r));
  assert.equal(activeTimers.size, 0, 'no timer may remain after all requests settle');
  assert.ok(workers.length >= 20, `expected many worker generations, got ${workers.length}`);
  assert.ok(totalRequests >= 100, `expected broad request coverage, got ${totalRequests}`);
  console.log(`PASS seed=0x${INITIAL_SEED.toString(16)} events=${events.length} requests=${totalRequests} workers=${workers.length} activeTimers=${activeTimers.size}`);
} catch (error) {
  console.error(`FAIL seed=0x${INITIAL_SEED.toString(16)} events=${events.length} requests=${totalRequests}`);
  console.error(`Failure: ${error.message}`);
  console.error(`Sequence: ${events.join(' -> ')}`);
  throw error;
}
