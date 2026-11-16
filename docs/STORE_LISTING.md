# Store listing copy

Paste-ready text for the Chrome Web Store, Edge Add-ons and Firefox Add-ons (AMO).

## Name
Smooth Video for ABS Online Learning (unofficial)

## Summary (≤132 characters)
Unofficial fix that stops American Bonanza Society Online Learning Center videos from freezing every few seconds.

## Category
Chrome: Education (Tools also fits). Firefox: Other.

## Description
Videos in the American Bonanza Society Online Learning Center (abs.topclasslms.com) often freeze for several seconds every 10–30 seconds, even after the whole video has loaded.

The cause is the site, not your computer. While a video plays, the course player regularly reports your progress to the server. After each report, the site's security script asks the server for a security token and makes the whole page wait for the answer. The server often takes 2–12 seconds to reply, and the video freezes until it does.

This extension remembers the token after the first request and hands it back instantly, so the page never has to wait. Your progress, lesson completion and quiz results are still saved to ABS exactly as before.

• Works only on abs.topclasslms.com
• Collects no data
• Requests no special permissions
• Open source: https://github.com/taylorbentz/abs-smooth-video

Not affiliated with or endorsed by the American Bonanza Society or TopClass.

## Single purpose (Chrome)
Stops course videos on abs.topclasslms.com from freezing by answering the site's repeated, page-blocking security-token requests from memory.

## Permission justification (Chrome)
Content script on https://abs.topclasslms.com/*: the extension must run on the ABS course pages to stop the page-blocking token requests. It requests no other permissions and runs on no other sites.

## Remote code (Chrome)
No, I am not using remote code.

## Data usage (Chrome)
Does not collect any of the listed data types. Certify all three disclosures (no selling, no unrelated use, no creditworthiness use).

## Privacy policy URL
https://github.com/taylorbentz/abs-smooth-video/blob/main/PRIVACY.md

## Assets
- Store icon: `extension/icons/icon-128.png`
- Small promo tile (440×280): `art/promo-440x280.png`
- Screenshot (1280×800 or 640×400): **still needed.** Take one of a course video
  playing, with the console showing `__absSmoothVideo`.

## Firefox notes
- Upload `dist/abs-smooth-video-firefox-<version>.zip`.
- If asked for source code: the extension isn't minified or bundled, so no source upload is needed.
- Requires Firefox 128+ (content-script `world: "MAIN"`).
