import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api, setToken } from '../../lib/api';
import { Button, Card, Input } from '../../components/ui';

export default function AdminLogin() {
  const nav = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api.post('/auth/login', { email, password }, );
      if (r.user.role !== 'admin') throw new Error('Credenciais sem privilégio administrativo');
      setToken(r.token); nav('/admin');
    } catch (err: any) { setError(err.message); setBusy(false); }
  }
  return <div className="grid min-h-screen place-items-center bg-ink p-4">
    <div className="w-full max-w-md"><div className="mb-6 text-center text-white"><ShieldCheck size={38} className="mx-auto text-coral" /><h1 className="mt-3 text-2xl font-black">Acesso administrativo</h1><p className="mt-1 text-xs text-white/60">Área restrita ao proprietário da plataforma.</p></div>
      <Card className="p-7"><form onSubmit={submit} className="space-y-3">
        <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>Entrar na administração</Button>
      </form></Card>
      <p className="mt-4 text-center text-[11px] text-white/40">Nenhum cadastro comum recebe privilégios administrativos.</p>
    </div>
  </div>;
}
