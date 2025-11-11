import React, { useState } from 'react';
import { User, Role } from '../types';
import Modal from './Modal';
import { EditIcon } from './icons';

interface UserManagementProps {
  users: User[];
  // FIX: Renamed `password_hash` to `password` for clarity.
  onAddUser: (user: Omit<User, 'id'>, password: string) => void;
  onUpdateUser: (user: User) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onAddUser, onUpdateUser }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.EMPLOYEE);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
          <h2 className="text-2xl font-bold mb-4 text-light">Usuários Cadastrados</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-accent">
              <thead className="bg-primary">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">E-mail</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Cargo</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <button onClick={() => setEditingUser(user)} className="text-highlight hover:text-light">
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
        />
      )}
    </>
  );
};

interface EditUserModalProps {
    user: User;
    onClose: () => void;
    onSave: (user: User) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user.name);
    const [role, setRole] = useState(user.role);
    
    const handleSave = () => {
        const updatedUser = {
            ...user,
            name,
            role,
        };
        onSave(updatedUser);
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
                <p className="text-xs text-highlight text-center pt-2">A alteração de senha deve ser feita através do painel do Firebase ou por um fluxo de "esqueci minha senha".</p>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
                <button
                    onClick={onClose}
                    className="py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-light hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
                >
                    Salvar Alterações
                </button>
            </div>
        </Modal>
    );
};

export default UserManagement;
