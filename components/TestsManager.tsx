import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, GripVertical, CheckSquare, Circle, FileText, Loader2, AlertCircle, Pencil, Power, GitMerge, Tag, Layers } from 'lucide-react';
import { Test, Question } from '../types';
import { supabase } from '../supabaseClient';
import { QUESTION_CATEGORIES } from '../constants';

const PROFILE_OPTIONS = ['Analítico', 'Organizado', 'Comunicativo', 'Líder'];
const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i.toString()); // "0" to "10"

export const TestsManager: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // UI State
  const [isCreating, setIsCreating] = useState(false); // Used for both Create and Edit view
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Fetch Tests from DB
  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setTests(data as unknown as Test[]);
      }
    } catch (error: any) {
      console.error('Error fetching tests:', error);
      setErrorMsg('Erro ao carregar testes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setActive(true);
    setQuestions([{ id: `q${Date.now()}`, text: '', type: 'scale' }]);
    setIsCreating(true);
  };

  const handleEdit = (test: Test) => {
    setEditingId(test.id);
    setTitle(test.title);
    setDescription(test.description || '');
    setActive(test.active);
    
    // Parse questions carefully to handle potential legacy string[] options vs object[] options
    const parsedQuestions = test.questions ? JSON.parse(JSON.stringify(test.questions)) : [];
    
    // Migration helper for frontend state: ensure all options are objects
    const sanitizedQuestions = parsedQuestions.map((q: any) => {
        if (q.type === 'choice' && q.options && typeof q.options[0] === 'string') {
            q.options = q.options.map((optStr: string) => ({ text: optStr, value: '' }));
        }
        return q;
    });

    setQuestions(sanitizedQuestions);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setErrorMsg('');
  };

  const handleSave = async () => {
    if (!title) {
        alert('O título do teste é obrigatório.');
        return;
    }
    
    setIsSaving(true);
    setErrorMsg('');

    try {
        const payload = {
            title,
            description,
            questions, 
            active
        };

        if (editingId) {
            // UPDATE logic
            const { error } = await supabase
                .from('tests')
                .update(payload)
                .eq('id', editingId);

            if (error) throw error;

            // Update local state
            setTests(tests.map(t => t.id === editingId ? { ...t, ...payload, id: editingId } : t));
        } else {
            // INSERT logic
            const { data, error } = await supabase
                .from('tests')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setTests([data as unknown as Test, ...tests]);
            }
        }
        
        setIsCreating(false);
        setEditingId(null);

    } catch (error: any) {
        console.error('Error saving test:', error);
        setErrorMsg('Erro ao salvar: ' + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  // --- Question Helpers ---
  const addQuestion = () => {
    setQuestions([
      ...questions,
      { 
        id: `q${Date.now()}`, 
        text: '', 
        type: 'scale', 
        category: '',
        variation: 'single',
        options: [{ text: '', value: '' }]
      }
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { 
            ...q, 
            options: [...(q.options || []), { text: '', value: '' }] 
        };
      }
      return q;
    }));
  };

  const updateOptionText = (qId: string, idx: number, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options) {
        const newOpts = [...q.options];
        newOpts[idx] = { ...newOpts[idx], text };
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const updateOptionValue = (qId: string, idx: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options) {
        const newOpts = [...q.options];
        newOpts[idx] = { ...newOpts[idx], value };
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };
  
  const removeOption = (qId: string, idx: number) => {
    setQuestions(questions.map(q => {
        if (q.id === qId && q.options) {
            return { ...q, options: q.options.filter((_, i) => i !== idx) };
        }
        return q;
    }));
  };

  // View: Create/Edit Form
  if (isCreating) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in relative">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-[#f3f4f6] px-6 py-6 border-b border-gray-200/50 shadow-sm mb-6 -mx-6 md:mx-0">
            <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">
                    {editingId ? 'Editar Teste' : 'Novo Teste Comportamental'}
                </h1>
                <p className="text-gray-500 text-sm">
                    {editingId ? 'Altere as configurações e perguntas do teste.' : 'Configure as perguntas e opções do teste.'}
                </p>
            </div>
            <div className="flex gap-3">
                <button 
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                Cancelar
                </button>
                <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Teste
                </button>
            </div>
            </div>
        </div>

        <div className="px-6 pb-12">
            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="space-y-6">
            {/* Main Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Informações Básicas</h3>
                    
                    {/* Status Toggle */}
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <span className="text-sm font-medium text-gray-600">Status do Teste:</span>
                        <button
                            onClick={() => setActive(!active)}
                            type="button"
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${active ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-xs font-bold uppercase ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {active ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                </div>

                <div className="grid gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título do Teste</label>
                    <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Avaliação de Cultura e Liderança"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o objetivo deste teste..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                    />
                </div>
                </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Perguntas ({questions.length})</h3>
                    {/* Add Button removed from here */}
                </div>

                {questions.map((q, index) => (
                <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 group relative animate-fade-in-up">
                    <div className="absolute top-6 right-6">
                    <button 
                        onClick={() => removeQuestion(q.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover pergunta"
                    >
                        <Trash2 size={18} />
                    </button>
                    </div>
                    
                    <div className="flex gap-4">
                    <div className="pt-3 text-gray-400 cursor-move">
                        <GripVertical size={20} />
                    </div>
                    <div className="flex-1 space-y-4">
                        {/* Question Main Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Pergunta {index + 1}</label>
                            <input 
                            type="text" 
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                            placeholder="Digite a pergunta aqui..."
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        
                        {/* Category Selection */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                                <Layers size={12} /> Categoria / Competência
                            </label>
                            <select
                            value={q.category || ''}
                            onChange={(e) => updateQuestion(q.id, { category: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value="">Selecione a competência...</option>
                                {QUESTION_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Type Selection */}
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tipo de Resposta</label>
                                <select 
                                value={q.type}
                                onChange={(e) => updateQuestion(q.id, { 
                                    type: e.target.value as 'scale' | 'choice', 
                                    options: e.target.value === 'choice' ? [{text: '', value: ''}] : undefined,
                                    variation: 'single' // Reset variation when type changes
                                })}
                                className="w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                <option value="scale">Escala (1-5)</option>
                                <option value="choice">Múltipla Escolha</option>
                                </select>
                            </div>
                            
                            {/* Configuração Extra para Multipla Escolha */}
                            {q.type === 'choice' && (
                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                    <label className="block text-xs font-medium text-emerald-800 uppercase mb-1 flex items-center gap-1">
                                        <GitMerge size={12} /> Configuração da Escolha
                                    </label>
                                    <select 
                                        value={q.variation || 'single'}
                                        onChange={(e) => updateQuestion(q.id, { variation: e.target.value as 'single' | 'most_least' })}
                                        className="w-full border border-emerald-200 rounded-md p-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="single">Única Escolha (Padrão)</option>
                                        <option value="most_least">Mais / Menos (Perfil DISC)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        </div>

                        {/* Options Area */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mt-2">
                        {q.type === 'scale' ? (
                            <div className="flex items-center justify-between text-sm text-gray-500 px-4 py-2">
                            <span>1. Discordo Totalmente</span>
                            <div className="h-1 flex-1 mx-4 bg-gray-200 rounded-full"></div>
                            <span>5. Concordo Totalmente</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="block text-xs font-medium text-gray-500 uppercase">Opções de Resposta</label>
                                {q.variation === 'most_least' && (
                                    <span className="text-xs text-emerald-600 font-medium">O candidato deverá escolher a opção que MAIS o descreve e a que MENOS o descreve.</span>
                                )}
                            </div>
                            
                            {q.options?.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-start gap-2">
                                <div className="mt-2.5">
                                    <Circle size={16} className="text-gray-300" />
                                </div>
                                
                                <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:gap-2">
                                    {/* Option Text */}
                                    <input 
                                        type="text" 
                                        value={opt.text}
                                        onChange={(e) => updateOptionText(q.id, optIdx, e.target.value)}
                                        placeholder={`Opção ${optIdx + 1}`}
                                        className="flex-1 w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />

                                    {/* Weight/Category Selector */}
                                    <div className="relative min-w-[140px]">
                                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                            <Tag size={12} className="text-gray-400" />
                                        </div>
                                        <select
                                            value={opt.value || ''}
                                            onChange={(e) => updateOptionValue(q.id, optIdx, e.target.value)}
                                            className="w-full border border-gray-300 rounded-md py-1.5 pl-7 pr-2 text-xs bg-white text-gray-600 focus:ring-1 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="">Sem Peso/Perfil</option>
                                            <optgroup label="Perfis Comportamentais">
                                                {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </optgroup>
                                            <optgroup label="Pontuação">
                                                {SCORE_OPTIONS.map(s => <option key={s} value={s}>Valor: {s}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => removeOption(q.id, optIdx)}
                                    className="mt-1.5 text-gray-400 hover:text-red-500"
                                >
                                    <X size={16} />
                                </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => addOption(q.id)}
                                className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1 mt-2"
                            >
                                <Plus size={14} /> Adicionar Opção
                            </button>
                            </div>
                        )}
                        </div>
                    </div>
                    </div>
                </div>
                ))}

                {/* New Add Button Location */}
                <div className="flex justify-end pt-4">
                    <button 
                        onClick={addQuestion}
                        className="text-emerald-600 text-sm font-medium hover:text-emerald-700 flex items-center gap-1 hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        Adicionar Pergunta
                    </button>
                </div>

                {questions.length === 0 && (
                <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-gray-400">Nenhuma pergunta adicionada ainda.</p>
                    <button onClick={addQuestion} className="text-emerald-600 font-medium hover:underline mt-2">Adicionar primeira pergunta</button>
                </div>
                )}
            </div>
            </div>
        </div>
      </div>
    );
  }

  // View: List Tests
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gerenciar Testes</h1>
          <p className="text-gray-500 text-sm">Crie e edite os modelos de avaliação comportamental.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Novo Teste
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : errorMsg && !isCreating ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-full">
                <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Erro ao carregar</h3>
            <p className="text-gray-500 max-w-sm mt-1">{errorMsg}</p>
            <button onClick={fetchTests} className="mt-4 text-emerald-600 hover:underline">Tentar novamente</button>
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <div className="mb-4 p-3 bg-gray-50 text-gray-400 rounded-full">
                <FileText size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Nenhum teste encontrado</h3>
            <p className="text-gray-500 max-w-sm mt-1">Crie o primeiro teste para começar a avaliar candidatos.</p>
            <button 
                onClick={handleCreateNew}
                className="mt-4 text-emerald-600 font-medium hover:underline"
            >
                Criar Teste Agora
            </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tests.map(test => (
            <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:border-emerald-200 transition-colors group">
                <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileText size={24} />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${test.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {test.active ? <CheckSquare size={10} /> : <Power size={10} />}
                    {test.active ? 'Ativo' : 'Inativo'}
                </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mb-2">{test.title}</h3>
                <p className="text-gray-500 text-sm mb-6 flex-1 line-clamp-3">{test.description || 'Sem descrição.'}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                    <CheckSquare size={16} /> {test.questions ? test.questions.length : 0} questões
                </span>
                <button 
                    onClick={() => handleEdit(test)}
                    className="text-emerald-600 font-medium hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                    <Pencil size={14} />
                    Editar
                </button>
                </div>
            </div>
            ))}
        </div>
      )}
    </div>
  );
};