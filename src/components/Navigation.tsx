import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Grid3X3,
  Award,
  Trophy,
  Target,
  Wand2,
  Megaphone,
  SearchCode,
  Crown,
  Clock,
  DollarSign,
  BookOpen,
  Sparkles,
} from 'lucide-react';

export type ActiveTab =
  | 'overall'
  | 'adoption'
  | 'teams'
  | 'benchmarking'
  | 'matrix'
  | 'certifications'
  | 'curriculum'
  | 'campaigns'
  | 'talent'
  | 'gamification'
  | 'pulse'
  | 'finance'
  | 'goals'
  | 'catalog'
  | 'ai';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

type GroupName = 'Analítica' | 'Talento y Acción' | 'Dirección e IA';

interface TabItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
  group: GroupName;
  accent: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  highlight?: boolean;
}

const ACCENT_STYLES: Record<
  TabItem['accent'],
  { activePill: string; activeIcon: string; idleIcon: string }
> = {
  blue: {
    activePill: 'bg-[#E8F0FE] text-[#174EA6] border-[#AECBFA]',
    activeIcon: 'text-[#1A73E8]',
    idleIcon: 'text-[#4285F4]',
  },
  green: {
    activePill: 'bg-[#E6F4EA] text-[#137333] border-[#A8DAB5]',
    activeIcon: 'text-[#1E8E3E]',
    idleIcon: 'text-[#34A853]',
  },
  yellow: {
    activePill: 'bg-[#FEF7E0] text-[#B06000] border-[#FDD663]',
    activeIcon: 'text-[#E37400]',
    idleIcon: 'text-[#F9AB00]',
  },
  red: {
    activePill: 'bg-[#FCE8E6] text-[#A50E0E] border-[#F6AEA9]',
    activeIcon: 'text-[#D93025]',
    idleIcon: 'text-[#EA4335]',
  },
  purple: {
    activePill: 'bg-[#F3E8FD] text-[#681DA8] border-[#D7AEFB]',
    activeIcon: 'text-[#9334E6]',
    idleIcon: 'text-[#A142F4]',
  },
};

const GROUP_DOT_COLOR: Record<GroupName, string> = {
  Analítica: 'bg-[#4285F4]',
  'Talento y Acción': 'bg-[#34A853]',
  'Dirección e IA': 'bg-[#EA4335]',
};

const GROUP_ACTIVE_TEXT: Record<GroupName, string> = {
  Analítica: 'text-[#1A73E8]',
  'Talento y Acción': 'text-[#1E8E3E]',
  'Dirección e IA': 'text-[#D93025]',
};

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs: TabItem[] = [
    // Analítica
    { id: 'overall', label: 'Panel General', icon: LayoutDashboard, group: 'Analítica', accent: 'blue' },
    { id: 'adoption', label: 'Adopción y Licencias', icon: UserCheck, group: 'Analítica', accent: 'green' },
    { id: 'teams', label: 'Equipos y Perfiles', icon: Users, group: 'Analítica', accent: 'blue' },
    { id: 'benchmarking', label: 'Comparador', icon: Trophy, group: 'Analítica', accent: 'yellow' },
    { id: 'matrix', label: 'Matriz Habilidades', icon: Grid3X3, group: 'Analítica', accent: 'purple' },
    { id: 'pulse', label: 'Hábitos y Horarios', icon: Clock, group: 'Analítica', accent: 'green' },

    // Talento y Acción (LXP)
    { id: 'certifications', label: 'Certificaciones', icon: Award, group: 'Talento y Acción', accent: 'yellow' },
    { id: 'curriculum', label: 'Rutas con IA', icon: Wand2, group: 'Talento y Acción', accent: 'purple', highlight: true },
    { id: 'talent', label: 'Buscador Talento', icon: SearchCode, group: 'Talento y Acción', accent: 'blue' },
    { id: 'campaigns', label: 'Campañas Activación', icon: Megaphone, group: 'Talento y Acción', accent: 'red' },
    { id: 'gamification', label: 'Liga XP y Logros', icon: Crown, group: 'Talento y Acción', accent: 'yellow' },
    { id: 'catalog', label: 'Catálogo', icon: BookOpen, group: 'Talento y Acción', accent: 'green' },

    // Dirección e IA
    { id: 'finance', label: 'Simulador Financiero', icon: DollarSign, group: 'Dirección e IA', accent: 'green' },
    { id: 'goals', label: 'OKRs y Reportes', icon: Target, group: 'Dirección e IA', accent: 'blue' },
    { id: 'ai', label: 'Chat Inteligencia', icon: Sparkles, group: 'Dirección e IA', accent: 'purple', highlight: true },
  ];

  const activeGroup = tabs.find((t) => t.id === activeTab)?.group || 'Analítica';

  return (
    <div className="border-b border-[#DADCE0] bg-white/90 sticky top-[68px] z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 space-y-2">
        {/* Category Quick Jump Pills */}
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-wider font-bold">
          {(['Analítica', 'Talento y Acción', 'Dirección e IA'] as const).map((grp) => {
            const isGrp = activeGroup === grp;
            const firstTabInGroup = tabs.find((t) => t.group === grp)!;
            return (
              <button
                key={grp}
                onClick={() => onTabChange(firstTabInGroup.id)}
                className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isGrp ? GROUP_ACTIVE_TEXT[grp] : 'text-[#5F6368] hover:text-[#202124]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${GROUP_DOT_COLOR[grp]} ${
                    isGrp ? 'opacity-100 scale-110' : 'opacity-45'
                  } transition-all`}
                />
                <span>{grp}</span>
              </button>
            );
          })}
        </div>

        {/* All Module Pills */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const styles = ACCENT_STYLES[tab.accent];
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-150 whitespace-nowrap shrink-0 border cursor-pointer ${
                  isActive
                    ? `${styles.activePill} font-semibold shadow-2xs`
                    : 'text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] border-transparent font-medium'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 transition-transform group-hover:scale-105 ${
                    isActive ? styles.activeIcon : styles.idleIcon
                  }`}
                />
                <span>{tab.label}</span>
                {tab.highlight && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-gradient-to-r from-[#E8F0FE] to-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB]">
                    IA
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
