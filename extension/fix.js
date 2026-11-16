// Smooth Video for ABS Online Learning (unofficial)
//
// Problem: after every AJAX call (including the video progress report the
// player sends every few seconds), the site's OWASP CSRFGuard script asks the
// server for its CSRF token with a *synchronous* request:
//     xhr.open("POST", "/topclass/CSRFJavaScriptServlet", false)
// The server often takes 2-12 seconds to answer, and a synchronous request
// freezes the whole page until it does, so the video stalls. The server hands
// back the same token for the entire session.
//
// Fix: let the first token request through, remember the answer, and answer
// later synchronous token requests instantly from memory. Each time we answer
// from memory, we also re-check the token in the background (without blocking
// the page) so a changed or expired token is picked up. Progress tracking and
// course completion still go to the server exactly as before.
//
// Status: window.__absSmoothVideo in the DevTools console.
// Debug logging: localStorage.absSmoothVideoDebug = "1", then reload.
(() => {
  "use strict";

  if (window.__absSmoothVideo) return; // already installed in this frame

  const VERSION = "1.1.0";
  const SERVLET_RE = /\/CSRFJavaScriptServlet(?:[?#]|$)/;
  const TOKEN_RE = /^[\w-]+:[\w-]+$/;

  const XHR = XMLHttpRequest.prototype;
  const realOpen = XHR.open;
  const realSetRequestHeader = XHR.setRequestHeader;
  const realSend = XHR.send;
  const realFetch = window.fetch.bind(window);

  const tracked = new WeakMap(); // xhr -> { url, tokenRequest }
  let token = null;
  let refreshInFlight = false;

  const stats = {
    version: VERSION,
    realTokenRequests: 0,
    answeredFromMemory: 0,
    backgroundChecks: 0,
    tokenChanges: 0,
    backgroundCheckFailures: 0,
    lastRealRequestMs: null,
  };
  Object.defineProperty(stats, "hasToken", {
    enumerable: true,
    get: () => token !== null,
  });
  Object.defineProperty(window, "__absSmoothVideo", { value: stats });

  let debug = false;
  try {
    debug = window.localStorage.getItem("absSmoothVideoDebug") === "1";
  } catch (_) {
    // storage unavailable (e.g. sandboxed frame)
  }
  const log = (...args) => {
    if (debug) console.debug("[ABS Smooth Video]", ...args);
  };

  XHR.open = function (method, url, async) {
    if (arguments.length >= 3 && async === false && SERVLET_RE.test(String(url))) {
      tracked.set(this, { url: String(url), tokenRequest: false });
    } else {
      tracked.delete(this);
    }
    // Forward the caller's exact arguments: open(method, url) must stay async.
    return realOpen.apply(this, arguments);
  };

  XHR.setRequestHeader = function (name) {
    const t = tracked.get(this);
    if (t && /^fetch-csrf-token$/i.test(String(name))) t.tokenRequest = true;
    return realSetRequestHeader.apply(this, arguments);
  };

  XHR.send = function () {
    const t = tracked.get(this);
    if (!t || !t.tokenRequest) return realSend.apply(this, arguments);

    if (token !== null) {
      answerFromMemory(this, token);
      stats.answeredFromMemory++;
      checkInBackground(t.url);
      return undefined;
    }

    // First token request on this page: let the site's synchronous request run.
    const started = performance.now();
    try {
      return realSend.apply(this, arguments);
    } finally {
      stats.realTokenRequests++;
      stats.lastRealRequestMs = Math.round(performance.now() - started);
      const value = readToken(this);
      if (value) token = value;
      log("real token request took", stats.lastRealRequestMs, "ms; cached:", !!value);
    }
  };

  function readToken(xhr) {
    try {
      if (xhr.status !== 200) return null;
      const text = String(xhr.responseText).trim();
      return TOKEN_RE.test(text) ? text : null;
    } catch (_) {
      return null;
    }
  }

  function answerFromMemory(xhr, value) {
    const fields = {
      readyState: 4,
      status: 200,
      statusText: "OK",
      responseText: value,
      response: value,
    };
    for (const [key, v] of Object.entries(fields)) {
      Object.defineProperty(xhr, key, { value: v, configurable: true });
    }
    if (typeof Event === "function" && typeof xhr.dispatchEvent === "function") {
      for (const type of ["readystatechange", "load", "loadend"]) {
        try {
          xhr.dispatchEvent(new Event(type));
        } catch (_) {
          // a page handler threw; the site would have seen the same
        }
      }
    }
  }

  function checkInBackground(url) {
    if (refreshInFlight) return; // one check at a time is enough
    refreshInFlight = true;
    stats.backgroundChecks++;
    realFetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "FETCH-CSRF-TOKEN": "1" },
    })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("HTTP " + res.status))))
      .then((body) => {
        const text = String(body).trim();
        if (!TOKEN_RE.test(text)) {
          // Not a token (e.g. the session expired and the server sent a login
          // page). Forget the token so the site's own code takes over again.
          token = null;
          stats.backgroundCheckFailures++;
          log("background check returned a non-token; cache cleared");
          return;
        }
        if (text !== token) {
          token = text;
          stats.tokenChanges++;
          log("token changed; re-injecting");
          reinjectToken();
        }
      })
      .catch((err) => {
        // Network or server error: keep using the token we have.
        stats.backgroundCheckFailures++;
        log("background check failed:", err && err.message);
      })
      .finally(() => {
        refreshInFlight = false;
      });
  }

  // Have the site's own CSRFGuard code push the new token into the page's
  // hidden fields and links. Its token request is answered from memory, so
  // this is instant.
  function reinjectToken() {
    try {
      if (typeof window.tcCsrfGuard === "function") window.tcCsrfGuard();
    } catch (err) {
      log("re-inject failed:", err && err.message);
    }
  }
})();
