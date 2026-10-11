// @ts-check
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { viewport: { width: 1500, height: 1000 }, browserName: 'chromium' },
});
