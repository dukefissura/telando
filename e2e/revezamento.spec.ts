import { randomBytes } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { abrirApp, assistir, fecharTodos, recebeVideoEAudio, transmitir } from './apoio.ts'

const SERVER = 'http://localhost:8787'

test.skip(process.platform !== 'win32', 'O app só existe para Windows')
test.afterEach(fecharTodos)

/** A barra do palco some quando o mouse fica parado; mexer o mouse traz ela de volta. */
async function barra(pagina: Page) {
  await pagina.mouse.move(300 + Math.random() * 50, 300)
  return pagina
}

/** Quem foi aprovado escolhe a tela no seletor do app e compartilha. */
async function compartilharComoAmigo(amigo: Page) {
  await amigo.getByRole('button', { name: /^Tela 1/ }).click()
  await amigo.getByRole('button', { name: 'Compartilhar', exact: true }).click()
}

test('link fixo: com o dono offline espera e entra sozinho quando ele começa', async ({
  request,
}) => {
  const slug = `luan-${randomBytes(3).toString('hex')}`
  const segredo = randomBytes(32).toString('base64url')
  expect(
    (
      await request.put(`${SERVER}/api/links/${slug}`, { data: { segredo, nome: 'Luan' } })
    ).status(),
  ).toBe(201)

  const { janela: espectador } = await abrirApp({ args: [`telando://${slug}`] })
  await expect(
    espectador.getByRole('heading', { name: 'Luan não está ao vivo agora' }),
  ).toBeVisible()
  await espectador.getByLabel('Seu apelido').fill('Tatu Azul')

  const { host, sessao } = await transmitir()
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

test('revezamento: o amigo pede, o host aprova e um terceiro passa a ver a tela do amigo', async () => {
  const { host, link } = await transmitir()
  const { janela: amigo } = await assistir(link, 'Capivara Azul')
  const { janela: terceiro } = await assistir(link, 'Boto Rosa')
  await recebeVideoEAudio(amigo)
  await recebeVideoEAudio(terceiro)

  await (await barra(amigo)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Aprovar' }).click()
  await compartilharComoAmigo(amigo)

  await expect(terceiro.getByText('Agora: tela de Capivara Azul')).toBeVisible()
  await expect(host.getByText('Agora: tela de Capivara Azul')).toBeVisible()
  await expect(amigo.getByRole('heading', { name: 'Você está mostrando a sua tela' })).toBeVisible()
  await recebeVideoEAudio(terceiro)

  await (await barra(amigo)).getByRole('button', { name: 'Devolver a vez' }).click()
  await expect(terceiro.getByText('Agora: tela de Capivara Azul')).toBeHidden()
  await expect(host.getByRole('button', { name: 'Retomar minha tela' })).toBeHidden()
  await recebeVideoEAudio(terceiro)
})

test('revezamento: o host recusa e o amigo fica sabendo', async () => {
  const { host, link } = await transmitir()
  const { janela: amigo } = await assistir(link, 'Mico Roxo')
  await recebeVideoEAudio(amigo)

  await (await barra(amigo)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Recusar' }).click()
  await expect(amigo.getByText('O host recusou agora')).toBeVisible()
})

test('revezamento: se o amigo fecha o app, a vez volta para o host', async () => {
  const { host, link } = await transmitir()
  const amigo = await assistir(link, 'Onça Cinza')
  const { janela: terceiro } = await assistir(link, 'Quati Verde')
  await recebeVideoEAudio(amigo.janela)
  await recebeVideoEAudio(terceiro)

  await (await barra(amigo.janela)).getByRole('button', { name: 'Pedir para compartilhar' }).click()
  await host.getByRole('button', { name: 'Aprovar' }).click()
  await compartilharComoAmigo(amigo.janela)
  await expect(terceiro.getByText('Agora: tela de Onça Cinza')).toBeVisible()

  await amigo.app.close()
  await expect(terceiro.getByText('Agora: tela de Onça Cinza')).toBeHidden()
  await expect(host.getByRole('button', { name: 'Retomar minha tela' })).toBeHidden()
  await recebeVideoEAudio(terceiro)
})
