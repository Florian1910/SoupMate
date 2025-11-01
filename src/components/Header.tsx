import { LogIn, LogOut, Menu } from "lucide-react";
import { Button } from "./ui/button";
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";

interface HeaderProps {
  onLoginClick: () => void;
  userName?: string;
  onLogout?: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Header({ onLoginClick, userName, onLogout, onToggleSidebar, isSidebarOpen }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-[#ff9966] via-[#ffb085] to-[#ff9966] text-primary-foreground px-8 py-8 shadow-2xl relative">
      <Button
        onClick={onToggleSidebar}
        variant="ghost"
        size="icon"
        className="absolute left-6 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110"
      >
        <Menu size={24} />
      </Button>
      <div className="flex items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff6b35] via-[#ff8c5a] to-[#ffb085] blur-md opacity-60"></div>
          <img 
            src={logo} 
            alt="SoupMate Logo" 
            className="w-20 h-20 rounded-full border-4 border-white shadow-2xl relative z-10 object-cover"
          />
        </div>
        <h1 className="text-5xl bg-gradient-to-br from-white via-orange-50 to-orange-100 bg-clip-text text-transparent drop-shadow-lg tracking-wide" style={{ fontFamily: 'var(--font-welcome)' }}>
          <span className="font-bold">S</span>oup<span className="font-bold">M</span>ate
        </h1>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-8">
        {userName ? (
          <Button 
            onClick={onLogout}
            variant="outline" 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        ) : (
          <Button 
            onClick={onLoginClick}
            variant="outline" 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <LogIn size={18} className="mr-2" />
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
