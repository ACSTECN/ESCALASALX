import { useEffect, useState, useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, AlertTriangle, Users, Target, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbColetas, dbCidades, dbHubs } from '@/lib/db';
import { calcColetaStats } from '@/lib/db';
import type { Coleta, Cidade, Hub } from '@/types';
import { formatDateBR, formatTime, toCSV, downloadFile } from '@/utils';
import { STATUS_AGENDAMENTO_LABELS } from '@/types';

export function EscalaAmanhaPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroHub, setFiltroHub] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [expandedHub, setExpandedHub] = useState<string | null>(null);

  const amanha = addDays(new Date(), 1);
  const amanhaStr = format(amanha, 'yyyy-MM-dd');

  const loadData = async () => {
    setLoading(true);
    const [c, cid, h] = await Promise.all([
      dbColetas.listByDate(amanhaStr),
      dbCidades.listAtivas(),
      dbHubs.listAtivos(),
    ]);
    setColetas((c.data as Coleta[]) || []);
    setCidades((cid.data as Cidade[]) || []);
    setHubs((h.data as Hub[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const coletasFiltradas = useMemo(
    () =>
      coletas.filter((c) => {
        if (filtroCidade && c.hub?.cidade_id !== filtroCidade) return false;
        if (filtroHub && c.hub_id !== filtroHub) return false;
        if (filtroStatus) {
          const stats = calcColetaStats(c);
          if (filtroStatus === 'abaixo' && stats.agendados >= c.meta) return false;
          if (filtroStatus === 'atingido' && stats.agendados < c.meta) return false;
        }
        return c.status !== 'cancelada';
      }),
    [coletas, filtroCidade, filtroHub, filtroStatus]
  );

  const kpis = useMemo(() => {
    let totalMeta = 0;
    let totalAgendados = 0;
    let abaixoMeta = 0;
    for (const c of coletasFiltradas) {
      const stats = calcColetaStats(c);
      totalMeta += c.meta;
      totalAgendados += stats.agendados;
      if (stats.agendados < c.meta) abaixoMeta++;
    }
    const vagasRestantes = Math.max(totalMeta - totalAgendados, 0);
    const ocupacao = totalMeta > 0 ? Math.round((totalAgendados / totalMeta) * 100) : 0;
    return {
      coletas: coletasFiltradas.length,
      agendados: totalAgendados,
      vagasPrevistas: totalMeta,
      vagasRestantes,
      ocupacao,
      abaixoMeta,
    };
  }, [coletasFiltradas]);

  const hubsAbaixoMeta = useMemo(
    () =>
      coletasFiltradas
        .filter((c) => {
          const stats = calcColetaStats(c);
          return stats.agendados < c.meta;
        })
        .map((c) => c.hub?.sigla)
        .filter(Boolean) as string[],
    [coletasFiltradas]
  );

  const hubsFiltrados = filtroCidade ? hubs.filter((h) => h.cidade_id === filtroCidade) : hubs;

  const exportarCSV = () => {
    const rows = coletasFiltradas.flatMap((c) => {
      const stats = calcColetaStats(c);
      const ags = (c.agendamentos || []).filter((a) => a.status !== 'cancelado');
      if (ags.length === 0) {
        return [{
          HUB: c.hub?.sigla,
          Cidade: c.hub?.cidade?.nome,
          Data: formatDateBR(c.data_coleta),
          Horario: formatTime(c.horario),
          Meta: c.meta,
          Agendados: stats.agendados,
          Vagas: stats.vagas,
          Condutor: '',
          Status_agendamento: '',
        }];
      }
      return ags.map((a) => ({
        HUB: c.hub?.sigla,
        Cidade: c.hub?.cidade?.nome,
        Data: formatDateBR(c.data_coleta),
        Horario: formatTime(c.horario),
        Meta: c.meta,
        Agendados: stats.agendados,
        Vagas: stats.vagas,
        Condutor: a.condutor?.nome_completo,
        Status_agendamento: STATUS_AGENDAMENTO_LABELS[a.status],
      }));
    });
    downloadFile(toCSV(rows), `escala-amanha-${amanhaStr}.csv`);
  };

  const kpiCards = [
    { label: 'Coletas', value: kpis.coletas, icon: Target, color: 'text-brand-600 bg-brand-50' },
    { label: 'Agendados', value: kpis.agendados, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Vagas previstas', value: kpis.vagasPrevistas, icon: CheckCircle2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Vagas restantes', value: kpis.vagasRestantes, icon: XCircle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Ocupação', value: `${kpis.ocupacao}%`, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
    { label: 'Abaixo da meta', value: kpis.abaixoMeta, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div>
      <PageHeader
        title="Escala de Amanhã"
        description={`Programação para ${formatDateBR(amanhaStr)} (${format(amanha, 'EEEE', { locale: ptBR })})`}
        actions={
          <button className="btn-secondary" onClick={exportarCSV}>
            <Download size={16} /> Exportar CSV
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpiCards.map((k) => (
          <div key={k.label} className="card p-4">
            <div className={`w-8 h-8 rounded-lg ${k.color} flex items-center justify-center mb-2`}>
              <k.icon size={16} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* HUBs abaixo da meta */}
      {hubsAbaixoMeta.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle size={18} /> HUBs que não atingiram a meta
          </div>
          <div className="flex flex-wrap gap-2">
            {[...new Set(hubsAbaixoMeta)].map((h) => (
              <Badge key={h} variant="danger">{h}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Cidade</label>
            <select className="input" value={filtroCidade} onChange={(e) => { setFiltroCidade(e.target.value); setFiltroHub(''); }}>
              <option value="">Todas</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">HUB</label>
            <select className="input" value={filtroHub} onChange={(e) => setFiltroHub(e.target.value)}>
              <option value="">Todos</option>
              {hubsFiltrados.map((h) => <option key={h.id} value={h.id}>{h.sigla}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Situação</label>
            <select className="input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todas</option>
              <option value="abaixo">Abaixo da meta</option>
              <option value="atingido">Meta atingida</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-secondary w-full" onClick={() => { setFiltroCidade(''); setFiltroHub(''); setFiltroStatus(''); }}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Lista por HUB */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : coletasFiltradas.length === 0 ? (
        <EmptyState title="Nenhuma coleta para amanhã" description="Não há coletas programadas para esta data" />
      ) : (
        <div className="space-y-3">
          {coletasFiltradas.map((c) => {
            const stats = calcColetaStats(c);
            const isOpen = expandedHub === c.id;
            const ags = (c.agendamentos || []).filter((a) => a.status !== 'cancelado');
            return (
              <div key={c.id} className="card overflow-hidden">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 text-left"
                  onClick={() => setExpandedHub(isOpen ? null : c.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                      {c.hub?.sigla}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">
                        {c.hub?.sigla} — {c.hub?.nome}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.hub?.cidade?.nome} • {formatTime(c.horario)} • Meta {c.meta}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`font-bold ${stats.agendados >= c.meta ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {stats.agendados}/{c.meta}
                      </div>
                      <div className="text-xs text-slate-500">{stats.vagas} vagas • {stats.ocupacao}%</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${isOpen ? 'rotate-90' : ''} transition-transform`}>▶</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <div className="h-1.5 bg-slate-100 rounded-full mt-3 mb-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stats.agendados >= c.meta ? 'bg-emerald-500' : stats.ocupacao >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(stats.ocupacao, 100)}%` }}
                      />
                    </div>
                    {ags.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">Nenhum condutor agendado</p>
                    ) : (
                      <div className="space-y-1">
                        {ags.map((a) => (
                          <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-slate-700">{a.condutor?.nome_completo}</span>
                            <Badge variant={a.status === 'confirmado' ? 'success' : a.status === 'agendado' ? 'info' : 'gray'}>
                              {STATUS_AGENDAMENTO_LABELS[a.status]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
