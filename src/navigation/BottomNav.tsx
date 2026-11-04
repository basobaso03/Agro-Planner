import React from 'react';
import { Home, Layers, DollarSign, Menu, Package } from 'lucide-react';
import { TabId } from './routes.ts';
import { useNavigation } from './useNavigation.ts';

export interface BottomNavProps {
  isAgroEnabled: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ isAgroEnabled }) => {
  const { activeTab, switchTab } = useNavigation();

  return (
    <nav
      role="navigation"
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8DFCE] pb-safe"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {/* Tab 1: Overview */}
        <button
          type="button"
          onClick={() => switchTab('overview')}
          className={`flex-1 flex flex-col items-center justify-center h-full py-1 transition-all cursor-pointer ${
            activeTab === 'overview' ? 'text-emerald-700 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              activeTab === 'overview' ? 'bg-emerald-100/70 text-emerald-800 scale-105' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Overview</span>
        </button>

        {/* Tab 2: Livestock (Agro) or Operations (General) */}
        <button
          type="button"
          onClick={() => switchTab('operations')}
          className={`flex-1 flex flex-col items-center justify-center h-full py-1 transition-all cursor-pointer ${
            activeTab === 'operations' ? 'text-emerald-700 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              activeTab === 'operations' ? 'bg-emerald-100/70 text-emerald-800 scale-105' : ''
            }`}
          >
            {isAgroEnabled ? <Layers className="w-5 h-5" /> : <Package className="w-5 h-5" />}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">{isAgroEnabled ? 'Livestock' : 'Operations'}</span>
        </button>

        {/* Tab 3: Money */}
        <button
          type="button"
          onClick={() => switchTab('money')}
          className={`flex-1 flex flex-col items-center justify-center h-full py-1 transition-all cursor-pointer ${
            activeTab === 'money' ? 'text-emerald-700 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              activeTab === 'money' ? 'bg-emerald-100/70 text-emerald-800 scale-105' : ''
            }`}
          >
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Money</span>
        </button>

        {/* Tab 4: More */}
        <button
          type="button"
          onClick={() => switchTab('more')}
          className={`flex-1 flex flex-col items-center justify-center h-full py-1 transition-all cursor-pointer ${
            activeTab === 'more' ? 'text-emerald-700 font-black' : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              activeTab === 'more' ? 'bg-emerald-100/70 text-emerald-800 scale-105' : ''
            }`}
          >
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">More</span>
        </button>
      </div>
    </nav>
  );
};

