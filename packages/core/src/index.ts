export { apelidoAleatorio } from './apelidos.ts'
export { criarClienteApi, ErroApi, type SessaoCriada } from './api.ts'
export { type AmostraEnvio, type EstatisticasEnvio, resumirEnvio } from './estatisticas.ts'
export { lerConfigSalva, presetQueCabe, uploadNecessarioKbps } from './preferencias.ts'
export { lerSessaoMetadata, type SessaoMetadata } from './sessao.ts'
export {
  aplicarPreset,
  type CamadaSimulcast,
  type Codec,
  type ConfigMicrofone,
  type ConfigTransmissao,
  configPadrao,
  constraintsDoAudioSistema,
  type Dimensoes,
  type Fps,
  NOMES_QUALIDADE_AUDIO,
  type Otimizacao,
  PRESETS,
  type PresetId,
  presetAtual,
  type QualidadeAudio,
  type Resolucao,
  resolverTransmissao,
  type TransmissaoResolvida,
} from './transmissao.ts'
