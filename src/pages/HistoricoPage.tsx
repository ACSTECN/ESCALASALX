import { useEffect, useState } from 'react';
import { History as HistoryIcon, Search, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbHistorico } from '@/lib/db';
import { toCSV, downloadFile, formatDateBR } from '@/utils';
import type { HistoricoAlteracao } from '@/types';

const acaoColor: Record<string, 'success' | 'info' | 'danger'> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
};

const entidadeLabels: Record<string, string> = {
  coletas: 'Coleta',
  agendamentos: 'Agendamento',
  metas_coletas: 'Meta',
  condutores: 'Condutor',
  hubs: 'HUB',
  cidades: 'Cidade',
  usuarios: 'Usuário',
};

export function HistoricoPage() {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEntidade, setFiltroEntidade] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');

  const loadData = async () => {
    setLoading(true);
    const { data } = await dbHistorico.list(200);
    setHistorico((data as HistoricoAlteracao[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtrado = historico.filter(
    (h) => (!filtroEntidade || h.entidade === filtroEntidade) && (!filtroAcao || h.acao === filtroAcao)
  );

  const exportarHistorico = () => {
    const linhas = filtrado.map((h) => ({
      'Data': formatDateBR(h.created_at),
      'Entidade': entidadeLabels[h.entidade] || h.entidade,
      'Ação': h.acao,
      'Descrição': h.depois ? JSON.stringify(h.depois).slice(0, 200) : (h.antes ? JSON.stringify(h.antes).slice(0, 200) : ''),
      'Usuário': h.usuario?.nome || h.usuario_id || '',
    }));
    downloadFile(toCSV(linhas), `historico_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <PageHeader
        title="Histórico de Alterações"
        description="Auditoria de todas as ações no sistema"
        actions={
          <>
            <button className="btn-secondary" onClick={exportarHistorico}>
              <Download size={16} /> Exportar
            </button>
            <button className="btn-secondary" onClick={loadData}>
              <HistoryIcon size={16} /> Atualizar
            </button>
          </>
        }
      />

      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Entidade</label>
            <select className="input" value={filtroEntidade} onChange={(e) => setFiltroEntidade(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(entidadeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ação</label>
            <select className="input" value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)}>
              <option value="">Todas</option>
              <option value="create">Criação</option>
              <option value="update">Atualização</option>
              <option value="delete">Exclusão</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-secondary w-full" onClick={() => { setFiltroEntidade(''); setFiltroAcao(''); }}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : filtrado.length === 0 ? (
          <EmptyState icon={<Search size={32} />} title="Nenhum registro" description="Nenhuma alteração encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3">Data/Hora</th>
                  <th className="text-left px-5 py-3">Entidade</th>
                  <th className="text-left px-5 py-3">Ação</th>
                  <th className="text-left px-5 py-3">Usuário</th>
                  <th className="text-left px-5 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrado.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="gray">{entidadeLabels[h.entidade] || h.entidade}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={acaoColor[h.acao] || 'gray'}>{h.acao}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{h.usuario?.nome || 'Sistema'}</td>
                    <td className="px-5 py-3">
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer text-brand-600 hover:underline">Ver detalhes</summary>
                        {h.depois && (
                          <pre className="mt-2 bg-slate-50 p-2 rounded overflow-x-auto max-w-md">
                            {JSON.stringify(h.depois, null, 2).slice(0, 800)}
                          </pre>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
