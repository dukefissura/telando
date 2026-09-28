import { randomBytes } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { assistir, novaAba, recebeVideoEAudio, transmitir } from './apoio.ts'

const SERVER = 'http://localhost:8787'

/** A barra do palco some quando o mouse fica parado; mexer o mouse traz ela de volta. */
async function barra(pagina: Page) {
  await pagina.mouse.move(300 + Math.random() * 50, 300)
  return pagina
}

test('link fixo: com o dono offline espera e entra sozinho quando ele começa', async ({
  browser,
  request,
}) => {
  const slug = `luan-${randomBytes(3).toString('hex')}`
  const segredo = randomBytes(32).toString('base64url')
  expect(
    (
      await request.put(`${SERVER}/api/links/${slug}`, { data: { segredo, nome: 'Luan' } })
    ).status(),
  ).toBe(201)

  const espectador = await novaAba(browser)
  await espectador.goto(`/${slug}`)
  await expect(
    espectador.getByRole('heading', { name: 'Luan não está ao vivo agora' }),
  ).toBeVisible()
  await espectador.getByLabel('Seu apelido').fill('Tatu Azul')

  const { host, sessao } = await transmitir(browser)
  const apontar = await request.post(`${SERVER}/api/links/${slug}/live`, {
    headers: { authorization: `Bearer ${sessao.hostToken}` },
    data: { segredo, sessionId: sessao.id },
  })
  expect(apontar.status()).toBe(204)

  await recebeVideoEAudio(espectador)
  await expect(host.getByTestId('lista-espectadores')).toContainText('Tatu Azul')

  await host.getByRole('button', { name: 'Parar' }).click()
  await expect(
    espectador.getByRole('heading', { name: 'Luan encerrou a transmissão' }),
  ).toBeVisible()
})

test('revezamento: o amigo pede, o host aprova e a terceira aba passa a ver a tela do amigo', async ({
  browser,
}) => {
  const { host, link } = await transmitir(browser)
  const amigo = await assistir(browser, link, 'Capivara Azul')
  const terceira = await assistir(browser, link, 'Boto Rosa')
  await recebeVideoEAudio(amigo)
  await recebeVideoEAudio(terceira)

  await (await barra(amigo)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Aprovar' }).click()
  await amigo.getByRole('button', { name: 'Compartilhar', exact: true }).click()

  await expect(terceira.getByText('Agora: tela de Capivara Azul')).toBeVisible()
  await expect(host.getByText('Agora: tela de Capivara Azul')).toBeVisible()
  await expect(amigo.getByRole('heading', { name: 'Você está mostrando a sua tela' })).toBeVisible()
  await recebeVideoEAudio(terceira)

  await (await barra(amigo)).getByRole('button', { name: 'Devolver a vez' }).click()
  await expect(terceira.getByText('Agora: tela de Capivara Azul')).toBeHidden()
  await expect(host.getByRole('button', { name: 'Retomar minha tela' })).toBeHidden()
  await recebeVideoEAudio(terceira)
})

test('revezamento: o host recusa e o amigo fica sabendo', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const amigo = await assistir(browser, link, 'Mico Roxo')
  await recebeVideoEAudio(amigo)

  await (await barra(amigo)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Recusar' }).click()
  await expect(amigo.getByText('O host recusou agora')).toBeVisible()
})

test('revezamento: se o amigo fecha a aba, a vez volta para o host', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const amigo = await assistir(browser, link, 'Onça Cinza')
  const terceira = await assistir(browser, link, 'Quati Verde')
  await recebeVideoEAudio(amigo)
  await recebeVideoEAudio(terceira)

  await (await barra(amigo)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Aprovar' }).click()
  await amigo.getByRole('button', { name: 'Compartilhar', exact: true }).click()
  await expect(terceira.getByText('Agora: tela de Onça Cinza')).toBeVisible()

  await amigo.close({ runBeforeUnload: true })
  await expect(terceira.getByText('Agora: tela de Onça Cinza')).toBeHidden()
  await expect(host.getByRole('button', { name: 'Retomar minha tela' })).toBeHidden()
  await recebeVideoEAudio(terceira)
})
