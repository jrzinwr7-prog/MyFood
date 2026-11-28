import React from 'react';
import { Loader2, Inbox } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'ghost'|'outline'|'dark'|'danger'|'mint'; size?: 'sm'|'md'|'lg'; loading?: boolean }) {
  const variants = {
    primary: 'bg-coral text-white hover:bg-[#982f18] shadow-lg shadow-coral/20',
    ghost: 'bg-transparent text-ink hover:bg-black/5',
    outline: 'border border-line bg-white text-ink hover:border-ink/30',
    dark: 'bg-ink text-white hover:bg-navy',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    mint: 'bg-mint text-white hover:bg-emerald-600',
  };
  const sizes = { sm: 'h-9 px-3 text-xs', md: 'h-11 px-5 text-sm', lg: 'h-13 px-6 text-base py-3.5' };
  return <button {...props} disabled={loading || props.disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
    {loading && <Loader2 size={16} className="animate-spin" />}{children}
  </button>;
}
export function Input({ label, hint, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return <label className="block w-full">
    {label && <span className="mb-1.5 block text-xs font-bold text-ink/70">{label}</span>}
    <input {...props} className={`w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-4 focus:ring-coral/10 ${className}`} />
    {hint && <span className="mt-1 block text-[11px] text-ink/50">{hint}</span>}
  </label>;
}
export function Textarea({ label, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return <label className="block w-full">
    {label && <span className="mb-1.5 block text-xs font-bold text-ink/70">{label}</span>}
    <textarea {...props} className={`w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-coral focus:ring-4 focus:ring-coral/10 ${className}`} />
  </label>;
}
export function Select({ label, className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return <label className="block w-full">
    {label && <span className="mb-1.5 block text-xs font-bold text-ink/70">{label}</span>}
    <select {...props} className={`w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-coral ${className}`}>{children}</select>
  </label>;
}
export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`rounded-3xl border border-line/80 bg-white shadow-card ${className}`}>{children}</div>;
}
export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral'|'green'|'red'|'orange'|'blue' }) {
  const tones = { neutral: 'bg-mist text-ink/70', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-700', blue: 'bg-orange-50 text-orange-800' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}
export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-sm text-ink/50"><Loader2 className="animate-spin text-coral" size={26} />{label}</div>;
}
export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral/10 text-coral">{icon ?? <Inbox size={26} />}</div>
    <h3 className="text-base font-extrabold">{title}</h3><p className="mt-1 max-w-sm text-sm text-ink/55">{text}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float animate-fadeUp sm:rounded-3xl sm:p-7 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-mist text-lg font-bold text-ink/60 hover:bg-line">×</button>
      </div>{children}
    </div>
  </div>;
}
export function StatCard({ label, value, hint, icon, tone = 'coral' }: { label: string; value: string; hint?: string; icon?: React.ReactNode; tone?: string }) {
  const bg: any = { coral: 'bg-coral/10 text-coral', mint: 'bg-emerald-50 text-emerald-600', blue: 'bg-orange-50 text-orange-800', ink: 'bg-ink/5 text-ink' };
  return <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold text-ink/50">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>{hint && <p className="mt-1 text-[11px] text-ink/45">{hint}</p>}</div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${bg[tone]}`}>{icon}</div>
    </div>
  </Card>;
}
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3">
    <div><h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>}</div>{action}
  </div>;
}
export const STATUS_TONE: Record<string, any> = {
  placed: 'orange', awaiting_confirmation: 'orange', accepted: 'blue', preparing: 'blue', awaiting_courier: 'orange',
  courier_to_store: 'blue', picked_up: 'blue', on_the_way: 'blue', delivered: 'green', cancelled: 'red', failed: 'red',
  pending: 'orange', approved: 'green', rejected: 'red', suspended: 'red', active: 'green', paid: 'green',
};
