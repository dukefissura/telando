import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  // Cada teste abre dois ou três apps Electron.
  timeout: 90_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    // E2E_BASE_URL aponta para o server de produção (API e site juntos) quando se quer testar o build.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Os testes leem estados finais; animação só atrasaria.
    contextOptions: { reducedMotion: 'reduce' },
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
