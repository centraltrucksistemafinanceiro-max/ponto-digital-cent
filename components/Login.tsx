import React, { useState, useEffect } from 'react';
import { EyeIcon, EyeOffIcon, UserIcon, LockIcon, ClockGraphicIcon } from './icons';

interface LoginProps {
  onLogin: (nameOrEmail: string, password: string, rememberMe: boolean) => Promise<{success: boolean; error?: string}>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setName(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (rememberMe) {
      localStorage.setItem('rememberedUsername', name);
    } else {
      localStorage.removeItem('rememberedUsername');
    }

    const result = await onLogin(name, password, rememberMe);
    if (!result.success) {
      setError(result.error || 'Nome de usuário ou senha inválidos.');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 selection:bg-highlight/30">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 shadow-2xl rounded-2xl overflow-hidden animate-fade-in">
            {/* Left Column - Branding */}
            <div className="flex flex-col items-center justify-center p-8 md:p-12 bg-secondary text-light text-center space-y-6 bg-gradient-to-br from-secondary to-primary">
                <ClockGraphicIcon className="w-24 h-24 md:w-32 md:h-32" />
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bem-vindo de volta!</h1>
                <p className="text-highlight">Faça login para registrar suas horas e gerenciar sua equipe com eficiência.</p>
            </div>

            {/* Right Column - Form */}
            <div className="w-full p-6 sm:p-10 space-y-8 bg-secondary/80 backdrop-blur-md">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-light">Acessar sua Conta</h2>
                    <p className="mt-2 text-sm text-highlight">Use seu nome de usuário ou e-mail.</p>
                </div>
                
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon />
                            </div>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="appearance-none relative block w-full px-3 py-3 pl-10 border border-accent bg-primary/50 placeholder-highlight text-light rounded-md focus:outline-none focus:ring-2 focus:ring-highlight focus:border-transparent sm:text-sm transition"
                                placeholder="Nome de usuário ou e-mail"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockIcon />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="appearance-none relative block w-full px-3 py-3 pl-10 border border-accent bg-primary/50 placeholder-highlight text-light rounded-md focus:outline-none focus:ring-2 focus:ring-highlight focus:border-transparent sm:text-sm transition pr-10"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-highlight hover:text-light"
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        <label htmlFor="remember-me" className="flex items-center cursor-pointer text-sm text-highlight">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-highlight bg-primary border-accent rounded focus:ring-highlight focus:ring-offset-2 focus:ring-offset-secondary"
                            />
                            <span className="ml-2">Lembrar-me</span>
                        </label>
                    </div>

                    {error && <p className="text-red-400 text-sm text-center animate-shake">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-accent to-highlight hover:from-highlight hover:to-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </div>
                </form>
                <div className="text-center">
                    <p className="text-sm text-highlight">
                        Esqueceu a senha? Entre em contato com o administrador para redefini-la.
                    </p>
                </div>
            </div>
        </div>
    </main>
  );
};

export default Login;