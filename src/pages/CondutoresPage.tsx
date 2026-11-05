import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, Upload, FileText, CheckSquare, Square, X, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbCondutores, dbCidades, dbHubs, dbRotasFixas } from '@/lib/db';
import { toCSV, downloadFile } from '@/utils';
import type { Condutor, Cidade, Hub, RotaFixa } from '@/types';
import { useAuthStore } from '@/store/auth';
import { canWrite } from '@/store/auth';

export function CondutoresPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = canWrite(user?.perfil);

  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [rotas, setRotas] = useState<RotaFixa[]>([]);
  const [search, setSearch] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroHub, setFiltroHub] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Condutor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    codigo: '',
    nome_completo: '',
    cpf: '',
    telefone: '',
    cidade_id: '',
    hub_id: '',
    rota_fixa_id: '',
    status: 'ativo',
    observacoes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Condutor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Importação em lote
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importCidade, setImportCidade] = useState('');
  const [importHub, setImportHub] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    imported: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const [importMapping, setImportMapping] = useState({
    nome: '',
    codigo: '',
    cpf: '',
    telefone: '',
    cliente: '',
    tipo: '',
    consulta: '',
    ativo: '',
    situacaoCadastro: '',
  });

  const loadData = async () => {
    setLoading(true);
    const [c, cid, h, r] = await Promise.all([
      dbCondutores.list(search),
      dbCidades.listAtivas(),
      dbHubs.listAtivos(),
      dbRotasFixas.listAtivas(),
    ]);
    setCondutores((c.data as Condutor[]) || []);
    setCidades((cid.data as Cidade[]) || []);
    setHubs((h.data as Hub[]) || []);
    setRotas((r.data as RotaFixa[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const hubsFiltro = filtroCidade ? hubs.filter((h) => h.cidade_id === filtroCidade) : hubs;

  const condutoresFiltrados = useMemo(() => {
    return condutores.filter((c) => {
      if (filtroCidade && c.cidade_id !== filtroCidade) return false;
      if (filtroHub && c.hub_id !== filtroHub) return false;
      if (filtroStatus && c.status !== filtroStatus) return false;
      return true;
    });
  }, [condutores, filtroCidade, filtroHub, filtroStatus]);

  const exportarCondutores = () => {
    const cidadeMap = new Map(cidades.map((c) => [c.id, c.nome]));
    const hubMap = new Map(hubs.map((h) => [h.id, h.sigla]));
    const rotaMap = new Map(rotas.map((r) => [r.id, r.sigla]));
    const linhas = condutoresFiltrados.map((c) => ({
      'ID': c.codigo || '',
      'Nome': c.nome_completo,
      'Rota': c.rota_fixa?.sigla || rotaMap.get(c.rota_fixa_id || '') || '',
      'CPF': c.cpf || '',
      'Telefone': c.telefone || '',
      'Cidade': cidadeMap.get(c.cidade_id || '') || '',
      'HUB': hubMap.get(c.hub_id || '') || '',
      'Status': c.status,
      'Observações': c.observacoes || '',
    }));
    downloadFile(toCSV(linhas), `condutores_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const openModal = (cd?: Condutor) => {
    setEditing(cd || null);
    setSaveError('');
    setForm(
      cd
        ? {
            codigo: cd.codigo || '',
            nome_completo: cd.nome_completo,
            cpf: cd.cpf || '',
            telefone: cd.telefone || '',
            cidade_id: cd.cidade_id || '',
            hub_id: cd.hub_id || '',
            rota_fixa_id: cd.rota_fixa_id || '',
            status: cd.status,
            observacoes: cd.observacoes || '',
          }
        : { codigo: '', nome_completo: '', cpf: '', telefone: '', cidade_id: '', hub_id: '', rota_fixa_id: '', status: 'ativo', observacoes: '' }
    );
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.nome_completo.trim()) {
      setSaveError('Informe o nome completo.');
      return;
    }

    setSaving(true);
    setSaveError('');
    const payload = {
      nome_completo: form.nome_completo.trim(),
      cpf: form.cpf.replace(/\D/g, '').slice(0, 11) || null,
      telefone: form.telefone.trim() || null,
      cidade_id: form.cidade_id || null,
      hub_id: form.hub_id || null,
      codigo: form.codigo.trim() || null,
      rota_fixa_id: form.rota_fixa_id || null,
      status: form.status,
      observacoes: form.observacoes.trim() || null,
    };
    const { error } = editing
      ? await dbCondutores.update(editing.id, payload)
      : await dbCondutores.create(payload);

    setSaving(false);

    if (error) {
      setSaveError(error.message || 'Não foi possível salvar o condutor.');
      return;
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await dbCondutores.remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadData();
  };

  const toggleSelect = (id: string, index?: number, shiftKey = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && lastSelectedIndex !== null && index !== undefined) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          next.add(condutoresFiltrados[i].id);
        }
        return next;
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  };

  const selectAll = () => {
    if (condutoresFiltrados.length > 0 && condutoresFiltrados.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(condutoresFiltrados.map((c) => c.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await dbCondutores.remove(id);
    }
    setDeleting(false);
    setConfirmDeleteAll(false);
    exitSelectionMode();
    loadData();
  };

  const normalizarNome = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const nomePrimeiroSegundo = (value: string) =>
    normalizarNome(value)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');

  const parseDelimitedLine = (line: string, delimiter: string) => {
    if (delimiter === '\t') return line.split('\t').map((part) => part.trim());

    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());
    return result;
  };

  const parseImportSource = (text: string) => {
    const linhas = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
    if (linhas.length === 0) {
      return {
        rows: [] as string[][],
        dataRows: [] as string[][],
        headers: [] as string[],
        hasHeader: false,
        autoMapping: {
          nome: '',
          codigo: '',
          cpf: '',
          telefone: '',
          cliente: '',
          tipo: '',
          consulta: '',
          ativo: '',
          situacaoCadastro: '',
        },
      };
    }

    const sampleLine = linhas.find((linha) => linha.trim()) || '';
    const delimiter = sampleLine.includes('\t') ? '\t' : sampleLine.includes(';') ? ';' : ',';
    const rows = linhas.map((linha) => parseDelimitedLine(linha, delimiter));
    const normalizarCabecalho = (s: string) => normalizarNome(s).replace(/[^a-z0-9 ]/g, '');
    const aliases: Record<string, string[]> = {
      nome: ['nome'],
      codigo: ['id', 'codigo', 'código'],
      cpf: ['cpf'],
      telefone: ['telefone', 'fone'],
      cliente: ['cliente'],
      tipo: ['tipo'],
      consulta: ['consulta'],
      ativo: ['ativo', 'status'],
      situacaoCadastro: ['situacao cadastro', 'situacao cadastr'],
    };

    const firstRow = rows[0] || [];
    const normalizedHeaders = firstRow.map((value) => normalizarCabecalho(value));
    const hasHeader = normalizedHeaders.some((header) =>
      Object.values(aliases).some((group) => group.some((alias) => header.includes(alias)))
    );
    const findHeaderIndex = (accepted: string[]) =>
      normalizedHeaders.findIndex((header) => accepted.some((alias) => header.includes(alias)));

    const defaultExcelMapping = rows[0]?.length >= 8
      ? {
          nome: '1',
          codigo: '0',
          cpf: '2',
          telefone: rows[0]?.length > 3 ? '3' : '',
          cliente: '1',
          tipo: rows[0]?.length > 7 ? '7' : '',
          consulta: rows[0]?.length > 8 ? '8' : '',
          ativo: rows[0]?.length > 10 ? '10' : rows[0]?.length > 9 ? '9' : '',
          situacaoCadastro: rows[0]?.length > 12 ? '12' : '',
        }
      : {
          nome: '0',
          codigo: rows[0]?.length > 1 ? '1' : '',
          cpf: rows[0]?.length > 2 ? '2' : rows[0]?.length > 1 ? '1' : '',
          telefone: rows[0]?.length > 3 ? '3' : rows[0]?.length > 2 ? '2' : '',
          cliente: '',
          tipo: '',
          consulta: '',
          ativo: '',
          situacaoCadastro: '',
        };

    const autoMapping = hasHeader
      ? {
          nome: String(findHeaderIndex(aliases.nome)),
          codigo: String(findHeaderIndex(aliases.codigo)),
          cpf: String(findHeaderIndex(aliases.cpf)),
          telefone: String(findHeaderIndex(aliases.telefone)),
          cliente: String(findHeaderIndex(aliases.cliente)),
          tipo: String(findHeaderIndex(aliases.tipo)),
          consulta: String(findHeaderIndex(aliases.consulta)),
          ativo: String(findHeaderIndex(aliases.ativo)),
          situacaoCadastro: String(findHeaderIndex(aliases.situacaoCadastro)),
        }
      : defaultExcelMapping;

    return {
      rows,
      dataRows: hasHeader ? rows.slice(1) : rows,
      headers: hasHeader
        ? firstRow
        : (rows[0] || []).map((_, index) => `Coluna ${String.fromCharCode(65 + index)}`),
      hasHeader,
      autoMapping: Object.fromEntries(
        Object.entries(autoMapping).map(([key, value]) => [key, value === '-1' ? '' : value])
      ) as typeof importMapping,
    };
  };

  const importPreview = useMemo(() => parseImportSource(importText), [importText]);

  useEffect(() => {
    setImportMapping(importPreview.autoMapping);
    setImportResult(null);
  }, [importPreview.autoMapping]);

  const parseImportText = () => {
    const linhas = importPreview.dataRows;
    const registros: Array<{
      nome: string;
      codigo: string;
      cpf: string;
      telefone: string;
      status: string;
      observacoes: string;
    }> = [];
    const errors: string[] = [];
    const soDigitos = (s: string) => s.replace(/\D/g, '');
    const limparTelefone = (s: string) => {
      const digits = soDigitos(s);
      return digits.length === 10 || digits.length === 11 ? digits : '';
    };

    const getByMap = (row: string[], key: keyof typeof importMapping) => {
      const value = importMapping[key];
      if (value === '') return '';
      const index = Number(value);
      return Number.isNaN(index) ? '' : row[index] || '';
    };

    linhas.forEach((partes, index) => {
      const linhaAtual = index + 1;

      let nome = '';
      let codigo = '';
      let cpf = '';
      let telefone = '';
      let status = 'ativo';
      let observacoes = '';

      nome = getByMap(partes, 'nome') || partes[0] || '';
      codigo = (getByMap(partes, 'codigo') || '').trim();
      cpf = soDigitos(getByMap(partes, 'cpf'));
      telefone = limparTelefone(getByMap(partes, 'telefone'));
      status = /inativo/i.test(getByMap(partes, 'ativo')) ? 'inativo' : 'ativo';

      const observacoesParts = [
        getByMap(partes, 'cliente') ? `Cliente: ${getByMap(partes, 'cliente')}` : '',
        getByMap(partes, 'tipo') ? `Tipo: ${getByMap(partes, 'tipo')}` : '',
        getByMap(partes, 'consulta') ? `Consulta: ${getByMap(partes, 'consulta')}` : '',
        getByMap(partes, 'situacaoCadastro') ? `Situação cadastro: ${getByMap(partes, 'situacaoCadastro')}` : '',
      ].filter(Boolean);
      observacoes = observacoesParts.join(' | ');

      nome = nome.trim();
      // Excel costuma remover o zero à esquerda do CPF; recompleta quando ficar com 10 dígitos.
      if (cpf.length === 10) cpf = cpf.padStart(11, '0');
      cpf = cpf.length === 11 ? cpf : '';

      if (!nome) {
        errors.push(`Linha ${linhaAtual}: nome não identificado.`);
        return;
      }

      registros.push({
        nome,
        codigo,
        cpf,
        telefone,
        status,
        observacoes,
      });
    });

    return { total: importPreview.rows.length, registros, errors };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setImportResult(null);

    const parsed = parseImportText();
    if (parsed.registros.length === 0) {
      setImportResult({
        total: parsed.total,
        imported: 0,
        updated: 0,
        errors: parsed.errors.length > 0
          ? parsed.errors
          : ['Nenhum registro válido encontrado. Você pode colar a planilha inteira do Excel.'],
      });
      setImporting(false);
      return;
    }

    const { data: existentesData } = await dbCondutores.list();
    const existentes = (existentesData as Condutor[]) || [];
    const existentesMap = new Map<string, Condutor>();
    const existentesPorCodigo = new Map<string, Condutor>();
    const existentesPorNome = new Map<string, Condutor>();
    const existentesPorCpf = new Map<string, Condutor>();
    const existentesPorNomeCurto = new Map<string, Condutor[]>();

    const registrarCondutor = (cd: Condutor) => {
      const nomeNormalizado = normalizarNome(cd.nome_completo || '');
      const codigoNormalizado = (cd.codigo || '').trim().toLowerCase();
      const cpfNormalizado = (cd.cpf || '').replace(/\D/g, '');
      const nomeCurto = nomePrimeiroSegundo(cd.nome_completo || '');

      existentesMap.set(`${nomeNormalizado}::${cpfNormalizado}`, cd);
      if (codigoNormalizado) existentesPorCodigo.set(codigoNormalizado, cd);
      if (nomeNormalizado) existentesPorNome.set(nomeNormalizado, cd);
      if (cpfNormalizado) existentesPorCpf.set(cpfNormalizado, cd);
      if (nomeCurto) {
        const lista = existentesPorNomeCurto.get(nomeCurto) || [];
        if (!lista.some((item) => item.id === cd.id)) {
          lista.push(cd);
          existentesPorNomeCurto.set(nomeCurto, lista);
        }
      }
    };

    existentes.forEach(registrarCondutor);

    let imported = 0;
    let updated = 0;
    const errors = [...parsed.errors];

    for (const item of parsed.registros) {
      const key = `${normalizarNome(item.nome)}::${item.cpf}`;
      const nomeNormalizado = normalizarNome(item.nome);
      const codigoNormalizado = (item.codigo || '').trim().toLowerCase();
      const nomeCurto = nomePrimeiroSegundo(item.nome);

      let existente = existentesMap.get(key);

      if (!existente && codigoNormalizado) {
        existente = existentesPorCodigo.get(codigoNormalizado);
      }

      if (!existente && item.cpf) {
        existente = existentesPorCpf.get(item.cpf);
      }

      if (!existente) {
        existente = existentesPorNome.get(nomeNormalizado);
      }

      if (!existente && nomeCurto) {
        const candidatos = (existentesPorNomeCurto.get(nomeCurto) || []).filter(Boolean);
        if (candidatos.length === 1) {
          existente = candidatos[0];
        } else if (candidatos.length > 1) {
          errors.push(`${item.nome}: duplicidade potencial por primeiro e segundo nome. Revise manualmente.`);
          continue;
        }
      }

      if (existente) {
        const updateData: Partial<Condutor> = {};

        if (item.codigo && !existente.codigo) updateData.codigo = item.codigo;
        if (item.cpf && !existente.cpf) updateData.cpf = item.cpf;
        if (item.telefone && !existente.telefone) updateData.telefone = item.telefone;
        if (importCidade && !existente.cidade_id) updateData.cidade_id = importCidade;
        if (importHub && !existente.hub_id) updateData.hub_id = importHub;
        if (item.observacoes && !existente.observacoes) updateData.observacoes = item.observacoes;
        if (existente.status !== item.status) updateData.status = item.status;

        if (Object.keys(updateData).length > 0) {
          const { data: atualizado, error } = await dbCondutores.update(existente.id, updateData);
          if (error) {
            errors.push(`${item.nome}: ${error.message}`);
            continue;
          }
          registrarCondutor({ ...existente, ...(atualizado as Condutor), ...updateData });
          updated++;
        }
        continue;
      }

      const { data: criado, error } = await dbCondutores.create({
          codigo: item.codigo || null,
        nome_completo: item.nome,
        cpf: item.cpf || null,
        telefone: item.telefone || null,
        cidade_id: importCidade || null,
        hub_id: importHub || null,
        status: item.status || 'ativo',
        observacoes: item.observacoes || null,
      });

      if (error) {
        errors.push(`${item.nome}: ${error.message}`);
        continue;
      }

      if (criado) {
        registrarCondutor(criado as Condutor);
        imported++;
      }
    }

    setImportResult({
      total: parsed.total,
      imported,
      updated,
      errors,
    });
    setImportText('');
    loadData();
    setImporting(false);
  };

  const hubsByCidade = form.cidade_id ? hubs.filter((h) => h.cidade_id === form.cidade_id) : hubs;
  const hubsImportByCidade = importCidade ? hubs.filter((h) => h.cidade_id === importCidade) : hubs;

  return (
    <div>
      <PageHeader
        title="Condutores"
        description="Cadastro e gestão de condutores"
        actions={
          <>
            <button className="btn-secondary" onClick={exportarCondutores}>
              <Download size={16} /> Exportar
            </button>
            {canEdit && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
                >
                  {selectionMode ? <X size={16} /> : <CheckSquare size={16} />}
                  {selectionMode ? 'Cancelar' : 'Selecionar'}
                </button>
                <button className="btn-secondary" onClick={() => setImportOpen(true)}>
                  <Upload size={16} /> Importar base
                </button>
                <button className="btn-primary" onClick={() => openModal()}>
                  <Plus size={16} /> Novo Condutor
                </button>
              </>
            )}
          </>
        }
      />

      {/* Busca + Filtros */}
      <div className="card p-4 mb-5">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="input pl-10"
            placeholder="Buscar por ID, nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Cidade</label>
            <select
              className="input"
              value={filtroCidade}
              onChange={(e) => { setFiltroCidade(e.target.value); setFiltroHub(''); }}
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">HUB</label>
            <select
              className="input"
              value={filtroHub}
              onChange={(e) => setFiltroHub(e.target.value)}
            >
              <option value="">Todos os HUBs</option>
              {hubsFiltro.map((h) => <option key={h.id} value={h.id}>{h.sigla}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
        {(filtroCidade || filtroHub || filtroStatus) && (
          <button
            className="text-xs text-blue-600 hover:underline mt-2"
            onClick={() => { setFiltroCidade(''); setFiltroHub(''); setFiltroStatus(''); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : condutoresFiltrados.length === 0 ? (
          <EmptyState title="Nenhum condutor" description="Cadastre o primeiro condutor" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  {selectionMode && (
                    <th className="px-3 py-3 w-10">
                      <button onClick={selectAll} title="Selecionar todos">
                        {condutoresFiltrados.length > 0 && condutoresFiltrados.every((c) => selectedIds.has(c.id)) ? (
                          <CheckSquare size={18} className="text-brand-600" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-5 py-3">ID</th>
                  <th className="text-left px-5 py-3">Condutor</th>
                  <th className="text-left px-5 py-3">CPF</th>
                  <th className="text-left px-5 py-3">Telefone</th>
                  <th className="text-left px-5 py-3">Cidade</th>
                  <th className="text-left px-5 py-3">HUB</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {condutoresFiltrados.map((cd, index) => (
                  <tr
                    key={cd.id}
                    className={`hover:bg-slate-50 ${selectedIds.has(cd.id) ? 'bg-blue-50' : ''} ${selectionMode ? 'cursor-pointer' : ''}`}
                    onClick={selectionMode ? (e) => toggleSelect(cd.id, index, e.shiftKey) : undefined}
                  >
                    {selectionMode && (
                      <td className="px-3 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(cd.id, index, e.shiftKey);
                          }}
                        >
                          {selectedIds.has(cd.id) ? (
                            <CheckSquare size={18} className="text-brand-600" />
                          ) : (
                            <Square size={18} className="text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{cd.codigo || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-sm">
                          {cd.nome_completo.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 flex items-center gap-2">
                            {cd.nome_completo}
                            {cd.rota_fixa?.sigla && (
                              <span className="badge bg-cyan-100 text-cyan-800" title="Rota fixa">
                                {cd.rota_fixa.sigla}
                              </span>
                            )}
                            {cd.is_demo && <Badge variant="warning">DEMO</Badge>}
                          </div>
                          {cd.observacoes && <div className="text-xs text-slate-500">{cd.observacoes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">{cd.cpf ? cd.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
                    <td className="px-5 py-3 text-slate-600 flex items-center gap-1">
                      <Phone size={13} /> {cd.telefone || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{cd.cidade?.nome || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{cd.hub?.sigla || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge variant={cd.status === 'ativo' ? 'success' : 'gray'}>{cd.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button className="btn-ghost p-1.5" onClick={(e) => { e.stopPropagation(); openModal(cd); }}>
                              <Pencil size={16} />
                            </button>
                            <button className="btn-ghost p-1.5 text-red-500" onClick={(e) => { e.stopPropagation(); setDeleteTarget(cd); }}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Condutor' : 'Novo Condutor'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nome completo</label>
            <input
              className="input"
              value={form.nome_completo}
              onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
              placeholder="Nome do condutor"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">ID</label>
              <input
                className="input"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="ID do condutor"
              />
            </div>
            <div>
              <label className="label">CPF</label>
              <input
                className="input"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cidade</label>
              <select
                className="input"
                value={form.cidade_id}
                onChange={(e) => setForm({ ...form, cidade_id: e.target.value, hub_id: '' })}
              >
                <option value="">Selecione...</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">HUB principal</label>
              <select
                className="input"
                value={form.hub_id}
                onChange={(e) => setForm({ ...form, hub_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {hubsByCidade.map((h) => (
                  <option key={h.id} value={h.id}>{h.sigla}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="label">Rota fixa</label>
              <select
                className="input"
                value={form.rota_fixa_id}
                onChange={(e) => setForm({ ...form, rota_fixa_id: e.target.value })}
              >
                <option value="">Sem rota fixa</option>
                {rotas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sigla}{r.nome ? ` — ${r.nome}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações..."
            />
          </div>
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Importação em Lote */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportResult(null); setImportText(''); }} title="Importar base de entregadores" size="lg">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Como usar:</p>
            <p>Você pode colar <strong>a planilha inteira do Excel</strong> aqui. O sistema tenta identificar as colunas automaticamente, mas você também pode ajustar abaixo antes de importar.</p>
            <p className="mt-1">Se não vier planilha completa, também aceita linhas simples com <strong>Nome, ID, CPF e Telefone</strong>. Só o nome é obrigatório.</p>
            <p className="mt-1">Duplicidade é verificada por <strong>CPF</strong>, <strong>nome completo</strong> e também por <strong>primeiro + segundo nome</strong>.</p>
            <p className="mt-1 text-xs text-blue-600">Exemplo: João da Silva, 99, 123.456.789-00, (11) 91234-5678</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cidade (opcional)</label>
              <select className="input" value={importCidade} onChange={(e) => { setImportCidade(e.target.value); setImportHub(''); }}>
                <option value="">Todas</option>
                {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">HUB (opcional)</label>
              <select className="input" value={importHub} onChange={(e) => setImportHub(e.target.value)}>
                <option value="">Todos</option>
                {hubsImportByCidade.map((h) => <option key={h.id} value={h.id}>{h.sigla}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Lista de condutores</label>
              <label className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline">
                <FileText size={14} />
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                Subir arquivo (.csv ou .txt)
              </label>
            </div>
            <textarea
              className="input font-mono text-xs"
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Nome\tID\tCPF\tTelefone\nJOAO DA SILVA\t99\t12345678900\t(11)90000-0000`}
            />
          </div>

          {importPreview.headers.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Mapeamento das colunas</p>
                <p className="text-xs text-slate-500">
                  Se a leitura automática vier errada, escolha manualmente as colunas antes de importar.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['nome', 'Nome'],
                  ['codigo', 'ID'],
                  ['cpf', 'CPF'],
                  ['telefone', 'Telefone/Celular'],
                  ['cliente', 'Cliente'],
                  ['tipo', 'Tipo'],
                  ['consulta', 'Consulta'],
                  ['ativo', 'Ativo'],
                  ['situacaoCadastro', 'Situação Cadastro'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <select
                      className="input"
                      value={importMapping[key as keyof typeof importMapping]}
                      onChange={(e) =>
                        setImportMapping((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    >
                      <option value="">Ignorar</option>
                      {importPreview.headers.map((header, index) => (
                        <option key={`${key}-${index}`} value={String(index)}>
                          {header || `Coluna ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult && (
            <div className={`p-3 rounded-lg text-sm ${(importResult.imported > 0 || importResult.updated > 0) ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {(importResult.imported > 0 || importResult.updated > 0) ? (
                <div className="space-y-1">
                  <p>✅ {importResult.imported} condutor(es) novo(s) importado(s)</p>
                  <p>🔄 {importResult.updated} condutor(es) já existentes atualizado(s)</p>
                  <p className="text-xs">Total lido: {importResult.total}</p>
                </div>
              ) : null}
              {importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {importResult.errors.map((e, i) => <p key={i}>❌ {e}</p>)}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => { setImportOpen(false); setImportResult(null); setImportText(''); }}>
              {importResult && (importResult.imported > 0 || importResult.updated > 0) ? 'Fechar' : 'Cancelar'}
            </button>
            {(!importResult || (importResult.imported === 0 && importResult.updated === 0)) && (
              <button className="btn-primary" onClick={handleImport} disabled={!importText.trim() || importing}>
                {importing ? 'Importando...' : 'Importar'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir condutor"
        message={`Cuidado: deseja excluir ${deleteTarget?.nome_completo}? Essa exclusão é manual e definitiva.`}
        confirmLabel="Excluir"
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={deleteSelected}
        title="Excluir condutores"
        message={`Cuidado: deseja excluir ${selectedIds.size} condutor(es) selecionado(s)? Essa exclusão é manual e definitiva.`}
        confirmLabel="Excluir todos"
        loading={deleting}
      />

      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 px-5 py-3 flex items-center gap-4">
          <button
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-600"
            onClick={selectAll}
          >
            {condutoresFiltrados.length > 0 && condutoresFiltrados.every((c) => selectedIds.has(c.id)) ? (
              <CheckSquare size={18} className="text-brand-600" />
            ) : (
              <Square size={18} />
            )}
            Selecionar todos
          </button>
          <button
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </button>
          <span className="text-sm text-slate-500">
            {selectedIds.size} condutor(es) selecionado(s)
          </span>
          <span className="text-xs text-slate-400 hidden md:inline">
            Dica: clique nas linhas ou use Shift para selecionar um intervalo.
          </span>
          <button
            className="btn-danger flex items-center gap-1 disabled:opacity-50"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={selectedIds.size === 0}
          >
            <Trash2 size={16} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
