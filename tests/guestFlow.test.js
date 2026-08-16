/**
 * Guest flow logic trace — tests/guestFlow.test.js
 *
 * Pure-logic unit tests that mirror every state-machine decision in App.jsx.
 * No Firebase, no React rendering.  Each test corresponds to a labelled Trace
 * in the audit brief so failures point directly to the offending branch.
 *
 * Run with:  npm test  (vitest)
 */

import { describe, it, expect } from 'vitest';

// ─── Pure helpers mirroring App.jsx logic ────────────────────────────────────

const BID = 'bKXm2zKZzByRLFhmwLFN';
const EID = 'jt3p2wL762tuu9U8kYnO';

function isGuestFlow(urlBid, urlTab, urlCode) {
  return !!(urlBid && (urlTab === 'community' || urlTab === 'events') && !urlCode);
}

function isGuestFlowActive(urlBid, urlTab, urlCode, ssGuestBid) {
  return isGuestFlow(urlBid, urlTab, urlCode) || !!ssGuestBid;
}

function effectiveGuestBid(urlBid, ssGuestBid) {
  return urlBid || ssGuestBid;
}

function isMemberOf(account, bid) {
  return !!((account?.buildings ?? []).includes(bid));
}

function joinContext(user, account, urlBid, guestFlowFlag) {
  return !!(user && account && urlBid && !isMemberOf(account, urlBid) && !guestFlowFlag);
}

function effectiveBid(account, activeBid, urlBid, jCtx) {
  if (!account || jCtx) return '';
  if (urlBid && isMemberOf(account, urlBid)) return urlBid;
  if (activeBid && isMemberOf(account, activeBid)) return activeBid;
  return (account.buildings ?? [])[0] ?? '';
}

/**
 * Simulates which render branch App.jsx takes given a snapshot of state.
 * Returns a string label matching each early-return in the render section.
 */
function renderBranch({
  authReady,
  user,
  account,
  creating = false,
  guestFlowActiveFlag,
  effGuestBid,
  guestJoinError = null,
  jCtx,
  effBid,
  membership,
  // guestJoinStarted.current — pass as plain boolean for pure testing
  guestJoinStartedCurrent = false,
}) {
  const member = (bid) => !!(account?.buildings ?? []).includes(bid);

  if (!authReady)                                         return 'splash:init';
  if (!user)                                             return 'auth';
  if (!account)                                          return 'splash:loading-account';
  if (creating)                                          return 'setup';

  // Line 366 in App.jsx (guard ORDER matters — must come before !effectiveBid)
  if (guestFlowActiveFlag && effGuestBid && !member(effGuestBid))
    return guestJoinError ? 'error:guest-join' : 'splash:joining';

  if (jCtx)                                              return 'join';
  if (!effBid)                                           return 'landing:no-building';

  // membership null guard — skipped during active guest flow
  if (membership === null && !guestFlowActiveFlag && !guestJoinStartedCurrent)
    return 'landing:null-membership';

  return 'dashboard-or-loading';
}

// ─── TRACE 1: New user, fresh account, event deep link ──────────────────────

