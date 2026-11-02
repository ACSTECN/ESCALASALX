import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { dbCidades, dbHubs, dbInteresses } from '@/lib/db';
import type { Cidade, Hub } from '@/types';
import { DIAS_SEMANA } from '@/types';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { branding } from '@/lib/branding';

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskTelefone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const hoje = () => new Date().toISOString().slice(0, 10);

export function InteresseEntregadorPage() {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [fezIntegracao, setFezIntegracao] = useState<boolean | null>(null);
  const [cidadeId, setCidadeId] = useState('');
  const [hubId, setHubId] = useState('');
  const [data, setData] = useState('');
  const [confirmouDisponibilidade, setConfirmouDisponibilidade] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState<{ hub: Hub; data: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [c, h] = await Promise.all([dbCidades.listAtivas(), dbHubs.listAtivos()]);
      setCidades((c.data as Cidade[]) || []);
      setHubs((h.data as Hub[]) || []);
      setLoading(false);
    })();
  }, []);

  const hubsFiltrados = cidadeId ? hubs.filter((h) => h.cidade_id === cidadeId) : hubs;

  const salvar = async () => {
    setErro('');
    if (nome.trim().length < 3) return setErro('Informe o nome completo.');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Informe um CPF válido (11 dígitos).');
    if (fezIntegracao === null) return setErro('Informe se você já fez a primeira integração.');
    if (!hubId) return setErro('Selecione o HUB onde quer fazer coleta.');
    if (!data) return setErro('Selecione o dia de interesse.');
    if (data < hoje()) return setErro('A data não pode ser anterior a hoje.');
    if (!confirmouDisponibilidade) {
      return setErro('Confirme que só está demonstrando interesse se realmente puder comparecer.');
    }

    setSalvando(true);
    const { error } = await dbInteresses.create({
      nome: nome.trim(),
      cpf: cpf.replace(/\D/g, ''),
      telefone: telefone.trim() || null,
      fez_integracao: fezIntegracao,
      hub_id: hubId,
      data_interesse: data,
      status: 'pendente',
    });
    setSalvando(false);

    if (error) {
      if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
        setErro('Você já registrou interesse neste HUB para esta data.');
      } else {
        setErro('Não foi possível registrar o interesse. Tente novamente.');
      }
      return;
    }

    const hub = hubs.find((h) => h.id === hubId)!;
    setSucesso({ hub, data });
  };

  const novoInteresse = () => {
    setSucesso(null);
    setNome('');
    setCpf('');
    setTelefone('');
    setFezIntegracao(null);
    setCidadeId('');
    setHubId('');
    setData('');
    setConfirmouDisponibilidade(false);
    setErro('');
  };

  return (
    <div className="min-h-screen tech-surface flex items-center justify-center p-4 lg:p-8">
      <div className="grid w-full max-w-7xl items-center gap-6 lg:grid-cols-[1fr_1.05fr]">
        <section className="tech-hero relative hidden overflow-hidden rounded-[32px] border border-white/10 p-10 text-white shadow-[0_30px_90px_rgba(2,6,23,0.32)] lg:block">
          <div className="absolute inset-0 tech-grid opacity-20" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <BrandLogo light subtitle="Interesse em Coletas" />
              <h1 className="mt-10 max-w-xl text-4xl font-black leading-tight tracking-[0.08em] text-white">
                Cadastro de interesse com visual mais premium e leitura direta.
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-300">
                O entregador registra disponibilidade, integração e HUB desejado em uma experiência
                mais forte de marca e mais confiável para operação.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Regra clara</div>
                <div className="mt-2 text-sm text-slate-200">
                  Interesse não garante agendamento. Primeiro entra a confirmação da operação.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Dados essenciais</div>
                <div className="mt-2 text-sm text-slate-200">
                  Nome, CPF, integração, HUB e data prontos para lista de espera e contato rápido.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo light subtitle="Interesse em Coletas" />
          </div>

          <div className="tech-panel overflow-hidden">
          {sucesso ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-emerald-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Interesse registrado!</h2>
              <p className="text-sm text-slate-500 mt-2">
                Você demonstrou interesse em fazer coleta em:
              </p>
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin size={16} className="text-brand-600" />
                  <span className="font-semibold">{sucesso.hub.sigla}</span>
                  <span className="text-slate-500">{sucesso.hub.nome}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CalendarDays size={16} className="text-brand-600" />
                  <span>
                    {new Date(sucesso.data + 'T00:00:00').toLocaleDateString('pt-BR')} ·{' '}
                    {DIAS_SEMANA[new Date(sucesso.data + 'T00:00:00').getDay()]}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Isso não garante seu agendamento na data interessada. Entraremos em contato para
                fazer uma breve confirmação antes de agendar.
              </p>
              <button className="btn-primary w-full mt-6" onClick={novoInteresse}>
                Registrar outro interesse
              </button>
            </div>
          ) : (
            <>
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h1 className="text-lg font-bold text-slate-900">Quero fazer coleta</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Preencha seus dados e escolha o HUB e o dia em que você tem interesse em trabalhar.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="label">Nome completo *</label>
                  <input
                    className="input"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">CPF *</label>
                    <input
                      className="input"
                      value={cpf}
                      onChange={(e) => setCpf(maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input
                      className="input"
                      value={telefone}
                      onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Já fez a primeira integração? *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFezIntegracao(true)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        fezIntegracao === true
                          ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                          : 'border-slate-200 text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      Sim, já fiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setFezIntegracao(false)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        fezIntegracao === false
                          ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                          : 'border-slate-200 text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      Não fiz ainda
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Cidade</label>
                  <select
                    className="input"
                    value={cidadeId}
                    onChange={(e) => {
                      setCidadeId(e.target.value);
                      setHubId('');
                    }}
                  >
                    <option value="">Todas as cidades</option>
                    {cidades.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">HUB onde quer fazer coleta *</label>
                  <select className="input" value={hubId} onChange={(e) => setHubId(e.target.value)} disabled={loading}>
                    <option value="">{loading ? 'Carregando...' : 'Selecione o HUB...'}</option>
                    {hubsFiltrados.map((h) => (
                      <option key={h.id} value={h.id}>{h.sigla} — {h.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Dia de interesse *</label>
                  <input
                    type="date"
                    className="input"
                    min={hoje()}
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                  {data && (
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="text-slate-500">{DIAS_SEMANA[new Date(data + 'T00:00:00').getDay()]}</span>
                    </p>
                  )}
                </div>

                {erro && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{erro}</span>
                  </div>
                )}

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                  <p className="font-medium">
                    Isso não garante seu agendamento na data interessada.
                  </p>
                  <p>
                    Entraremos em contato para fazer uma breve confirmação antes de agendar.
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={confirmouDisponibilidade}
                    onChange={(e) => setConfirmouDisponibilidade(e.target.checked)}
                  />
                  <span>
                    Confirmo que só estou dando interesse se realmente eu puder comparecer nessa data.
                  </span>
                </label>

                <button className="btn-primary w-full" onClick={salvar} disabled={salvando}>
                  {salvando ? (
                    <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  ) : (
                    'Confirmar interesse'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          {branding.footerLabel}
        </p>
        </div>
      </div>
    </div>
  );
}
