import bcrypt from 'bcryptjs';
import { all, get, run } from './index.js';
import { now, uid } from '../core/utils.js';
import { config } from '../core/config.js';

const CATEGORIES = [
  ['Hambúrgueres', 'hamburgueres', 'hamburger'], ['Pizzarias', 'pizzarias', 'pizza'],
  ['Lanches', 'lanches', 'sandwich'], ['Açaí', 'acai', 'ice-cream'], ['Pastelarias', 'pastelarias', 'pastel'],
  ['Sorveterias', 'sorveterias', 'ice-cream'], ['Restaurantes', 'restaurantes', 'utensils'],
  ['Marmitas', 'marmitas', 'soup'], ['Docerias', 'docerias', 'cake'], ['Bebidas', 'bebidas', 'coffee'],
  ['Outros', 'outros', 'shopping-bag'],
];

async function main() {
  CATEGORIES.forEach(([name, slug, icon], i) => {
    if (!get('SELECT id FROM categories WHERE slug=?', slug))
      run('INSERT INTO categories (id,name,slug,icon,active,sort_order) VALUES (?,?,?,?,1,?)', uid('cat_'), name, slug, icon, i);
  });
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@myfood.local';
  if (!get('SELECT id FROM users WHERE email=?', adminEmail)) {
    const password = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
    run('INSERT INTO users (id,name,email,phone,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      uid('usr_'), 'Administrador', adminEmail, '74999999999', await bcrypt.hash(password, 12), 'admin', 'active', now());
    console.log(`Administrador criado: ${adminEmail} (senha: ${process.env.ADMIN_PASSWORD ? 'definida em ADMIN_PASSWORD' : 'Admin@12345 — altere em produção'})`);
  }
  if (process.argv.includes('--demo')) {
    console.log('Use a interface para cadastrar estabelecimentos de demonstração; dados de teste não são criados automaticamente.');
  }
  console.log(`Seed concluído. ${all('SELECT COUNT(*) n FROM categories').length ? 'Categorias prontas.' : ''}`);
}
main().catch(e => { console.error(e); process.exit(1); });
