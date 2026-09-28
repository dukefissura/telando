import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir .. dev:livekit',
      url: 'http://localhost:7880',
      reuseExistingServer: true,
      stderr: 'ignore',
    },
    {
      command: 'pnpm --dir ../apps/server exec tsx src/main.ts',
      // A suíte cria bem mais que 10 sessões por minuto, todas do mesmo IP.
      env: { SESSOES_POR_MINUTO: '1000' },
      url: 'http://localhost:8787/api/health',
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --dir ../apps/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
})
