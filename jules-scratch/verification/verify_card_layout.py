import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:3000/research")

        # Click the caret to open the first card
        await page.click('button[aria-label="caret-down"]')

        # Wait for the card to open and the content to be visible
        await page.wait_for_selector(".card-content-grid")

        # Take a screenshot of the opened card
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())