# Smooth Video for ABS Online Learning (unofficial)

A small browser extension that stops videos in the American Bonanza Society
[Online Learning Center](https://abs.topclasslms.com) from freezing every few
seconds.

> Not affiliated with or endorsed by the American Bonanza Society or TopClass.

## The problem

On the ABS Online Learning Center, course videos often pause for several
seconds every 10–30 seconds, even after the whole video has loaded. Changing
browsers or browser settings doesn't help.

The cause is not your computer or your internet connection. While a video
plays, the course player reports your position back to the server every few
seconds. After each report, the site's security script asks the server for a
security token and makes the whole page wait for the answer. The server often
takes 2–12 seconds to reply, and the video freezes until it does. The server
gives back the same token every time.

## What this extension does

It lets the first token request go through, remembers the answer, and hands
it back instantly the next time the page asks. The page never has to wait, so
the video plays smoothly.

Everything else works as before. Your progress, lesson completion and quiz
results are saved to ABS exactly as they would be without the extension.

## Install

**Chrome, Edge, Brave:** Chrome Web Store link coming soon.

**Manual install (works today):**

1. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder.
5. Reload your ABS course tab.

**Firefox:** Firefox Add-ons link coming soon (needs Firefox 128 or newer).

## Is it safe?

- **It works on one website only:** `abs.topclasslms.com`. It does nothing anywhere else.
- **It collects nothing.** It doesn't send anything to anyone except ABS's own
  site, and it only makes requests the site was already making.
- **It doesn't weaken the site's security.** The site still gets the same
  security token on every request; the extension just stops the page from
  freezing while it waits for that token.
- **The code is short and open.** All of it is in [`extension/fix.js`](extension/fix.js),
  with comments explaining each step.
- **It asks for no special browser permissions.**

## Check that it's working

1. Open a course video and press **Cmd+Option+J** (Mac) or **Ctrl+Shift+J** (Windows) to open the console.
2. Type `__absSmoothVideo` and press Enter.

`answeredFromMemory` counts how many times the extension saved you a wait.

## Troubleshooting

- **The site says your session expired, or progress isn't saving:** reload the page.
  The extension also checks for a new token in the background after each
  request, and steps aside if your session has ended.
- **Still choppy:** make sure the extension is turned on in `chrome://extensions`, then reload the course tab.
- **If ABS fixes the problem on their end,** the extension simply has nothing
  left to do. You can remove it at any time from `chrome://extensions`.

## How it works (technical)

TopClass LMS uses OWASP CSRFGuard. After every jQuery AJAX request completes,
TopClass calls `tcCsrfGuard()`, which does:

```js
xhr.open("POST", "/topclass/CSRFJavaScriptServlet", false); // synchronous
xhr.setRequestHeader("FETCH-CSRF-TOKEN", "1");
xhr.send(null);
```

A synchronous XHR blocks the renderer's main thread until the server replies.
The video player's progress report (`UpdateStudentTimeline`) fires often, so
these blocks happen repeatedly during playback.

`extension/fix.js` runs in the page's main world at `document_start` and wraps
`XMLHttpRequest.prototype.open/setRequestHeader/send`:

1. The first synchronous `FETCH-CSRF-TOKEN` request goes to the server, and the
   `NAME:VALUE` token is cached.
2. Later ones are answered from the cache. Every other request passes through
   untouched.
3. Each cached answer also starts one non-blocking `fetch()` to re-check the token
   (at most one at a time). If the token changed, the cache is updated and
   `tcCsrfGuard()` is called to push the new token into the page. If the
   response isn't a token (for example, the session expired), the cache is cleared and
   the site's own behavior takes over.

The extension never sends more token requests than the site already does.

## Development

```sh
npm test         # unit tests (Node 22+, no dependencies)
npm run build    # tests + store zips in dist/
npm run icons    # re-render icons from art/*.svg (needs rsvg-convert)
```

Store listing text: [`docs/STORE_LISTING.md`](docs/STORE_LISTING.md).
Privacy policy: [`PRIVACY.md`](PRIVACY.md).

## License

MIT — see [LICENSE](LICENSE).
