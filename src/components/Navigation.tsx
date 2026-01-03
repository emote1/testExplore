import { Button } from './ui/button';
import { Search, Wallet, Box } from 'lucide-react';

type AppPage = 'search' | 'wallet';

interface NavigationProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
}

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const navItems = [
    { id: 'search' as AppPage, label: 'Search', icon: Search },
    { id: 'wallet' as AppPage, label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-lg flex items-center justify-center animate-pulse shadow-lg shadow-[#2563EB]/20">
                <Box className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent">
                BlockExplorer
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => onPageChange(item.id)}
                    className={`flex items-center space-x-2 group transition-all duration-200 hover:scale-105 ${
                      isActive 
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] !text-white shadow-md hover:from-[#3B82F6] hover:to-[#60A5FA]' 
                        : '!text-slate-600 hover:!text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
