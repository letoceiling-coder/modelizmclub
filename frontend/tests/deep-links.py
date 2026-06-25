"""
Deep-link & card-navigation QA for МоДелизМ Club.

Verifies that nested routes render correctly both when the URL is opened
directly (cold load) and when reached via a click from a parent listing.

Covered routes:
  /ads, /ads/$id, /ads/new
  /communities, /communities/$id
  /categories, /categories/$id, /categories/$id/$subId

Usage:
  python3 tests/deep-links.py             # against localhost:8080 (dev)
  BASE=https://... python3 tests/deep-links.py

Run only after the dev server is up (Vite on :8080 by default).
"""
import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE", "http://localhost:8080")
SS = Path("/tmp/browser/qa/deep-links")
SS.mkdir(exist_ok=True, parents=True)


async def visit(page, label, url):
    """Open URL, return (ok, h1, body_len, errors)."""
    errs = []
    listener = lambda e: errs.append(str(e))
    page.on("pageerror", listener)
    await page.goto(f"{BASE}{url}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    h1 = await page.evaluate(
        "() => { const h = document.querySelector('h1,h2'); "
        "return h ? h.textContent.trim().slice(0,80) : ''; }"
    )
    body_len = await page.evaluate("() => document.body.innerText.length")
    await page.screenshot(path=str(SS / f"{label}.png"))
    page.remove_listener("pageerror", listener)
    ok = body_len > 200 and len(errs) == 0 and bool(h1)
    return ok, h1, body_len, errs


async def main():
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        # ── Direct deep-link cold loads ──────────────────────────────────
        direct = [
            ("ads_list",       "/ads"),
            ("ads_new",        "/ads/new"),
            ("ads_detail_a1",  "/ads/a1"),
            ("ads_detail_a2",  "/ads/a2"),
            ("com_list",       "/communities"),
            ("com_detail_g1",  "/communities/g1"),
            ("com_detail_g3",  "/communities/g3"),
            ("cat_list",       "/categories"),
            ("cat_detail_c1",  "/categories/c1"),
            ("cat_sub_c1_s1",  "/categories/c1/s1"),
        ]
        for label, url in direct:
            ok, h1, n, errs = await visit(page, label, url)
            results.append((f"direct  {url}", ok, h1, n, errs))

        # ── Click-through from parent listings ───────────────────────────
        async def card_nav(label, listing_url, anchor_selector, expect_prefix):
            await page.goto(f"{BASE}{listing_url}", wait_until="domcontentloaded")
            await page.wait_for_timeout(800)
            link = page.locator(anchor_selector).first
            if await link.count() == 0:
                return False, "no card", 0, []
            href = await link.get_attribute("href")
            await link.click()
            await page.wait_for_timeout(900)
            await page.screenshot(path=str(SS / f"{label}.png"))
            return (
                page.url.startswith(f"{BASE}{expect_prefix}") and href != expect_prefix,
                href or "",
                await page.evaluate("() => document.body.innerText.length"),
                [],
            )

        nav_cases = [
            ("nav_com",  "/communities", 'a[href^="/communities/"]',                    "/communities/"),
            ("nav_cat",  "/categories",  'a[href^="/categories/"]',                     "/categories/"),
            ("nav_ad",   "/ads",         'a[href^="/ads/"]:not([href="/ads/new"])',     "/ads/"),
        ]
        for label, listing, sel, prefix in nav_cases:
            ok, info, n, errs = await card_nav(label, listing, sel, prefix)
            results.append((f"nav     {listing} → {info}", ok, "", n, errs))

        await browser.close()

    # ── Report ───────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(" Deep-link QA report")
    print("=" * 70)
    passed = 0
    for name, ok, h1, n, errs in results:
        mark = "✅" if ok else "❌"
        suffix = f"h='{h1}' body={n}" if h1 else f"body={n}"
        if errs:
            suffix += f" errors={len(errs)}"
        print(f"  {mark}  {name:55s}  {suffix}")
        if ok:
            passed += 1
    print(f"\n  {passed}/{len(results)} passed")
    print(f"  Screenshots: {SS}")

    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
