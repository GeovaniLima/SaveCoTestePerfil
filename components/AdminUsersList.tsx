import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, AlertCircle, X, Shield, UserCheck } from 'lucide-react';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export const AdminUsersList: React.FC = () => {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setAdmins(data as AdminProfile[]);
      }
    } catch (error: any) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setErrorMsg('');
    setFormData({
      name: '',
      email: '',
      password: ''
    });
    setShowModal(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
        // Use a temporary client to avoid overwriting the current session
        const tempSupabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        // 1. Create Auth User
        const { data, error } = await tempSupabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: 'admin', // Crucial: Set role to admin
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Ideally, the trigger handles profile creation, but we can manually insert if needed
          // or just wait for the trigger. Since we used metadata, let's refresh the list.
          
          // Small delay to allow trigger to propagate if it's async
          setTimeout(() => {
             fetchAdmins();
          }, 1000);

          const newAdmin: AdminProfile = {
              id: data.user.id,
              name: formData.name,
              email: formData.email,
              created_at: new Date().toISOString()
          };
          // Optimistic update
          setAdmins([newAdmin, ...admins]);
        }
      
      setShowModal(false);
    } catch (error: any) {
      console.error('Error creating admin:', error);
      if (error.message?.includes('User already registered')) {
        setErrorMsg('Este e-mail já está registrado.');
      } else {
        setErrorMsg(error.message || 'Erro ao criar administrador.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = admins.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuários Admin</h1>
          <p className="text-gray-500 text-sm">Gerencie quem tem acesso total ao sistema.</p>
        </div>
        <button 
          onClick={openModal}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Novo Admin
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar admin..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

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
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase w-1/3">Email</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right w-1/3">Data Cadastro</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredAdmins.length > 0 ? filteredAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50 group transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                                <Shield size={14} />
                            </div>
                            <span className="font-semibold text-gray-900 text-sm">{admin.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                            <span className="text-sm text-gray-600">{admin.email}</span>
                        </td>
                        <td className="p-4 text-right">
                             <span className="text-sm text-gray-400">
                                {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                             </span>
                        </td>
                    </tr>
                )) : (
                  <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-400 text-sm">
                        Nenhum administrador encontrado.
                      </td>
                  </tr>
                )}
            </tbody>
            </table>
        )}
      </div>

      {/* Modal (Add Admin) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-2 mb-1 text-emerald-600">
                <UserCheck size={20} />
                <h2 className="text-xl font-bold text-gray-800">Novo Administrador</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
               Este usuário terá acesso completo ao painel de RH.
            </p>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
            
            <form onSubmit={handleCreateAdmin}>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de Acesso</label>
                  <input 
                    required 
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input 
                      required 
                      type="password" 
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
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
                  Criar Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};