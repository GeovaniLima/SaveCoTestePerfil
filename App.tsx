import React, { useState, useEffect } from 'react';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { CandidatesList } from './components/CandidatesList';
import { TestsManager } from './components/TestsManager';
import { CandidateView } from './components/CandidateView';
import { ResultsAnalysis } from './components/ResultsAnalysis';
import { AdminUsersList } from './components/AdminUsersList';
import { ViewState, UserRole } from './types';
import { Hexagon, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [view, setView] = useState<ViewState>('dashboard');
  const [candidateId, setCandidateId] = useState<string>('');
  
  // Admin User State
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Session Check State
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // 1. Check for existing session on app load
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
           const userRole = session.user.user_metadata.role;
           if (userRole === 'admin') {
              setRole('admin');
              setView('dashboard');
              setAdminName(session.user.user_metadata.name || 'Admin');
              setAdminEmail(session.user.email || '');
           } else {
              setRole('candidate');
              setCandidateId(session.user.id);
              setView('candidate-test');
           }
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // 2. Listen for auth changes (Login, Logout, Auto-refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            setRole(null);
            setAdminName('');
            setAdminEmail('');
            setCandidateId('');
            setEmail('');
            setPassword('');
            setView('dashboard'); // Reset view default
        } else if (event === 'SIGNED_IN' && session?.user) {
            // Logic handled by handleLogin or checkSession usually, 
            // but ensuring state sync here covers edge cases
            const userRole = session.user.user_metadata.role;
            if (userRole === 'admin') {
                setRole('admin');
                setAdminName(session.user.user_metadata.name || 'Admin');
                setAdminEmail(session.user.email || '');
            } else {
                setRole('candidate');
                setCandidateId(session.user.id);
            }
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  // Admin Navigation
  const renderAdminContent = () => {
    switch (view) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'candidates':
        return <CandidatesList />;
      case 'tests':
        return <TestsManager />;
      case 'results':
        return <ResultsAnalysis />;
      case 'admin-users':
        return <AdminUsersList />;
      default:
        return <AdminDashboard />;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
        // Login Flow
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        if (data.user) {
            // Check role from metadata
            const userRole = data.user.user_metadata.role;
            if (userRole === 'admin') {
                setRole('admin');
                setView('dashboard');
                setAdminName(data.user.user_metadata.name || 'Admin');
                setAdminEmail(data.user.email || email);
            } else {
                setRole('candidate');
                setCandidateId(data.user.id);
                setView('candidate-test');
            }
        }
    } catch (err: any) {
        console.error("Auth error:", err);
        let msg = err.message;
        
        // Basic translation of common Supabase auth errors
        if (msg.includes("Invalid login credentials")) msg = "E-mail ou senha incorretos.";
        else if (msg.includes("Email not confirmed")) {
            // Friendly error for users stuck in pending state
            msg = "Login bloqueado: E-mail não confirmado. Se você desativou a confirmação recentemente, este usuário antigo precisa ser recriado pelo Admin.";
        }
        else if (msg.includes("User already registered")) msg = "Este e-mail já está cadastrado.";
        
        setLoginError(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
  };

  // 1. Loading Screen (Checking Session)
  if (isCheckingSession) {
      return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                  <p className="text-gray-500 font-medium text-sm">Carregando...</p>
              </div>
          </div>
      );
  }

  // 2. Login Screen (No Role)
  if (!role) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-emerald-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
               <Hexagon className="text-white w-10 h-10" fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Save Co Essentials</h1>
            <p className="text-emerald-100 text-sm">Plataforma de Avaliação Comportamental</p>
          </div>
          
          <div className="p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Acesse sua conta</h2>

            {loginError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{loginError}</span>
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                 <input 
                    type="email" 
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                 />
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha</label>
                 <input 
                    type="password" 
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                 />
               </div>

               <button 
                 type="submit"
                 disabled={isLoading}
                 className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
               >
                 {isLoading && <Loader2 size={18} className="animate-spin" />}
                 Acessar Sistema
               </button>
            </form>
            
            <div className="mt-6 text-center">
                 <p className="text-xs text-gray-400">
                     Acesso restrito para colaboradores Save Co e candidatos convidados.
                 </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Candidate View
  if (role === 'candidate') {
    return (
      <CandidateView 
        candidateId={candidateId} 
        onComplete={() => {
            handleLogout();
        }} 
      />
    );
  }

  // 4. Admin View
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar 
        currentView={view} 
        onChangeView={setView} 
        onLogout={handleLogout} 
        userName={adminName}
        userEmail={adminEmail}
      />
      <main className="flex-1 ml-64 overflow-y-auto h-screen">
        {renderAdminContent()}
      </main>
    </div>
  );
};

export default App;