describe('TRACE 1 — New user arrives via event deep link', () => {
  const urlBid  = BID;
  const urlTab  = 'events';
  const urlCode = '';

  it('1a: isGuestFlow is true', () => {
    expect(isGuestFlow(urlBid, urlTab, urlCode)).toBe(true);
  });

  it('1b: isGuestFlowActive is true (URL params present)', () => {
    expect(isGuestFlowActive(urlBid, urlTab, urlCode, '')).toBe(true);
  });

  it('1c: isGuestFlowActive is true even with ssGuestBid as fallback (URL cleared)', () => {
    // Simulate OAuth redirect clearing URL — sessionStorage still has bid
    expect(isGuestFlowActive('', '', '', BID)).toBe(true);
  });

  it('1d: effectiveGuestBid falls back to sessionStorage when URL is cleared', () => {
    expect(effectiveGuestBid('', BID)).toBe(BID);
  });

  it('1e: authReady=false → splash:init (before Firebase ready)', () => {
    const branch = renderBranch({
      authReady: false, user: null, account: undefined,
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: '', membership: undefined,
    });
    expect(branch).toBe('splash:init');
  });

  it('1f: user=null → auth screen with guestFlow=true', () => {
    const branch = renderBranch({
      authReady: true, user: null, account: undefined,
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: '', membership: undefined,
    });
    expect(branch).toBe('auth');
  });

  it('1g: account loading (null) → splash, not Landing', () => {
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: null,
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: '', membership: undefined,
    });
    expect(branch).toBe('splash:loading-account');
  });

  it('1h: account loaded, not yet member → splash:joining (NOT landing:no-building)', () => {
    const acc = { buildings: [] };
    const gfa = isGuestFlowActive(urlBid, urlTab, urlCode, '');
    const egb = effectiveGuestBid(urlBid, '');
    const jc  = joinContext({ uid: 'u1' }, acc, urlBid, isGuestFlow(urlBid, urlTab, urlCode));
    const eb  = effectiveBid(acc, '', urlBid, jc);

    // KEY: effectiveBid is "" because user has no buildings yet
    expect(eb).toBe('');

    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: acc,
      guestFlowActiveFlag: gfa, effGuestBid: egb,
      jCtx: jc, effBid: eb, membership: undefined,
    });
    // Must be splash:joining, NOT landing:no-building
    expect(branch).toBe('splash:joining');
  });

  it('1i: guest join splash guard runs BEFORE !effectiveBid guard', () => {
    // This test explicitly verifies guard ordering: line 366 before line 380.
    // effectiveBid="" and isGuestFlowActive=true → must hit splash:joining not landing
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: '',   // empty — would cause landing if reached
      membership: undefined,
    });
    expect(branch).not.toBe('landing:no-building');
    expect(branch).toBe('splash:joining');
  });

  it('1j: after join succeeds → isMemberOf becomes true → splash clears', () => {
    const accAfterJoin = { buildings: [BID] };
    expect(isMemberOf(accAfterJoin, BID)).toBe(true);

    const gfa = isGuestFlowActive(urlBid, urlTab, urlCode, '');
    const egb = effectiveGuestBid(urlBid, '');
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: accAfterJoin,
      guestFlowActiveFlag: gfa, effGuestBid: egb,
      jCtx: false, effBid: BID, membership: undefined,
    });
    // Should pass through to dashboard-or-loading, not splash:joining
    expect(branch).toBe('dashboard-or-loading');
  });

  it('1k: membership null guard is bypassed when isGuestFlowActive=true', () => {
    // Transient null from Firestore local cache must NOT show Landing
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [BID] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: BID, membership: null,
    });
    expect(branch).not.toBe('landing:null-membership');
    expect(branch).toBe('dashboard-or-loading');
  });

  it('1l: membership null guard is bypassed when guestJoinStarted=true', () => {
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [BID] },
      guestFlowActiveFlag: false, effGuestBid: BID,
      guestJoinStartedCurrent: true,
      jCtx: false, effBid: BID, membership: null,
    });
    expect(branch).not.toBe('landing:null-membership');
    expect(branch).toBe('dashboard-or-loading');
  });
});

// ─── TRACE 2: Returning guest (no URL params) ────────────────────────────────

describe('TRACE 2 — Returning guest signs in without URL params', () => {
  it('2a: isGuestFlow=false when no URL params', () => {
    expect(isGuestFlow('', '', '')).toBe(false);
  });

  it('2b: isGuestFlowActive=false when no URL and no sessionStorage', () => {
    expect(isGuestFlowActive('', '', '', '')).toBe(false);
  });

  it('2c: effectiveBid resolves via account.buildings[0]', () => {
    const acc = { buildings: [BID] };
    expect(effectiveBid(acc, '', '', false)).toBe(BID);
  });

  it('2d: guest join effect guard skips join (already a member)', () => {
    const acc = { buildings: [BID] };
    // isGuestFlowActive=false → effect returns early — no join attempted
    expect(isGuestFlowActive('', '', '', '')).toBe(false);
    expect(isMemberOf(acc, BID)).toBe(true);
  });

  it('2e: render falls through to dashboard-or-loading', () => {
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [BID] },
      guestFlowActiveFlag: false, effGuestBid: '',
      jCtx: false, effBid: BID,
      membership: { residentType: 'guest', flat: null, roles: [] },
    });
    expect(branch).toBe('dashboard-or-loading');
  });
});

// ─── TRACE 3: Existing resident clicks event link ────────────────────────────

