import React, { useState, useEffect } from 'react';
import { Search, FileText, Calendar, User, Eye, X, BarChart2, Loader2, AlertCircle, TrendingUp, Filter, Brain, MessageSquare, Briefcase, Lightbulb, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface ResultRow {
  id: string;
  created_at: string;
  test_id: string;
  candidate_id: string;
  result: any; 
  profiles?: {
    name: string;
    email: string;
  };
  tests?: {
    title: string;
  };
}

export const ResultsAnalysis: React.FC = () => {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('result_test')
        .select(`
          id,
          created_at,
          test_id,
          candidate_id,
          result,
          profiles:candidate_id (name, email),
          tests:test_id (title)
        `)
        .order('created_at', { ascending: false });

      if (error) {
           // Fallback for missing relationships (RLS or Schema issues)
           if (error.code === 'PGRST200' || error.message.includes('relationship')) {
               console.warn('Relationships not found, falling back to raw data fetch from result_test.');
               const { data: rawData, error: rawError } = await supabase
                   .from('result_test')
                   .select('*')
                   .order('created_at', { ascending: false });

               if (rawError) throw rawError;

               const mappedData = rawData.map((r: any) => {
                   const parsed = safeParseJSON(r.result);
                   return {
                       ...r,
                       result: parsed,
                       profiles: {
                           name: parsed?.candidate_email || 'Candidato (Nome indisponível)',
                           email: parsed?.candidate_email || r.candidate_id
                       },
                       tests: {
                           title: parsed?.test_title || 'Teste (Título indisponível)'
                       }
                   };
               });
               setResults(mappedData);
               return;
           }
           throw error;
      }
      
      const processedData = (data as any[]).map(row => ({
          ...row,
          result: safeParseJSON(row.result)
      }));

      setResults(processedData);
    } catch (err: any) {
      console.error('Error fetching results:', JSON.stringify(err, null, 2));
      setFetchError(err.message || 'Erro desconhecido ao carregar resultados.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely parse JSON, handling double stringification
  const safeParseJSON = (input: any) => {
      if (typeof input === 'object' && input !== null) return input;
      try {
          const parsed = JSON.parse(input);
          // Recursively parse if it's still a string (double stringified)
          if (typeof parsed === 'string') return safeParseJSON(parsed);
          return parsed;
      } catch (e) {
          console.error("JSON Parse error", e);
          return {};
      }
  };

  const calculateChartData = (resultRow: ResultRow) => {
    const data = resultRow.result || {};

    // --- Scenario A: AI Processed Data (The JSON structure you provided) ---
    if (data['caracteirsta-de-personalidade-lideranca'] || data['metadados_calculo']) {
        
        // 1. Radar Data (Competencies)
        // We aggregate all specific personality sections
        let radarData: any[] = [];
        const sections = [
            'caracteirsta-de-personalidade-comunicacao',
            'caracteirsta-de-personalidade-organizacao',
            'caracteirsta-de-personalidade-lideranca',
            'caracteirsta-de-personalidade-analitico'
        ];

        sections.forEach(secKey => {
            if (data[secKey]) {
                Object.entries(data[secKey]).forEach(([key, value]) => {
                    radarData.push({
                        subject: key.replace(/_/g, ' '),
                        A: typeof value === 'number' ? value : 0,
                        fullMark: 100
                    });
                });
            }
        });

        // 2. Bar Data (Overall Profile)
        let barData: any[] = [];
        if (data.metadados_calculo && data.metadados_calculo.escala_0_100) {
            barData = Object.entries(data.metadados_calculo.escala_0_100).map(([key, value]) => ({
                name: key,
                value: typeof value === 'number' ? value : 0
            }));
        }

        return { radarData, barData, isAiData: true };
    }

    // --- Scenario B: Raw Answers (Legacy/Fallback) ---
    // If the JSON is just the raw questions list
    const questions = data.body || data.questions || data.payload?.body || [];
    const categoryScores: Record<string, { total: number; count: number }> = {};
    const profileCounts: Record<string, number> = {};

    questions.forEach((q: any) => {
      if (q.category && q.type === 'scale' && q.resposta?.value) {
        if (!categoryScores[q.category]) categoryScores[q.category] = { total: 0, count: 0 };
        categoryScores[q.category].total += parseInt(q.resposta.value, 10);
        categoryScores[q.category].count += 1;
      }
      if (q.type === 'choice' && q.resposta) {
         if (q.resposta.value && isNaN(parseInt(q.resposta.value))) {
             const tag = q.resposta.value;
             profileCounts[tag] = (profileCounts[tag] || 0) + 1;
         }
         if (q.resposta.most?.value && isNaN(parseInt(q.resposta.most.value))) {
             const tag = q.resposta.most.value;
             profileCounts[tag] = (profileCounts[tag] || 0) + 1;
         }
         // We don't typically chart 'least' for profile dominance, but could if needed
      }
    });

    return {
        radarData: Object.keys(categoryScores).map(cat => ({
            subject: cat.length > 20 ? cat.substring(0, 20) + '...' : cat,
            fullSubject: cat,
            A: (categoryScores[cat].total / categoryScores[cat].count).toFixed(1),
            fullMark: 5
        })),
        barData: Object.keys(profileCounts).map(tag => ({
            name: tag,
            value: profileCounts[tag]
        })),
        isAiData: false
    };
  };

  const filteredResults = results.filter(r => {
    const term = searchTerm.toLowerCase();
    const name = r.profiles?.name?.toLowerCase() || '';
    const email = r.profiles?.email?.toLowerCase() || '';
    const test = r.tests?.title?.toLowerCase() || '';
    const jsonTestTitle = r.result?.test_title?.toLowerCase() || '';
    
    return name.includes(term) || email.includes(term) || test.includes(term) || jsonTestTitle.includes(term);
  });

  // --- Modal Content Renderers ---

  const renderAiInsights = (data: any) => {
    return (
        <div className="space-y-6">
            {/* 1. Main Conclusions */}
            {data['principais-conclusoes'] && (
                <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                    <h3 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5" /> Principais Conclusões
                    </h3>
                    <ul className="space-y-2">
                        {data['principais-conclusoes'].map((item: string, idx: number) => (
                            <li key={idx} className="flex gap-2 text-gray-700 text-sm">
                                <span className="text-emerald-500 font-bold">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 2. Grid: Behaviors & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data['comportamentos-naturais'] && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" /> Comportamentos Naturais
                        </h3>
                        <div className="space-y-3">
                            {Object.entries(data['comportamentos-naturais']).map(([key, val]: any) => (
                                <div key={key}>
                                    <span className="text-xs font-bold uppercase text-gray-400 block mb-0.5">{key.replace(/_/g, ' ')}</span>
                                    <p className="text-sm text-gray-700">{val}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {data['comportamentos-para-investigar'] && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-500" /> Pontos de Atenção
                        </h3>
                         <div className="space-y-3">
                            {Object.entries(data['comportamentos-para-investigar']).map(([key, val]: any) => (
                                <div key={key}>
                                    <span className="text-xs font-bold uppercase text-gray-400 block mb-0.5">{key.replace(/_/g, ' ')}</span>
                                    <p className="text-sm text-gray-700">{val}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. HR Recommendations */}
            {data['recomendacoes-ao-rh'] && (
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                     <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Recomendações ao RH
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">
                        {data['recomendacoes-ao-rh'].texto}
                    </p>
                    {data['recomendacoes-ao-rh'].outros_pontos && (
                        <div className="bg-white/50 p-3 rounded-lg text-sm text-blue-900 border border-blue-100">
                            <strong>Outros pontos: </strong> {data['recomendacoes-ao-rh'].outros_pontos}
                        </div>
                    )}
                </div>
            )}

            {/* 4. Interview Questions */}
            {data['perguntas-para-entrevista'] && data['perguntas-para-entrevista'].perguntas && (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-500" /> Sugestões de Perguntas para Entrevista
                    </h3>
                    <div className="grid gap-3">
                        {data['perguntas-para-entrevista'].perguntas.map((q: string, idx: number) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-700 flex gap-3">
                                <span className="bg-purple-100 text-purple-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0">
                                    {idx + 1}
                                </span>
                                {q}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderRawQuestions = (resultData: any) => {
       const questions = resultData.body || resultData.questions || [];
       if (questions.length === 0) return <p className="text-gray-400 text-center py-4">Nenhuma resposta detalhada disponível.</p>;

       return (
           <div className="space-y-4">
               {questions.map((q: any, idx: number) => (
                   <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <div className="flex justify-between items-start mb-3">
                           <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded">
                               {q.category || 'Geral'}
                           </span>
                           <span className="text-xs text-gray-400">#{idx + 1}</span>
                       </div>
                       
                       <h4 className="text-md font-semibold text-gray-800 mb-4">{q.text}</h4>
                       
                       <div className="border-t border-gray-100 pt-4">
                            {/* SCALE TYPE */}
                            {q.type === 'scale' && q.resposta && (
                                <div className="flex flex-col gap-2 max-w-md bg-gray-50 p-4 rounded-lg">
                                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                                        <span>Discordo (1)</span>
                                        <span>Concordo (5)</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
                                        <div 
                                            className="h-full bg-emerald-500 absolute left-0 top-0 transition-all" 
                                            style={{ width: `${(parseInt(q.resposta.value) / 5) * 100}%` }} 
                                        />
                                    </div>
                                    <div className="text-center font-bold text-emerald-700 mt-1">
                                        Nota: {q.resposta.value}
                                    </div>
                                </div>
                            )}

                            {/* CHOICE TYPE */}
                            {q.type === 'choice' && q.resposta && (
                                <div>
                                    {/* Variation: Most/Least (Behavioral) */}
                                    {(q.resposta.most || q.resposta.least) ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Most */}
                                            {q.resposta.most && (
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600">
                                                            <ThumbsUp size={14} />
                                                        </div>
                                                        <span className="text-xs font-bold text-emerald-700 uppercase">Mais (Predominante)</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                                        "{q.resposta.most.text}"
                                                    </p>
                                                    {q.resposta.most.value && (
                                                        <div className="mt-3 inline-flex items-center px-2 py-1 rounded bg-white border border-emerald-100 text-xs font-semibold text-emerald-600">
                                                            Perfil: {q.resposta.most.value}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Least */}
                                            {q.resposta.least && (
                                                <div className="bg-red-50 border border-red-100 rounded-lg p-4 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="bg-red-100 p-1.5 rounded-full text-red-500">
                                                            <ThumbsDown size={14} />
                                                        </div>
                                                        <span className="text-xs font-bold text-red-700 uppercase">Menos (Pouco Predominante)</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                                        "{q.resposta.least.text}"
                                                    </p>
                                                    {q.resposta.least.value && (
                                                        <div className="mt-3 inline-flex items-center px-2 py-1 rounded bg-white border border-red-100 text-xs font-semibold text-red-500">
                                                            Perfil: {q.resposta.least.value}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Standard Single Choice */
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                            <span className="text-xs font-bold text-gray-400 uppercase mb-2 block">Resposta Selecionada</span>
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={18} />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">
                                                        {q.resposta.text || q.resposta.value || JSON.stringify(q.resposta)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                       </div>
                   </div>
               ))}
           </div>
       );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Resultados e Análises</h1>
          <p className="text-gray-500 text-sm">Visualize os relatórios comportamentais dos candidatos.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar candidato ou teste..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {fetchError && (
             <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 text-red-700 text-sm">
                 <AlertCircle size={16} />
                 {fetchError}
             </div>
        )}

        <div className="overflow-auto flex-1">
            {loading ? (
                 <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                 </div>
            ) : filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <BarChart2 size={48} className="mb-4 opacity-20" />
                    <p>Nenhum resultado encontrado.</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Candidato</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Teste Aplicado</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {filteredResults.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                {new Date(r.created_at).toLocaleDateString('pt-BR')}
                            </div>
                        </td>
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {r.profiles?.name?.charAt(0) || 'C'}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{r.profiles?.name || 'Desconhecido'}</p>
                                    <p className="text-xs text-gray-400">{r.profiles?.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                                <FileText size={12} />
                                {r.tests?.title || r.result?.test_title || 'Teste'}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={() => setSelectedResult(r)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Eye size={16} /> Ver Análise
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in-up">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedResult.tests?.title || selectedResult.result?.test_title}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><User size={14} /> {selectedResult.profiles?.name}</span>
                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(selectedResult.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <button 
                    onClick={() => setSelectedResult(null)}
                    className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="overflow-y-auto p-6 bg-gray-50/50">
                
                {/* Visual Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Radar Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" /> Mapa de Competências
                        </h3>
                        <div className="h-64">
                            {calculateChartData(selectedResult).radarData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={calculateChartData(selectedResult).radarData}>
                                        <PolarGrid stroke="#e5e7eb" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, calculateChartData(selectedResult).isAiData ? 100 : 5]} tick={false} axisLine={false} />
                                        <Radar name="Candidato" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                    Não há dados suficientes para gerar o gráfico.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <BarChart2 size={16} className="text-blue-500" /> Perfil Predominante
                        </h3>
                        <div className="h-64">
                             {calculateChartData(selectedResult).barData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={calculateChartData(selectedResult).barData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" hide domain={[0, calculateChartData(selectedResult).isAiData ? 100 : 'auto']} />
                                        <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 11}} />
                                        <Tooltip cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                            {calculateChartData(selectedResult).barData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                             ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                    Nenhuma tag de perfil identificada.
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                {/* Analysis Content Switcher */}
                {calculateChartData(selectedResult).isAiData ? (
                    <>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 px-1">Análise Comportamental Detalhada</h3>
                        {renderAiInsights(selectedResult.result)}
                    </>
                ) : (
                    <>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 px-1">Respostas Detalhadas</h3>
                        {renderRawQuestions(selectedResult.result)}
                    </>
                )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                <button 
                    onClick={() => setSelectedResult(null)}
                    className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Fechar
                </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};