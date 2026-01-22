import React, { useState } from 'react';
import { User, Role } from '../types';
import Modal from './Modal';
import { EditIcon, KeyIcon } from './icons';

interface UserManagementProps {
  users: User[];
  // FIX: Renamed `password_hash` to `password` for clarity.
  onAddUser: (user: Omit<User, 'id'>, password: string) => void;
  onUpdateUser: (user: User) => void;
  onTriggerPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onAddUser, onUpdateUser, onTriggerPasswordReset }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.EMPLOYEE);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && password && email) {
      onAddUser({ name, email, role }, password);
      setName('');
      setEmail('');
      setPassword('');
      setRole(Role.EMPLOYEE);
    }
  };

  const handleSaveUser = (updatedUser: User) => {
    onUpdateUser(updatedUser);
    setEditingUser(null);
  };

  const handleTriggerReset = async (userEmail: string) => {
    setNotification(null);
    const result = await onTriggerPasswordReset(userEmail);
    setNotification({
        type: result.success ? 'success' : 'error',
        text: result.message
    });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-secondary p-4 sm:p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-light">Adicionar Usuário</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-user-name" className="block text-sm font-medium text-highlight">Nome</label>
              <input
                type="text"
                id="new-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
              />
            </div>
             <div>
              <label htmlFor="new-user-email" className="block text-sm font-medium text-highlight">E-mail</label>
              <input
                type="email"
                id="new-user-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-user-password" className="block text-sm font-medium text-highlight">Senha</label>
              <input
                type="password"
                id="new-user-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
              />
            </div>
            <div>
                <label htmlFor="new-user-role" className="block text-sm font-medium text-highlight">Cargo</label>
                <select 
                    id="new-user-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                >
                    <option value={Role.EMPLOYEE}>Funcionário</option>
                    <option value={Role.ADMIN}>Administrador</option>
                </select>
            </div>
            <button
              type="submit"
              className="w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
            >
              Adicionar
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-secondary p-4 sm:p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold mb-4 text-light">Usuários Cadastrados</h2>
          </div>
          {notification && (
              <div className={`mb-4 p-3 rounded-md text-sm ${notification.type === 'success' ? 'bg-green-900/70 text-green-200' : 'bg-red-900/70 text-red-200'}`}>
                  {notification.text}
              </div>
          )}
          
          {/* Mobile View: Card List */}
          <div className="md:hidden space-y-3">
            {users.map(user => (
              <div key={user.id} className="bg-primary p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-light">{user.name}</h3>
                    <p className="text-sm text-highlight">{user.email}</p>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <button onClick={() => handleTriggerReset(user.email)} className="text-highlight hover:text-light" aria-label={`Redefinir senha de ${user.name}`}>
                      <KeyIcon />
                    </button>
                    <button onClick={() => setEditingUser(user)} className="text-highlight hover:text-light" aria-label={`Editar ${user.name}`}>
                      <EditIcon />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-accent flex justify-between items-center">
                  <div>
                    <span className="text-sm text-highlight">Cargo: </span>
                    <span className="text-sm font-semibold text-light">{user.role === Role.ADMIN ? 'Administrador' : 'Funcionário'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${user.isActive === false ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                    {user.isActive === false ? 'Inativo' : 'Ativo'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-accent">
              <thead className="bg-primary">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">E-mail</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Cargo</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Status</th>
                   <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-highlight uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-secondary divide-y divide-accent">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{user.email}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-light">
                         {user.role === Role.ADMIN ? 'Administrador' : 'Funcionário'}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-light">
                       <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isActive === false ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                         {user.isActive === false ? 'Inativo' : 'Ativo'}
                       </span>
                     </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right space-x-4">
                        <button onClick={() => handleTriggerReset(user.email)} className="text-highlight hover:text-light" aria-label={`Redefinir senha de ${user.name}`}>
                            <KeyIcon />
                        </button>
                        <button onClick={() => setEditingUser(user)} className="text-highlight hover:text-light" aria-label={`Editar ${user.name}`}>
                            <EditIcon />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && (
        <EditUserModal 
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveUser}
            onTriggerPasswordReset={onTriggerPasswordReset}
        />
      )}
    </>
  );
};

interface EditUserModalProps {
    user: User;
    onClose: () => void;
    onSave: (user: User) => void;
    onTriggerPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave, onTriggerPasswordReset }) => {
    const [name, setName] = useState(user.name);
    const [role, setRole] = useState(user.role);
    const [isActive, setIsActive] = useState(user.isActive !== false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const handleSave = async () => {
        setStatus(null);
        setIsProcessing(true);
        
        // Create a new object for the updated user to ensure reactivity
        const updatedUser = { ...user, name, role, isActive };
        // FIX: The prop is `onSave`, not `onUpdateUser`. This was causing an error.
        onSave(updatedUser);
        
        setStatus({ type: 'success', text: 'Dados salvos com sucesso!' });
        setTimeout(() => setStatus(null), 3000); // Clear status after 3 seconds
        
        setIsProcessing(false);
    };

    const handlePasswordReset = async () => {
        setStatus(null);
        setIsProcessing(true);
        const result = await onTriggerPasswordReset(user.email);
        setStatus({
            type: result.success ? 'success' : 'error',
            text: result.message
        });
        setTimeout(() => setStatus(null), 5000); // Clear status after 5 seconds
        setIsProcessing(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Editar ${user.name}`}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="edit-user-email" className="block text-sm font-medium text-highlight">E-mail (não pode ser alterado)</label>
                    <input
                        type="email"
                        id="edit-user-email"
                        value={user.email}
                        disabled
                        className="mt-1 block w-full bg-primary/50 border border-accent rounded-md shadow-sm py-2 px-3 text-light/70 focus:outline-none sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="edit-user-name" className="block text-sm font-medium text-highlight">Nome</label>
                    <input
                        type="text"
                        id="edit-user-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                    />
                </div>
                 <div>
                    <label htmlFor="edit-user-role" className="block text-sm font-medium text-highlight">Cargo</label>
                    <select
                        id="edit-user-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                    >
                        <option value={Role.EMPLOYEE}>Funcionário</option>
                        <option value={Role.ADMIN}>Administrador</option>
                    </select>
                 </div>
                 <div className="flex items-center space-x-3 p-3 bg-primary rounded-md border border-accent">
                    <input
                        type="checkbox"
                        id="edit-user-active"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 text-highlight bg-secondary border-accent rounded focus:ring-highlight"
                    />
                    <label htmlFor="edit-user-active" className="text-sm font-medium text-light">Conta Ativa (pode fazer login)</label>
                </div>
            </div>

            <div className="border-t border-accent my-6"></div>

            <div>
                <h4 className="text-md font-medium text-highlight mb-2">Redefinir Senha</h4>
                <p className="text-xs text-highlight mb-4">
                    O usuário receberá um e-mail com instruções para criar uma nova senha.
                </p>
                <button
                    onClick={handlePasswordReset}
                    disabled={isProcessing}
                    className="w-full justify-center py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-light hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition disabled:opacity-50"
                >
                    {isProcessing ? 'Enviando...' : 'Enviar E-mail de Redefinição de Senha'}
                </button>
            </div>
            
            {status && (
                <p className={`mt-4 text-sm text-center ${status.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {status.text}
                </p>
            )}

            <div className="mt-6 flex justify-end space-x-4">
                <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className="py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-light hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition disabled:opacity-50"
                >
                    Fechar
                </button>
                <button
                    onClick={handleSave}
                    disabled={isProcessing}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition disabled:bg-gray-500"
                >
                    {isProcessing ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </Modal>
    );
};

export default UserManagement;