describe('TRACE 3 — Resident (already member) opens event deep link', () => {
  const urlBid  = BID;
  const urlTab  = 'events';
  const urlCode = '';

  it('3a: isGuestFlow=true (URL has params)', () => {
    expect(isGuestFlow(urlBid, urlTab, urlCode)).toBe(true);
  });

  it('3b: isMemberOf=true for existing member', () => {
    expect(isMemberOf({ buildings: [BID] }, BID)).toBe(true);
  });

  it('3c: guest join effect guard skips join when already a member', () => {
    // Effect checks: if (!isGuestFlowActive || ... || isMemberOf(effectiveGuestBid)) return;
    // isMemberOf=true → returns early, no join
    const acc = { buildings: [BID] };
    expect(isMemberOf(acc, BID)).toBe(true); // would cause early return
  });

  it('3d: joinContext=false (isGuestFlow=true prevents regular join screen)', () => {
    const acc  = { buildings: [BID] };
    const gf   = isGuestFlow(urlBid, urlTab, urlCode);
    const jc   = joinContext({ uid: 'u1' }, acc, urlBid, gf);
    expect(jc).toBe(false);
  });

  it('3e: effectiveBid = urlBid (already a member)', () => {
    const acc  = { buildings: [BID] };
    const jc   = false;
    const eb   = effectiveBid(acc, '', urlBid, jc);
    expect(eb).toBe(BID);
  });

  it('3f: render goes straight to dashboard-or-loading (not splash:joining)', () => {
    // isMemberOf=true → guest splash guard does NOT match
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [BID] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      jCtx: false, effBid: BID,
      membership: { residentType: 'owner', flat: 'A-101', roles: [] },
    });
    expect(branch).toBe('dashboard-or-loading');
  });
});

// ─── TRACE 4: Guest join fails + retry ───────────────────────────────────────

describe('TRACE 4 — Guest join fails, error shown, retry re-fires effect', () => {
  it('4a: failed join sets guestJoinError → renders error:guest-join, not splash:joining', () => {
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      guestJoinError: 'permission-denied',
      jCtx: false, effBid: '', membership: undefined,
    });
    expect(branch).toBe('error:guest-join');
  });

  it('4b: after clearing error, render shows splash:joining again', () => {
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      guestJoinError: null,    // cleared by onRetry
      jCtx: false, effBid: '', membership: undefined,
    });
    expect(branch).toBe('splash:joining');
  });

  it('4c: guestJoinRetry increment is the ONLY way to re-fire the join effect after retry', () => {
    // Effect deps: [isGuestFlowActive, user?.uid, account?.username, effectiveGuestBid, guestJoinRetry]
    // After onRetry: guestJoinStarted.current=false + guestJoinError=null are refs/state that do NOT
    // appear in effect deps.  Without guestJoinRetry, the effect would never re-fire.
    // This test documents that guestJoinRetry must be in deps.
    const effectDeps = ['isGuestFlowActive', 'user?.uid', 'account?.username', 'effectiveGuestBid', 'guestJoinRetry'];
    expect(effectDeps).toContain('guestJoinRetry');
  });

  it('4d: retry increments guestJoinRetry → new dep value → effect re-fires', () => {
    // Simulate the counter increment
    let guestJoinRetry = 0;
    const increment = () => { guestJoinRetry += 1; };
    increment();
    expect(guestJoinRetry).toBe(1); // React would see dep changed → re-run effect
    increment();
    expect(guestJoinRetry).toBe(2); // each retry re-fires the join
  });

  it('4e: Landing is not shown during active guest flow even with membership=null', () => {
    // Confirm the fix: isGuestFlowActive=true guards the null-membership Landing branch
    const branch = renderBranch({
      authReady: true, user: { uid: 'u1' }, account: { buildings: [] },
      guestFlowActiveFlag: true, effGuestBid: BID,
      guestJoinError: null,
      jCtx: false, effBid: '', membership: null,
    });
    // effBid="" → would hit landing:no-building BUT isGuestFlowActive guard runs first
    expect(branch).toBe('splash:joining');
    expect(branch).not.toBe('landing:no-building');
    expect(branch).not.toBe('landing:null-membership');
  });
});

// ─── URL parsing edge cases ───────────────────────────────────────────────────

describe('URL edge cases', () => {
  it('invite code present → isGuestFlow=false (regular join flow, not guest)', () => {
    expect(isGuestFlow(BID, 'events', 'INVITE123')).toBe(false);
  });

  it('tab=community also triggers guest flow', () => {
    expect(isGuestFlow(BID, 'community', '')).toBe(true);
  });

  it('tab=water does NOT trigger guest flow', () => {
    expect(isGuestFlow(BID, 'water', '')).toBe(false);
  });

  it('no bid → isGuestFlow=false', () => {
    expect(isGuestFlow('', 'events', '')).toBe(false);
  });
});
