import React, { useState } from 'react';
import { User, TimeEntry, Role } from '../types';
import { AppConfig } from '../App';
import TimeReport from './TimeReport';
import UserManagement from './UserManagement';
import Settings from './Settings';
import { ReportsIcon, UsersIcon, SettingsIcon } from './icons';

interface AdminDashboardProps {
  users: User[];
  timeEntries: TimeEntry[];
  // FIX: Renamed `password_hash` parameter to `password` for clarity.
  onAddUser: (user: Omit<User, 'id'>, password: string) => void;
  // FIX: Renamed prop to follow camelCase convention.
  onUpdateTimeEntry: (entry: TimeEntry) => void;
  onUpdateUser: (user: User) => void;
  appConfig: AppConfig;
  onUpdateAppConfig: (config: AppConfig) => void;
  onExportData: () => Promise<void>;
  onImportData: (fileContent: string) => Promise<{ success: boolean, message: string }>;
  onTriggerPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
}

type Tab = 'reports' | 'users' | 'settings';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    users, 
    timeEntries, 
    onAddUser, 
    onUpdateTimeEntry, 
    onUpdateUser, 
    appConfig, 
    onUpdateAppConfig,
    onExportData,
    onImportData,
    onTriggerPasswordReset,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  const employeeUsers = users.filter(u => u.role === Role.EMPLOYEE);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">Select a tab</label>
          <select
            id="tabs"
            name="tabs"
            className="block w-full focus:ring-highlight focus:border-highlight border-accent rounded-md bg-secondary text-light"
            onChange={(e) => setActiveTab(e.target.value as Tab)}
            value={activeTab}
          >
            <option value="reports">Relatório de Ponto</option>
            <option value="users">Gerenciar Funcionários</option>
            <option value="settings">Configurações</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-accent">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('reports')}
                className={`${
                  activeTab === 'reports'
                    ? 'border-highlight text-light'
                    : 'border-transparent text-highlight hover:text-light hover:border-gray-500'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <ReportsIcon />
                <span>Relatório de Ponto</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`${
                  activeTab === 'users'
                    ? 'border-highlight text-light'
                    : 'border-transparent text-highlight hover:text-light hover:border-gray-500'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <UsersIcon />
                <span>Gerenciar Funcionários</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${
                  activeTab === 'settings'
                    ? 'border-highlight text-light'
                    : 'border-transparent text-highlight hover:text-light hover:border-gray-500'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <SettingsIcon />
                <span>Configurações</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
      
      <div>
        {activeTab === 'reports' && (
          <TimeReport 
            users={employeeUsers} 
            timeEntries={timeEntries} 
            onUpdateTimeEntry={onUpdateTimeEntry} 
            workdayHours={appConfig.workdayHours}
          />
        )}
        {activeTab === 'users' && (
          <UserManagement users={users} onAddUser={onAddUser} onUpdateUser={onUpdateUser} onTriggerPasswordReset={onTriggerPasswordReset} />
        )}
        {activeTab === 'settings' && (
          <Settings 
            initialConfig={appConfig} 
            onSave={onUpdateAppConfig} 
            onExport={onExportData}
            onImport={onImportData}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
