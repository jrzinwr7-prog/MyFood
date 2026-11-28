import { BrowserRouter, HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import Home from './pages/Home';
import AiSupport from './pages/AiSupport';
import StorePage from './pages/StorePage';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Tracking from './pages/Tracking';
import Orders from './pages/Orders';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import { Help, Privacy, Terms } from './pages/Content';
import MerchantRegister from './pages/merchant/MerchantRegister';
import MerchantDashboard from './pages/merchant/MerchantDashboard';
import MerchantOrders from './pages/merchant/MerchantOrders';
import MerchantMenu from './pages/merchant/MerchantMenu';
import MerchantFinance from './pages/merchant/MerchantFinance';
import MerchantSettings from './pages/merchant/MerchantSettings';
import CourierRegister from './pages/courier/CourierRegister';
import CourierDashboard from './pages/courier/CourierDashboard';
import CourierOffers from './pages/courier/CourierOffers';
import CourierDeliveries from './pages/courier/CourierDeliveries';
import CourierEarnings from './pages/courier/CourierEarnings';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEstablishments from './pages/admin/AdminEstablishments';
import AdminCouriers from './pages/admin/AdminCouriers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminFinance from './pages/admin/AdminFinance';
import AdminSettings from './pages/admin/AdminSettings';
import AdminSupport from './pages/admin/AdminSupport';
import { Spinner } from './components/ui';

function RoutesView() {
  const { loadingAuth } = useApp();
  if (loadingAuth) return <div className="grid min-h-screen place-items-center"><Spinner label="Carregando MyFood…" /></div>;
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/loja/:slug" element={<StorePage />} />
    <Route path="/carrinho" element={<Cart />} />
    <Route path="/checkout" element={<Checkout />} />
    <Route path="/pedido/:id" element={<Tracking />} />
    <Route path="/pedidos" element={<Orders />} />
    <Route path="/conversas" element={<Chat />} />
    <Route path="/perfil" element={<Profile />} />
    <Route path="/entrar" element={<Auth />} />
    <Route path="/termos" element={<Terms />} />
    <Route path="/privacidade" element={<Privacy />} />
    <Route path="/ajuda" element={<Help />} />
    <Route path="/suporte-ia" element={<AiSupport />} />

    <Route path="/merchant/cadastro" element={<MerchantRegister />} />
    <Route path="/merchant" element={<MerchantDashboard />} />
    <Route path="/merchant/pedidos" element={<MerchantOrders />} />
    <Route path="/merchant/cardapio" element={<MerchantMenu />} />
    <Route path="/merchant/financeiro" element={<MerchantFinance />} />
    <Route path="/merchant/configuracoes" element={<MerchantSettings />} />

    <Route path="/courier/cadastro" element={<CourierRegister />} />
    <Route path="/courier" element={<CourierDashboard />} />
    <Route path="/courier/solicitacoes" element={<CourierOffers />} />
    <Route path="/courier/entregas" element={<CourierDeliveries />} />
    <Route path="/courier/ganhos" element={<CourierEarnings />} />

    <Route path="/admin/entrar" element={<AdminLogin />} />
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/estabelecimentos" element={<AdminEstablishments />} />
    <Route path="/admin/entregadores" element={<AdminCouriers />} />
    <Route path="/admin/usuarios" element={<AdminUsers />} />
    <Route path="/admin/pedidos" element={<AdminOrders />} />
    <Route path="/admin/financeiro" element={<AdminFinance />} />
    <Route path="/admin/configuracoes" element={<AdminSettings />} />
    <Route path="/admin/suporte" element={<AdminSupport />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
export default function App() {
  const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;
  return <Router><AppProvider>{import.meta.env.VITE_VISUAL_PREVIEW === 'true' && <div role="status" className="bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-900">Prévia visual: servidor não conectado. Cadastros, pedidos e pagamentos não estão disponíveis.</div>}<RoutesView /></AppProvider></Router>;
}
