/** Dados inteiramente fictícios, isolados da API e dos pedidos reais. */
const categories = [
  { id: 'hamburgueria', name: 'Hamburgueria', icon: 'hamburger' },
  { id: 'pizzaria', name: 'Pizzaria', icon: 'pizza' },
  { id: 'lanchonete', name: 'Lanchonete', icon: 'sandwich' },
];
const base = { neighborhood: 'Centro', city: 'Cidade Exemplo', state: 'BA', street: 'Rua Exemplo', number: '100', phone: '(00) 00000-0000', logoUrl: null, isOpen: true, ratingAvg: 0, ratingCount: 0, minOrderCents: 0, openHours: {} };
const group = (id: string, name: string, options: { id: string; name: string; priceCents: number }[], minSelected = 0, maxSelected = 2) => ({ id, name, minSelected, maxSelected, options });
export function catalogo(baseUrl: string) {
  const img = (name: string) => `${baseUrl}imagens/${name}.jpg`;
  const stores = [
    { ...base, id: 'demo-burger', slug: 'casa-do-burger', name: 'Casa do Burger', categoryId: 'hamburgueria', categoryName: 'Hamburgueria', coverUrl: img('hamburguer'), description: 'Hambúrgueres preparados na chapa, acompanhamentos e bebidas. Loja fictícia de demonstração.', deliveryFeeCents: 600, prepTimeMin: 30,
      products: [
        { id: 'burger-classico', name: 'Burger Clássico', description: 'Pão macio, hambúrguer, queijo, alface e tomate.', priceCents: 2790, imageUrl: img('hamburguer'), categoryName: 'Hambúrgueres', groups: [group('ponto', 'Ponto da carne', [{ id: 'bem', name: 'Bem passado', priceCents: 0 }, { id: 'medio', name: 'Ao ponto', priceCents: 0 }], 1, 1), group('extras', 'Adicionais', [{ id: 'bacon', name: 'Bacon', priceCents: 450 }, { id: 'queijo', name: 'Queijo extra', priceCents: 350 }])] },
        { id: 'burger-duplo', name: 'Burger Duplo', description: 'Dois hambúrgueres e queijo derretido.', priceCents: 3590, imageUrl: img('hamburguer'), categoryName: 'Hambúrgueres', groups: [] },
        { id: 'batata', name: 'Batata crocante', description: 'Porção individual de batatas.', priceCents: 1490, imageUrl: null, categoryName: 'Acompanhamentos', groups: [] },
      ] },
    { ...base, id: 'demo-pizza', slug: 'forno-da-praca', name: 'Forno da Praça', categoryId: 'pizzaria', categoryName: 'Pizzaria', coverUrl: img('pizza'), description: 'Pizzas para compartilhar. Loja fictícia de demonstração.', deliveryFeeCents: 800, prepTimeMin: 40,
      products: [
        { id: 'pizza-mussarela', name: 'Pizza de Mussarela', description: 'Molho de tomate, mussarela e orégano.', priceCents: 4290, imageUrl: img('pizza'), categoryName: 'Pizzas', groups: [group('tamanho', 'Escolha o tamanho', [{ id: 'media', name: 'Média', priceCents: 0 }, { id: 'grande', name: 'Grande', priceCents: 1200 }], 1, 1), group('borda', 'Borda', [{ id: 'catupiry', name: 'Borda cremosa', priceCents: 800 }], 0, 1)] },
        { id: 'pizza-calabresa', name: 'Pizza de Calabresa', description: 'Calabresa, cebola e queijo.', priceCents: 4590, imageUrl: img('pizza'), categoryName: 'Pizzas', groups: [] },
        { id: 'refrigerante', name: 'Refrigerante', description: 'Garrafa de 1 litro.', priceCents: 990, imageUrl: null, categoryName: 'Bebidas', groups: [] },
      ] },
    { ...base, id: 'demo-lanche', slug: 'ponto-do-lanche', name: 'Ponto do Lanche', categoryId: 'lanchonete', categoryName: 'Lanchonete', coverUrl: img('lanche'), description: 'Sanduíches e lanches rápidos. Loja fictícia de demonstração.', deliveryFeeCents: 500, prepTimeMin: 25,
      products: [
        { id: 'sanduiche-frango', name: 'Sanduíche de Frango', description: 'Pão tostado, frango, alface e tomate.', priceCents: 2190, imageUrl: img('lanche'), categoryName: 'Sanduíches', groups: [group('adicionais-lanche', 'Adicionais', [{ id: 'ovo', name: 'Ovo', priceCents: 300 }, { id: 'queijo-lanche', name: 'Queijo extra', priceCents: 350 }])] },
        { id: 'misto', name: 'Misto na Chapa', description: 'Pão tostado com queijo e presunto.', priceCents: 1390, imageUrl: img('lanche'), categoryName: 'Sanduíches', groups: [] },
        { id: 'suco', name: 'Suco de Laranja', description: 'Copo de 300 ml.', priceCents: 890, imageUrl: null, categoryName: 'Bebidas', groups: [] },
      ] },
  ];
  return stores;
}
export const demoUser = { id: 'demo-user', role: 'consumer', name: 'Visitante da demonstração', email: 'visitante@exemplo.invalid', phone: '(00) 00000-0000', status: 'active' };
const address = { id: 'demo-endereco', label: 'Endereço fictício', street: 'Rua Exemplo', number: '100', neighborhood: 'Centro', city: 'Cidade Exemplo', state: 'BA', cep: '00000-000', is_default: true };
let favorites: string[] = [];
export async function demoRequest(path: string, method: string, baseUrl: string): Promise<any> {
  const url = new URL(path, 'https://demo.invalid'); const stores = catalogo(baseUrl);
  if (method === 'GET' && url.pathname === '/catalog/categories') return { items: categories };
  if (method === 'GET' && url.pathname === '/catalog/banners') return { items: [] };
  if (method === 'GET' && url.pathname === '/catalog/public') return { appName: 'FastDelivery', features: { onlineCards: false } };
  if (method === 'GET' && url.pathname === '/addresses') return { items: [address] };
  if (method === 'GET' && url.pathname === '/orders/meta/favorites') return { items: stores.filter(s => favorites.includes(s.id)) };
  if (method === 'POST' && url.pathname.startsWith('/orders/favorites/')) {
    const id = url.pathname.split('/').pop()!;
    if (!stores.some(s => s.id === id)) throw new Error('Loja não encontrada na demonstração.');
    favorites = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    return { favorite: favorites.includes(id) };
  }
  if (method === 'GET' && url.pathname === '/catalog/establishments') {
    const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR');
    const category = url.searchParams.get('category');
    let filtered = stores.filter(s => (!category || s.categoryId === category) && (!q || [s.name, s.categoryName, ...s.products.map(p => p.name)].some(v => v.toLocaleLowerCase('pt-BR').includes(q))));
    if (url.searchParams.get('sort') === 'fee') filtered = filtered.sort((a, b) => a.deliveryFeeCents - b.deliveryFeeCents);
    return { items: filtered };
  }
  if (method === 'GET' && url.pathname.startsWith('/catalog/establishments/')) {
    const slug = decodeURIComponent(url.pathname.split('/').pop()!); const store = stores.find(s => s.slug === slug);
    if (!store) throw new Error('Loja fictícia não encontrada.');
    const { products, ...establishment } = store;
    return { establishment, products };
  }
  throw new Error('Recurso indisponível nesta demonstração. Nenhum dado foi enviado.');
}
