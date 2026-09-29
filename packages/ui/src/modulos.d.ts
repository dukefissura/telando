// Imagens importadas viram URL pelo Vite de quem usa o pacote.
declare module '*.svg' {
  const url: string
  export default url
}
