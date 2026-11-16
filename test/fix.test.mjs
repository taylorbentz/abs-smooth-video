import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../extension/fix.js", import.meta.url), "utf8");
const SERVLET = "/topclass/CSRFJavaScriptServlet";
const flush = () => new Promise((r) => setImmediate(r));

// Builds a fresh page: a fake XHR/fetch "server", the extension, and a copy of
// the site's CSRFGuard token fetch.
function makePage({ token = "CSRF_KEY:AAAA-BBBB", fetchImpl } = {}) {
  const server = { token, xhrCalls: [], fetchCalls: [] };

  class FakeXHR {
    open(method, url, async) {
      this._req = { method, url, async, argc: arguments.length, headers: {} };
    }
    setRequestHeader(name, value) {
      this._req.headers[name] = value;
    }
    send() {
      server.xhrCalls.push(this._req);
      this._status = 200;
      this._text = this._req.url.includes("CSRFJavaScriptServlet")
        ? server.token
        : '{"result":"success"}';
    }
    get status() { return this._status; }
    get responseText() { return this._text; }
    get readyState() { return 4; }
  }

  const fetch =
    fetchImpl ??
    (async (url, opts) => {
      server.fetchCalls.push({ url, opts });
      return { ok: true, status: 200, text: async () => server.token };
    });

  const ctx = { XMLHttpRequest: FakeXHR, fetch, performance, console, injected: [] };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);

  // Same request the site's tcCsrfGuard() makes after every AJAX call.
  vm.runInContext(
    `function tcCsrfGuard() {
       var xhr = new XMLHttpRequest();
       xhr.open("POST", "${SERVLET}", false);
       xhr.setRequestHeader("FETCH-CSRF-TOKEN", "1");
       xhr.send(null);
       injected.push(xhr.responseText);
       return xhr.responseText;
     }`,
    ctx
  );
  return { ctx, server, guard: () => ctx.tcCsrfGuard(), stats: ctx.__absSmoothVideo };
}

test("first token request goes to the server synchronously and is remembered", () => {
  const { server, guard, stats } = makePage();
  assert.equal(guard(), "CSRF_KEY:AAAA-BBBB");
  assert.equal(server.xhrCalls.length, 1);
  assert.equal(server.xhrCalls[0].async, false);
  assert.equal(stats.realTokenRequests, 1);
  assert.equal(stats.hasToken, true);
});

test("later token requests are answered from memory without a synchronous request", async () => {
  const { server, guard, stats } = makePage();
  guard();
  for (let i = 0; i < 5; i++) assert.equal(guard(), "CSRF_KEY:AAAA-BBBB");
  assert.equal(server.xhrCalls.length, 1, "no extra synchronous requests");
  assert.equal(stats.answeredFromMemory, 5);
  await flush();
});

test("only one background check runs at a time", async () => {
  const { server, guard, stats } = makePage();
  guard();
  guard();
  guard();
  guard();
  assert.equal(server.fetchCalls.length, 1);
  assert.equal(server.fetchCalls[0].opts.headers["FETCH-CSRF-TOKEN"], "1");
  await flush();
  guard();
  assert.equal(server.fetchCalls.length, 2, "a new check starts after the previous one finished");
  assert.equal(stats.backgroundChecks, 2);
  await flush();
});

test("a changed token is picked up and re-injected into the page", async () => {
  const { ctx, server, guard, stats } = makePage();
  guard();
  server.token = "CSRF_KEY:CCCC-DDDD";
  guard(); // answered with old token, starts background check
  await flush();
  assert.equal(stats.tokenChanges, 1);
  assert.equal(ctx.injected.at(-1), "CSRF_KEY:CCCC-DDDD", "site re-injected the new token");
  assert.equal(guard(), "CSRF_KEY:CCCC-DDDD");
  assert.equal(server.xhrCalls.length, 1, "re-injection did not make a synchronous request");
  await flush();
});

test("a non-token answer (expired session) clears memory so the site takes over", async () => {
  const { server, guard, stats } = makePage();
  guard();
  server.token = "<html>Please log in</html>";
  guard();
  await flush();
  assert.equal(stats.hasToken, false);
  guard();
  assert.equal(server.xhrCalls.length, 2, "next request went to the server for real");
});

test("a network error keeps the current token", async () => {
  let calls = 0;
  const { guard, stats } = makePage({
    fetchImpl: async () => {
      calls++;
      throw new Error("offline");
    },
  });
  guard();
  guard();
  await flush();
  assert.equal(calls, 1);
  assert.equal(stats.backgroundCheckFailures, 1);
  assert.equal(stats.hasToken, true);
  assert.equal(guard(), "CSRF_KEY:AAAA-BBBB");
  await flush();
});

test("other requests pass through untouched", () => {
  const { ctx, server, guard } = makePage();
  guard();
  vm.runInContext(
    `var a = new XMLHttpRequest(); a.open("POST", "/topclass/topclass.do?UpdateStudentTimeline", true); a.send("x");
     var b = new XMLHttpRequest(); b.open("GET", "/topclass/media/1.mp4"); b.send();
     var c = new XMLHttpRequest(); c.open("POST", "${SERVLET}", false); c.send(null);`,
    ctx
  );
  assert.equal(server.xhrCalls.length, 4);
  assert.equal(server.xhrCalls[1].async, true);
  assert.equal(server.xhrCalls[2].argc, 2, "open(method, url) keeps its 2 arguments, so it stays async");
  assert.equal(server.xhrCalls[3].headers["FETCH-CSRF-TOKEN"], undefined, "page-token request went to server");
});

test("status object does not expose the token value", () => {
  const { guard, stats } = makePage();
  guard();
  assert.ok(!JSON.stringify(stats).includes("AAAA"));
});

test("installing twice in the same frame is a no-op", () => {
  const { ctx, server, guard } = makePage();
  vm.runInContext(SRC, ctx);
  guard();
  guard();
  assert.equal(server.xhrCalls.length, 1);
});

test("manifest version matches fix.js", () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8")
  );
  assert.ok(SRC.includes(`const VERSION = "${manifest.version}"`));
});
