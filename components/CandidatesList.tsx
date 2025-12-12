import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Loader2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { Candidate, Test } from '../types';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

export const CandidatesList: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    testId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Candidates and Tests
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      // 1. Fetch Tests
      const { data: testsData, error: testsError } = await supabase.from('tests').select('*').eq('active', true);
      if (testsData) {
        setTests(testsData as unknown as Test[]);
      } else if (testsError) {
        console.warn('Error fetching tests:', testsError);
      }

      // 2. Fetch Candidates
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
            *,
            tests (title)
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      if (profilesData) {
        const mappedCandidates: Candidate[] = profilesData
            .filter((p: any) => p.role !== 'admin') // Filter client-side to be safe
            .map((p: any) => ({
                id: p.id,
                name: p.name || 'Sem Nome',
                email: p.email || 'Sem Email',
                status: p.status || 'pending',
                assignedTestId: p.assigned_test_id,
                score: p.score,
                completedDate: p.completed_date
            }));
        setCandidates(mappedCandidates);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      
      const msg = error.message || (typeof error === 'object' ? JSON.stringify(error) : 'Erro desconhecido');
      
      if (msg.includes('recursion')) {
          setFetchError('Backend: Detectada recursão infinita (RLS).');
      } else {
          setFetchError(`Erro ao carregar dados: ${msg}`);
      }
      // No fallback to mock data anymore
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (candidate?: Candidate) => {
    setErrorMsg('');
    if (candidate) {
      setEditingId(candidate.id);
      setFormData({
        name: candidate.name,
        email: candidate.email,
        password: '', // Password not editable directly here for security/complexity reasons
        testId: candidate.assignedTestId || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        testId: tests.length > 0 ? tests[0].id : ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (editingId) {
        // UPDATE Existing Candidate
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            assigned_test_id: formData.testId || null
          })
          .eq('id', editingId);

        if (error) throw error;

        // Update local state
        setCandidates(candidates.map(c => 
          c.id === editingId 
            ? { ...c, name: formData.name, assignedTestId: formData.testId }
            : c
        ));

      } else {
        // CREATE New Candidate
        // CRITICAL FIX: Disable session persistence for the temp client.
        // This prevents the temp client from overwriting the Admin's session in localStorage.
        const tempSupabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        const { data, error } = await tempSupabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: 'candidate',
              assigned_test_id: formData.testId || null
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          const newCandidate: Candidate = {
              id: data.user.id,
              name: formData.name,
              email: formData.email,
              status: 'pending',
              assignedTestId: formData.testId
          };
          setCandidates([newCandidate, ...candidates]);
        } else {
           setErrorMsg('Usuário criado. Se a lista não atualizar, recarregue a página.');
        }
      }
      
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      if (error.message?.includes('User already registered')) {
        setErrorMsg('Este e-mail já está registrado no sistema de autenticação.');
      } else if (error.message?.includes('recursion')) {
        setErrorMsg('Erro de Back-end (RLS): Recursão infinita detectada.');
      } else {
        setErrorMsg(error.message || 'Erro ao salvar dados.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Candidatos</h1>
          <p className="text-gray-500 text-sm">Gerencie os candidatos e envie testes.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Novo Candidato
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou email..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Warning Banner */}
        {!loading && fetchError && (
            <div className="mx-4 mt-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg flex items-start gap-2 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-medium">Erro ao carregar</p>
                    <p className="text-xs opacity-90">{fetchError}</p>
                </div>
            </div>
        )}

        {/* Table Area */}
        {loading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
        ) : (
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-white border-b border-gray-100">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase w-1/3">Nome</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase w-1/3">Teste Atribuído</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right w-1/3">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredCandidates.length > 0 ? filteredCandidates.map((c) => {
                    const testTitle = tests.find(t => t.id === c.assignedTestId)?.title || 'Nenhum teste atribuído';
                    return (
                    <tr key={c.id} className="hover:bg-gray-50 group transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                            <span className="text-xs text-gray-400">{c.email}</span>
                          </div>
                        </td>
                        <td className="p-4">
                            <span className="text-sm text-gray-600">{testTitle}</span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => openModal(c)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" 
                              title="Editar"
                            >
                                <Pencil size={16} />
                            </button>
                          </div>
                        </td>
                    </tr>
                    );
                }) : (
                  <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-400 text-sm">
                        {fetchError ? 'Falha ao carregar candidatos.' : 'Nenhum candidato encontrado.'}
                      </td>
                  </tr>
                )}
            </tbody>
            </table>
        )}
      </div>

      {/* Modal (Add/Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold mb-1 text-gray-800">
              {editingId ? 'Editar Candidato' : 'Novo Candidato'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {editingId ? 'Atualize as informações abaixo.' : 'Preencha os dados para cadastrar.'}
            </p>

            {errorMsg && (
                <div className={`mb-4 p-3 ${errorMsg.includes('Recursão') ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-red-50 text-red-700'} text-sm rounded-lg flex items-start gap-2`}>
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
            
            <form onSubmit={handleSave}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Corporativo</label>
                  <input 
                    required 
                    type="email"
                    disabled={!!editingId} // Disable email edit to avoid auth sync issues
                    className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${editingId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500'}`}
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                  {editingId && <p className="text-xs text-gray-400 mt-1">O email não pode ser alterado.</p>}
                </div>

                {!editingId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha de Acesso</label>
                    <input 
                      required 
                      type="password" 
                      placeholder="Defina uma senha provisória"
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teste Inicial</label>
                    <select 
                      value={formData.testId}
                      onChange={(e) => setFormData({...formData, testId: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">Selecione um teste (opcional)</option>
                        {tests.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};