import React from 'react';
import { LayoutDashboard, Users, FileText, BarChart2, LogOut, Hexagon, ShieldCheck } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
}

export const AdminSidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, userName, userEmail }) => {
  const NavItem = ({ view, label, icon: Icon }: { view: ViewState; label: string; icon: any }) => (
    <button
      onClick={() => onChangeView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors mb-1
        ${currentView === view 
          ? 'bg-emerald-600 text-white shadow-md' 
          : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
    >
      <Icon size={20} />
      {label}
    </button>
  );

  const getInitials = (name: string) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-10">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg">
          <Hexagon fill="currentColor" className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight leading-tight">Save Co</h1>
          <p className="text-xs text-emerald-600 font-medium">Essentials Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-6">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Menu Principal</p>
          <NavItem view="dashboard" label="Dashboard" icon={LayoutDashboard} />
          <NavItem view="candidates" label="Candidatos" icon={Users} />
          <NavItem view="tests" label="Testes" icon={FileText} />
          <NavItem view="results" label="Resultados" icon={BarChart2} />
        </div>
        
        <div className="mb-6">
           <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sistema</p>
           <NavItem view="admin-users" label="Usuários Admin" icon={ShieldCheck} />
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
            {getInitials(userName)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-gray-700 truncate">{userName || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 text-xs font-medium text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
        >
          <LogOut size={14} />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
};