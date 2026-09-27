// Baixa o livekit-server oficial (versão fixa, checksum conferido) e roda em modo --dev.
// Existe para o dev não depender de Docker; o CI usa o mesmo script para os testes E2E.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const VERSAO = '1.13.7'
const ehWindows = process.platform === 'win32'
const pacote = ehWindows
  ? `livekit_${VERSAO}_windows_amd64.zip`
  : `livekit_${VERSAO}_linux_amd64.tar.gz`
const base = `https://github.com/livekit/livekit/releases/download/v${VERSAO}`
const pasta = join('.livekit', VERSAO)
const binario = join(pasta, ehWindows ? 'livekit-server.exe' : 'livekit-server')

async function baixar(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Não consegui baixar ${url} (HTTP ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

if (!existsSync(binario)) {
  console.log(`Baixando livekit-server ${VERSAO}...`)
  const [arquivo, checksums] = await Promise.all([
    baixar(`${base}/${pacote}`),
    baixar(`${base}/checksums.txt`).then(String),
  ])
  const esperado = checksums
    .split('\n')
    .find((linha) => linha.trim().endsWith(pacote))
    ?.split(/\s+/)[0]
  const obtido = createHash('sha256').update(arquivo).digest('hex')
  if (esperado !== obtido)
    throw new Error(`Checksum de ${pacote} não bate. Apague .livekit/ e tente de novo.`)

  await mkdir(pasta, { recursive: true })
  const destino = join(pasta, pacote)
  await writeFile(destino, arquivo)
  // No Git Bash o `tar` do PATH é o GNU, que não abre zip; o bsdtar do Windows abre.
  const tar = ehWindows ? 'C:\\Windows\\System32\\tar.exe' : 'tar'
  execFileSync(tar, ['-xf', destino, '-C', pasta])
}

const servidor = spawn(binario, ['--dev', '--config', join('infra', 'livekit.dev.yaml')], {
  stdio: 'inherit',
})
servidor.on('exit', (codigo) => process.exit(codigo ?? 0))
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => servidor.kill(sinal))
