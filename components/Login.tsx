import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

interface LoginProps {
  // FIX: Renamed `password_hash` to `password` for clarity.
  onLogin: (nameOrEmail: string, password: string, rememberMe: boolean) => Promise<{success: boolean; error?: string}>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await onLogin(name, password, rememberMe);
    if (!result.success) {
      setError(result.error || 'Nome de usuário ou senha inválidos.');
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 space-y-8 bg-secondary rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-center text-light">Sistema de Ponto</h2>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-md shadow-sm">
          <div>
            <label htmlFor="name" className="sr-only">Nome de usuário ou E-mail</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-accent bg-primary placeholder-highlight text-light rounded-t-md focus:outline-none focus:ring-highlight focus:border-highlight focus:z-10 sm:text-sm"
              placeholder="Nome de usuário (ex: felipe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="relative">
            {/* FIX: Renamed `password_hash` to `password` for consistency. */}
            <label htmlFor="password" className="sr-only">Senha</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-accent bg-primary placeholder-highlight text-light rounded-b-md focus:outline-none focus:ring-highlight focus:border-highlight focus:z-10 sm:text-sm pr-10"
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
            <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-highlight bg-primary border-accent rounded focus:ring-highlight"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-highlight">
                Lembrar-me
            </label>
        </div>


        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-highlight transition duration-150 ease-in-out disabled:bg-gray-500 disabled:cursor-not-allowed"
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
  );
};

export default Login;
