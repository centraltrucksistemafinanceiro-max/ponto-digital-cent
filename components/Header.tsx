
import React from 'react';
import { User } from '../types';
import { LogoutIcon } from './icons';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, className }) => {
  return (
    <header className={`bg-secondary shadow-md ${className || ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-light">Ponto Digital</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-highlight">
              Olá, <span className="font-medium text-light">{user.name}</span>
            </span>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 text-highlight hover:text-light transition-colors duration-150 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight"
              aria-label="Sair do sistema"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;