type Genero = 'm' | 'f'

const BICHOS: ReadonlyArray<readonly [string, Genero]> = [
  ['Capivara', 'f'],
  ['Onça', 'f'],
  ['Arara', 'f'],
  ['Coruja', 'f'],
  ['Preguiça', 'f'],
  ['Ariranha', 'f'],
  ['Garça', 'f'],
  ['Tucano', 'm'],
  ['Jabuti', 'm'],
  ['Mico', 'm'],
  ['Quati', 'm'],
  ['Sagui', 'm'],
  ['Tamanduá', 'm'],
  ['Boto', 'm'],
  ['Tatu', 'm'],
]

// Cores invariáveis repetem a forma; as outras têm [masculino, feminino].
const CORES: ReadonlyArray<readonly [string, string]> = [
  ['Azul', 'Azul'],
  ['Verde', 'Verde'],
  ['Laranja', 'Laranja'],
  ['Cinza', 'Cinza'],
  ['Rosa', 'Rosa'],
  ['Roxo', 'Roxa'],
  ['Vermelho', 'Vermelha'],
  ['Dourado', 'Dourada'],
  ['Prateado', 'Prateada'],
  ['Branco', 'Branca'],
  ['Preto', 'Preta'],
  ['Amarelo', 'Amarela'],
]

function sortearItem<T>(lista: ReadonlyArray<T>, sortear: () => number): T {
  const item = lista[Math.floor(sortear() * lista.length)]
  if (item === undefined) throw new RangeError('sortear() precisa devolver um valor em [0, 1)')
  return item
}

export function apelidoAleatorio(sortear: () => number = Math.random): string {
  const [bicho, genero] = sortearItem(BICHOS, sortear)
  const [masculino, feminino] = sortearItem(CORES, sortear)
  return `${bicho} ${genero === 'f' ? feminino : masculino}`
}
