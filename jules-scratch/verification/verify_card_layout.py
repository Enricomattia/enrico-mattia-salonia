import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    # Use a mobile viewport to trigger the media query
    context = browser.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True)
    page = context.new_page()

    # Go to the research page
    page.goto("http://localhost:3000/research")

    # Pause the script to allow for manual inspection
    page.pause()

    # Locate the specific card we want to interact with
    card = page.locator('div.card:has(h3:has-text("Identifying Belief-dependent Preferences"))')

    # Find the button within that card and click it to expand the card
    card.get_by_role('button', name='caret-down').click()

    # Locate the content area within that specific card
    card_content = card.locator('.card-content')

    # Wait for the 'closed' class to be removed, which indicates the content is visible
    expect(card_content).not_to_have_class("closed", timeout=10000)

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)