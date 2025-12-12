import React, { useState, useEffect, useRef } from 'react';
import { Question, Candidate, Test, QuestionOption } from '../types';
import { CheckCircle, ArrowRight, AlertTriangle, Loader2, ThumbsUp, ThumbsDown, Check, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface CandidateViewProps {
  onComplete: () => void;
  candidateId: string;
}

export const CandidateView: React.FC<CandidateViewProps> = ({ onComplete, candidateId }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [test, setTest] = useState<Test | null>(null);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(0);
  
  // Answers State
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Ref to prevent double submission (Strict Lock)
  const hasSubmittedRef = useRef(false);

  // Fetch Data on Mount
  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', candidateId)
          .single();

        if (profileError) throw profileError;
        setCandidateName(profile.name);
        setCandidateEmail(profile.email || '');

        if (profile.status === 'completed' || profile.status === 'in-progress') {
            setAlreadyTaken(true);
            setLoading(false);
            return;
        }

        if (!profile.assigned_test_id) {
          setError('Nenhum teste foi atribuído ao seu perfil ainda. Entre em contato com o RH.');
          setLoading(false);
          return;
        }

        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', profile.assigned_test_id)
          .single();

        if (testError) throw testError;

        if (!testData.active) {
            setError('Este teste não está mais ativo.');
            setLoading(false);
            return;
        }

        const parsedTest = {
            ...testData,
            questions: typeof testData.questions === 'string' ? JSON.parse(testData.questions) : testData.questions
        };

        setTest(parsedTest as Test);

      } catch (err: any) {
        console.error('Error loading candidate session:', err);
        setError('Erro ao carregar sessão: ' + (err.message || 'Erro desconhecido.'));
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (!isCompleted && !alreadyTaken && currentStep > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);

  }, [candidateId, isCompleted, currentStep, alreadyTaken]);

  // --- Handlers ---

  const handleScaleAnswer = (questionId: string, val: number) => {
      setAnswers(prev => ({
          ...prev,
          [questionId]: { text: val.toString(), value: val.toString() }
      }));
  };

  const handleSingleChoice = (questionId: string, option: QuestionOption) => {
      setAnswers(prev => ({
          ...prev,
          [questionId]: { text: option.text, value: option.value }
      }));
  };

  const handleMostLeast = (questionId: string, type: 'most' | 'least', option: QuestionOption) => {
      setAnswers(prev => {
          const currentAnswer = prev[questionId] || {};
          let newMost = currentAnswer.most;
          let newLeast = currentAnswer.least;

          if (type === 'most') {
              newMost = option;
              if (newLeast?.text === option.text) newLeast = undefined;
          } else {
              newLeast = option;
              if (newMost?.text === option.text) newMost = undefined;
          }

          return {
              ...prev,
              [questionId]: { most: newMost, least: newLeast }
          };
      });
  };

  const canProceed = () => {
      if (!test) return false;
      const q = test.questions[currentStep];
      const ans = answers[q.id];

      if (!ans) return false;

      if (q.type === 'scale') return true;
      if (q.type === 'choice') {
          if (q.variation === 'most_least') {
              return ans.most && ans.least && ans.most.text !== ans.least.text;
          }
          return !!ans.text;
      }
      return false;
  };

  const handleNext = async () => {
    if (!test) return;

    if (currentStep < test.questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      await submitTest();
    }
  };

  const submitTest = async () => {
    // 1. STRICT LOCK: Previne duplo clique
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    setIsSubmitting(true);
    try {
        if (!test) throw new Error("Teste não encontrado");

        // 2. Build Questions Payload
        const questionsList = test.questions.map(q => {
            const userAnswer = answers[q.id];
            
            const qObj: any = {
                id: q.id,
                text: q.text,
                category: q.category,
                type: q.type,
                options: q.options,
                variation: q.variation
            };

            if (q.type === 'scale') {
                qObj.resposta = userAnswer; 
            } else if (q.type === 'choice') {
                if (q.variation === 'most_least') {
                     qObj.resposta = {
                         most: userAnswer.most, 
                         least: userAnswer.least
                     };
                } else {
                    qObj.resposta = userAnswer; 
                }
            }

            return qObj;
        });

        const finalPayload = {
            test_id: test.id,
            test_title: test.title,
            test_description: test.description,
            candidate_id: candidateId,
            candidate_email: candidateEmail,
            body: questionsList 
        };

        if (!finalPayload.body || finalPayload.body.length === 0) {
            throw new Error("Erro: O teste parece estar vazio. Tente recarregar.");
        }

        // 3. Send to Webhook (N8N)
        // O Webhook é responsável por salvar os dados na tabela 'result_test' após processamento.
        try {
            await fetch('https://projetosave-n8n.c20rpn.easypanel.host/webhook/teste-comportamental-lideranca', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(finalPayload)
            });
            console.log('Webhook enviado com sucesso.');
        } catch (webhookErr) {
            console.error('Erro ao enviar webhook:', webhookErr);
            throw new Error('Falha de conexão ao enviar respostas. Tente novamente.');
        }

        // 4. Update Profile Status (Only update status, do not insert result here)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
                status: 'completed',
                completed_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', candidateId);

        if (profileError) throw profileError;

        setIsCompleted(true);
        setTimeout(() => {
            onComplete();
        }, 4000);

    } catch (err: any) {
        console.error('Erro crítico no envio:', err);
        setError(`Erro ao finalizar: ${err.message || 'Contate o suporte.'}`);
        // Se deu erro, permitimos tentar de novo (reseta o lock se for erro de rede, por exemplo)
        // Mas se o erro for lógico, o usuário verá a mensagem.
        hasSubmittedRef.current = false; 
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Views ---

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4"><Loader2 className="w-10 h-10 text-emerald-600 animate-spin" /><p className="text-gray-500 font-medium">Carregando...</p></div>;

  if (alreadyTaken) return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-10 text-center border border-gray-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Teste Já Realizado</h2>
          <p className="text-gray-600 mb-8 text-lg leading-relaxed">
            Olá, <strong>{candidateName}</strong>.<br/>
            O RH da Save Co já recebeu seu teste.
          </p>
          <button 
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>
  );

  if (error || !test) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-2xl shadow-lg p-8 text-center border border-red-100">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Atenção</h2>
                <p className="text-gray-600 mb-6">{error || 'Teste não encontrado.'}</p>
                <button type="button" onClick={onComplete} className="text-sm font-medium text-gray-500 hover:text-gray-800 underline">Voltar para o Login</button>
            </div>
        </div>
  );

  if (isCompleted) return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-10 text-center">
          <CheckCircle className="w-24 h-24 text-emerald-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Teste Enviado!</h2>
          <p className="text-gray-600 mb-8 text-lg">Obrigado, <strong>{candidateName}</strong>. Suas respostas foram enviadas para análise.</p>
          <div className="inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg text-sm font-medium animate-pulse"><Loader2 className="animate-spin w-4 h-4" />Finalizando sessão...</div>
        </div>
      </div>
  );

  const currentQuestion = test.questions[currentStep];
  const progress = ((currentStep + 1) / test.questions.length) * 100;
  const isLastQuestion = currentStep === test.questions.length - 1;

  // --- Render Helpers ---

  const renderInstruction = () => {
      if (currentQuestion.type === 'scale') return "Avalie de 1 a 5 o quanto você concorda com a afirmação.";
      if (currentQuestion.type === 'choice') {
          if (currentQuestion.variation === 'most_least') {
              return "Escolha DUAS opções: A que MAIS te descreve e a que MENOS te descreve.";
          }
          return "Escolha APENAS UMA opção, a que mais se parece com você.";
      }
      return "";
  };

  const renderChoiceOptions = () => {
      // Option Helper
      const getOpt = (o: any) => typeof o === 'string' ? { text: o, value: o } : o;

      if (currentQuestion.variation === 'most_least') {
          const currentAns = answers[currentQuestion.id] || {};
          return (
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Opções</th>
                              <th className="p-4 text-center w-24 text-xs font-bold text-emerald-600 uppercase bg-emerald-50/50">
                                  <div className="flex flex-col items-center gap-1">
                                      <ThumbsUp size={16} /> Mais
                                  </div>
                              </th>
                              <th className="p-4 text-center w-24 text-xs font-bold text-red-500 uppercase bg-red-50/50">
                                  <div className="flex flex-col items-center gap-1">
                                      <ThumbsDown size={16} /> Menos
                                  </div>
                              </th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                          {currentQuestion.options?.map((rawOpt, idx) => {
                              const opt = getOpt(rawOpt);
                              const isMost = currentAns.most?.text === opt.text;
                              const isLeast = currentAns.least?.text === opt.text;

                              return (
                                  <tr key={idx} className={`transition-colors ${isMost ? 'bg-emerald-50' : isLeast ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                                      <td className="p-4 text-sm font-medium text-gray-700">{opt.text}</td>
                                      <td className="p-4 text-center relative">
                                          <button 
                                              type="button"
                                              onClick={() => handleMostLeast(currentQuestion.id, 'most', opt)}
                                              className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all ${isMost ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}
                                          >
                                              {isMost && <Check size={14} />}
                                          </button>
                                      </td>
                                      <td className="p-4 text-center relative">
                                          <button 
                                              type="button"
                                              onClick={() => handleMostLeast(currentQuestion.id, 'least', opt)}
                                              className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all ${isLeast ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300 hover:border-red-400'}`}
                                          >
                                              {isLeast && <Check size={14} />}
                                          </button>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
                  <div className="p-3 bg-gray-50 text-xs text-center text-gray-400 border-t border-gray-100">
                      Você deve selecionar uma coluna para "Mais" e uma para "Menos".
                  </div>
              </div>
          );
      }

      // Single Choice (Standard)
      return (
          <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options?.map((rawOpt, idx) => {
                  const opt = getOpt(rawOpt);
                  const isSelected = answers[currentQuestion.id]?.text === opt.text;
                  return (
                    <button
                        type="button"
                        key={idx}
                        onClick={() => handleSingleChoice(currentQuestion.id, opt)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden flex items-center gap-4
                            ${isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md ring-1 ring-emerald-200' 
                            : 'border-gray-100 bg-white text-gray-600 hover:border-emerald-200 hover:shadow-sm'}`}
                    >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                            ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 group-hover:border-emerald-400'}`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="font-medium text-base">{opt.text}</span>
                    </button>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">S</div>
           <div>
             <span className="font-bold text-gray-800 block leading-none">Save Co</span>
             <span className="text-[10px] text-gray-400 uppercase tracking-wider">Assessment Center</span>
           </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-400 uppercase font-bold">Candidato</p>
                <p className="text-sm font-medium text-gray-800">{candidateName}</p>
            </div>
        </div>
      </header>

      {/* Warning Banner */}
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-2 text-center">
         <p className="text-xs font-medium text-orange-800 flex items-center justify-center gap-2">
            <AlertTriangle size={14} />
            Não atualize ou feche a página. Se sair agora, terá que reiniciar o teste.
         </p>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 max-w-3xl mx-auto w-full">
        
        {/* Progress */}
        <div className="w-full mb-6">
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-gray-500">Questão <span className="text-gray-900 font-bold">{currentStep + 1}</span> de {test.questions.length}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-emerald-500 transition-all duration-700 ease-out rounded-r-full" style={{ width: `${progress}%` }}></div>
            </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full flex-1 flex flex-col relative animate-fade-in-up">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500"></div>

            <div className="p-6 md:p-10 flex-1 flex flex-col">
                <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                        {currentQuestion.category || 'Geral'}
                    </span>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 leading-snug">
                        {currentQuestion.text}
                    </h1>
                    <p className="text-emerald-600 font-medium text-sm mt-2 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {renderInstruction()}
                    </p>
                </div>

                <div className="flex-1">
                    {currentQuestion.type === 'scale' && (
                        <div className="space-y-6 my-auto py-4">
                            <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-500 px-2">
                                <span className="text-red-400">Discordo Totalmente</span>
                                <span className="text-emerald-500">Concordo Totalmente</span>
                            </div>
                            <div className="flex gap-2 sm:gap-4">
                                {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                    type="button"
                                    key={val}
                                    onClick={() => handleScaleAnswer(currentQuestion.id, val)}
                                    className={`flex-1 aspect-square sm:aspect-auto sm:h-16 rounded-xl border-2 font-bold text-xl transition-all duration-200 flex items-center justify-center
                                    ${answers[currentQuestion.id]?.value === val.toString()
                                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg transform scale-105' 
                                        : 'border-gray-200 text-gray-400 hover:border-emerald-200 hover:bg-gray-50'}`}
                                >
                                    {val}
                                </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentQuestion.type === 'choice' && renderChoiceOptions()}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-end items-center gap-4">
                 <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed() || isSubmitting || hasSubmittedRef.current}
                    className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all duration-300
                        ${(!canProceed() || isSubmitting || hasSubmittedRef.current) 
                        ? 'bg-gray-300 cursor-not-allowed shadow-none grayscale opacity-70' 
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200 hover:scale-[1.02] active:scale-95'}`}
                >
                    {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> Enviando</> : <>{isLastQuestion ? 'Finalizar Teste' : 'Próxima'} <ArrowRight size={20} /></>}
                </button>
            </div>
        </div>
      </main>
    </div>
  );
};