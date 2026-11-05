import { defineConfig, devices } from 'playwright/test'

// Mobile viewports are opt-in: several e2e tests switch viewport sizes and assert
// desktop-only hover/touch behavior, so they only make sense outside the default
// chromium/firefox run. Enable with PLAYWRIGHT_MOBILE=1 and select the project.
const mobileProjects = process.env.PLAYWRIGHT_MOBILE
  ? [
      // WebKit's Ubuntu fallback needs libicudata.so.74, unavailable on Fedora 45;
      // run mobile viewports on Chromium instead (layout/touch, not Safari behavior).
      { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
      { name: 'mobile-safari-sized', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    ]
  : []

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    ...mobileProjects,
  ],
  use: {
    navigationTimeout: 5_000,
    actionTimeout: 5_000,
  },
})
