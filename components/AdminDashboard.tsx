import React, { useEffect, useState } from 'react';
import { Users, FileText, CheckCircle, Clock, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartColor, Candidate } from '../types';
import { supabase } from '../supabaseClient';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data State
  const [stats, setStats] = useState({
    total: 0,
    activeTests: 0,
    completed: 0,
    pending: 0
  });
  
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Tests Count
      const { data: testsData, error: testsError } = await supabase
        .from('tests')
        .select('id, active');
      
      if (testsError) throw testsError;

      // 2. Fetch Profiles (Candidates) with Test Titles
      // Filter out admins locally or via query if role column is reliable
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, tests(title)')
        .neq('role', 'admin') // Assuming 'role' column exists and is populated
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const candidates = profilesData || [];
      const tests = testsData || [];

      // --- Calculate Stats ---
      const total = candidates.length;
      const activeTests = tests.filter(t => t.active).length;
      const completed = candidates.filter(c => c.status === 'completed').length;
      const pending = candidates.filter(c => c.status === 'pending' || c.status === 'in-progress').length; // Group pending & in-progress for the card

      setStats({ total, activeTests, completed, pending });

      // --- Calculate Status Chart (Pie) ---
      const statusCounts = {
        'Concluídos': candidates.filter(c => c.status === 'completed').length,
        'Em Progresso': candidates.filter(c => c.status === 'in-progress').length,
        'Pendentes': candidates.filter(c => c.status === 'pending').length
      };

      const pieData = Object.entries(statusCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
      
      setStatusData(pieData.length > 0 ? pieData : [{ name: 'Sem dados', value: 1 }]);

      // --- Calculate Monthly Chart (Bar) ---
      // Group by Month/Year of created_at
      const monthMap = new Map<string, number>();
      
      // Initialize last 6 months with 0
      for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthName = d.toLocaleString('pt-BR', { month: 'short' });
          // Key format: "Nov" (Simplification, implies current year cycle)
          // For more robustness in production, key should include year
          if (!monthMap.has(monthName)) {
              monthMap.set(monthName, 0); 
          }
      }

      candidates.forEach(c => {
          if (c.created_at) {
            const d = new Date(c.created_at);
            const monthName = d.toLocaleString('pt-BR', { month: 'short' });
            // Only count if it's within our map (last 6 months approx) or just add it
            const currentVal = monthMap.get(monthName) || 0;
            monthMap.set(monthName, currentVal + 1);
          }
      });

      // Convert Map to Array for Recharts (preserve insertion order of the initialized loop)
      const barData = Array.from(monthMap.entries()).map(([name, candidates]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
          candidates
      }));
      // Sort if needed, but our initialization strategy keeps order mostly correct for recent months
      
      setMonthlyData(barData);

      // --- Recent Candidates ---
      setRecentCandidates(candidates.slice(0, 5));

    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError('Não foi possível carregar os dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  // Custom Card Component
  const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
          <span className="text-3xl font-bold text-gray-800">{loading ? '-' : value}</span>
        </div>
        <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div className="mt-4 text-xs font-medium text-emerald-600 flex items-center">
        {subtext && (
          <>
            <ArrowUpRight className="w-3 h-3 mr-1" />
            {subtext}
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full min-h-[500px]">
              <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-sm text-gray-400">Atualizando Dashboard...</p>
              </div>
          </div>
      );
  }

  if (error) {
      return (
          <div className="p-8 text-center">
              <div className="bg-red-50 text-red-600 p-4 rounded-lg inline-flex items-center gap-2">
                  <AlertCircle size={20} />
                  {error}
              </div>
              <button 
                onClick={fetchDashboardData}
                className="block mx-auto mt-4 text-emerald-600 hover:underline text-sm font-medium"
              >
                Tentar novamente
              </button>
          </div>
      );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm">Visão geral da plataforma Save Co Essentials</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Candidatos" 
          value={stats.total} 
          subtext="Cadastrados na plataforma" 
          icon={Users} 
          colorClass="bg-emerald-500 text-emerald-600"
        />
        <StatCard 
          title="Testes Ativos" 
          value={stats.activeTests} 
          subtext="Disponíveis para envio" 
          icon={FileText} 
          colorClass="bg-blue-500 text-blue-600" 
        />
        <StatCard 
          title="Avaliações Concluídas" 
          value={stats.completed} 
          subtext="Testes finalizados" 
          icon={CheckCircle} 
          colorClass="bg-teal-500 text-teal-600" 
        />
        <StatCard 
          title="Pendentes" 
          value={stats.pending} 
          subtext="Aguardando realização" 
          icon={Clock} 
          colorClass="bg-orange-500 text-orange-600" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Candidatos por Mês</h3>
          <p className="text-sm text-gray-400 mb-6">Novos cadastros nos últimos meses</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="candidates" fill={ChartColor.Primary} radius={[4, 4, 0, 0]} barSize={40} name="Candidatos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Status das Avaliações</h3>
          <p className="text-sm text-gray-400 mb-6">Distribuição atual</p>
          <div className="h-64 w-full flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => {
                     let color: string = ChartColor.Neutral;
                     if (entry.name === 'Concluídos') color = ChartColor.Primary;
                     if (entry.name === 'Em Progresso') color = '#a7f3d0';
                     if (entry.name === 'Pendentes') color = ChartColor.Neutral;
                     return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Candidates List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Candidatos Recentes</h3>
          <p className="text-sm text-gray-400">Últimos candidatos cadastrados no sistema</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teste</th>
                <th className="p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Cadastro</th>
                <th className="p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentCandidates.length > 0 ? (
                recentCandidates.map((candidate: any) => (
                    <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-gray-800">{candidate.name || 'Sem nome'}</td>
                    <td className="p-4 text-sm text-gray-500">{candidate.email}</td>
                    <td className="p-4 text-sm text-gray-500">
                        {candidate.tests?.title || '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                        {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${candidate.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            candidate.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                        {candidate.status === 'completed' ? 'Concluído' : 
                        candidate.status === 'in-progress' ? 'Em Progresso' : 'Pendente'}
                        </span>
                    </td>
                    </tr>
                ))
              ) : (
                <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-gray-400">Nenhum candidato recente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};