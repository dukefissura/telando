export { apelidoAleatorio } from './apelidos.ts'
export {
  criarClienteApi,
  ErroApi,
  type EstadoLink,
  estadoLinkSchema,
  mensagemDoErro,
  type SessaoCriada,
} from './api.ts'
export {
  ALFABETO_ID_SESSAO,
  type Destino,
  destinoDoLink,
  SLUG_LINK_FIXO,
  TAMANHO_ID_SESSAO,
} from './destino-link.ts'
export {
  type AmostraEnvio,
  type AmostraRecebimento,
  type EstatisticasEnvio,
  type Recebimento,
  resumirEnvio,
  resumirRecebimento,
} from './estatisticas.ts'
export {
  lerConfigSalva,
  paraGravar,
  presetQueCabe,
  uploadNecessarioKbps,
} from './preferencias.ts'
export {
  type AvisoRevezamento,
  codificarAviso,
  lerAviso,
  TOPICO,
} from './protocolo.ts'
export { lerSessaoMetadata, type SessaoMetadata } from './sessao.ts'
export {
  alturaPedida,
  aplicarPreset,
  type CamadaSimulcast,
  type Codec,
  type ConfigMicrofone,
  type ConfigTransmissao,
  configPadrao,
  constraintsDoAudioSistema,
  type Dimensoes,
  FPS_DA_CAPTURA,
  type Fps,
  formatarMbps,
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
