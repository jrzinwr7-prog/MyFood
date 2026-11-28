import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoRequest } from '../../../demo-temporaria/catalogo.js';
import { calculateCartTotals } from '@myfood/shared';

const base = '/MyFood/demo/';
test('demonstração fornece três lojas fictícias, produtos, filtros e endereço fictício', async () => {
  const all = await demoRequest('/catalog/establishments', 'GET', base);
  assert.equal(all.items.length, 3);
  const pizza = await demoRequest('/catalog/establishments?category=pizzaria', 'GET', base);
  assert.equal(pizza.items.length, 1);
  const d = await demoRequest(`/catalog/establishments/${pizza.items[0].slug}`, 'GET', base);
  assert.ok(d.products.length >= 2);
  assert.ok(d.products[0].imageUrl.startsWith(base));
  const address = await demoRequest('/addresses', 'GET', base);
  assert.equal(address.items[0].id, 'demo-endereco');
  const extra = d.products[0].groups[0].options[1];
  const totals = calculateCartTotals({ items: [{ key: 'a', product_id: d.products[0].id, name: d.products[0].name, unit_price_cents: d.products[0].priceCents, quantity: 2, options: [{ group_name: 'Tamanho', option_name: extra.name, price_cents: extra.priceCents }], notes: null, image_url: null }], deliveryFeeCents: d.establishment.deliveryFeeCents });
  assert.equal(totals.total_cents, (4290 + 1200) * 2 + 800);
});
test('demonstração nunca cria pedidos nem inicia pagamentos', async () => {
  await assert.rejects(() => demoRequest('/orders', 'POST', base), /indisponível/);
  await assert.rejects(() => demoRequest('/payments/orders/qualquer/initialize', 'POST', base), /indisponível/);
  await assert.rejects(() => demoRequest('/auth/login', 'POST', base), /indisponível/);
});
