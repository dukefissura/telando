import { expect, test } from '@playwright/test'

// A página do site só abre o app; sem Electron, roda no Chromium comum.

test('o link de uma sessão oferece abrir no app e baixar', async ({ page }) => {
  await page.goto('/s/k7Qm2xPa9Lzz')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveAttribute(
    'href',
    'telando://s/k7Qm2xPa9Lzz',
  )
  await expect(page.getByRole('link', { name: 'Baixar para Windows' })).toHaveAttribute(
    'href',
    /releases\/latest\/download\/Telando-Setup\.exe$/,
  )
})

test('o link fixo abre telando://slug', async ({ page }) => {
  await page.goto('/luan')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveAttribute(
    'href',
    'telando://luan',
  )
})

test('a página inicial só oferece o download', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Baixar para Windows' })).toBeVisible()
})
