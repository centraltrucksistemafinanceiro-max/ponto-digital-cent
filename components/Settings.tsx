import React, { useState } from 'react';
import { AppConfig } from '../App';

interface SettingsProps {
    initialConfig: AppConfig;
    onSave: (config: AppConfig) => void;
    onExport: () => Promise<void>;
    onImport: (fileContent: string) => Promise<{ success: boolean, message: string }>;
}

const Settings: React.FC<SettingsProps> = ({ initialConfig, onSave, onExport, onImport }) => {
    const [config, setConfig] = useState(initialConfig);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'loading', text: string } | null>(null);

    // Update local state when initialConfig prop changes
    React.useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: parseFloat(e.target.value) || 0 });
        setStatusMessage(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(config);
        setStatusMessage({type: 'success', text: 'Configurações salvas com sucesso!'});
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleExportClick = async () => {
        setStatusMessage({ type: 'loading', text: 'Exportando dados...' });
        await onExport();
        setStatusMessage({ type: 'success', text: 'Dados exportados com sucesso!' });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Atenção: A importação substituirá TODOS os dados existentes com base nos IDs do arquivo. Esta ação não pode ser desfeita. Deseja continuar?")) {
            // Reset file input
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            setStatusMessage({ type: 'loading', text: 'Importando dados...' });
            const result = await onImport(content);
            if (result.success) {
                setStatusMessage({ type: 'success', text: result.message });
            } else {
                setStatusMessage({ type: 'error', text: result.message });
            }
        };
        reader.onerror = () => {
             setStatusMessage({ type: 'error', text: 'Erro ao ler o arquivo.' });
        };
        reader.readAsText(file);
        // Reset file input so the same file can be selected again
        e.target.value = '';
    };

    const getStatusMessageColor = () => {
        if (!statusMessage) return '';
        switch (statusMessage.type) {
            case 'success': return 'text-green-400';
            case 'error': return 'text-red-400';
            case 'loading': return 'text-yellow-400';
            default: return '';
        }
    };

    return (
        <div className="bg-secondary p-4 sm:p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-light">Configurações Gerais</h2>
            <p className="text-highlight mb-6">
                Defina os parâmetros de funcionamento do sistema de ponto.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset className="border border-accent rounded-lg p-4">
                    <legend className="text-lg font-medium text-light px-2">Geolocalização</legend>
                    <p className="text-sm text-highlight mb-4">
                        Garanta que os funcionários só possam registrar o ponto quando estiverem fisicamente no local de trabalho.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="latitude" className="block text-sm font-medium text-highlight">Latitude</label>
                            <input
                                type="number"
                                id="latitude"
                                name="latitude"
                                value={config.latitude}
                                onChange={handleChange}
                                required
                                step="any"
                                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                placeholder="-20.85411"
                            />
                        </div>
                        <div>
                            <label htmlFor="longitude" className="block text-sm font-medium text-highlight">Longitude</label>
                            <input
                                type="number"
                                id="longitude"
                                name="longitude"
                                value={config.longitude}
                                onChange={handleChange}
                                required
                                step="any"
                                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                placeholder="-49.34039"
                            />
                        </div>
                        <div>
                            <label htmlFor="radius" className="block text-sm font-medium text-highlight">Raio Permitido (em metros)</label>
                            <input
                                type="number"
                                id="radius"
                                name="radius"
                                value={config.radius}
                                onChange={handleChange}
                                required
                                min="1"
                                className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                placeholder="50"
                            />
                        </div>
                    </div>
                </fieldset>

                 <fieldset className="border border-accent rounded-lg p-4">
                    <legend className="text-lg font-medium text-light px-2">Jornada de Trabalho</legend>
                     <p className="text-sm text-highlight mb-4">
                        Defina a carga horária padrão para o cálculo do banco de horas.
                    </p>
                    <div>
                        <label htmlFor="workdayHours" className="block text-sm font-medium text-highlight">Jornada de Trabalho Padrão (em horas)</label>
                        <input
                            type="number"
                            id="workdayHours"
                            name="workdayHours"
                            value={config.workdayHours}
                            onChange={handleChange}
                            required
                            min="1"
                            step="0.1"
                            className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                            placeholder="8"
                        />
                    </div>
                 </fieldset>

                <div className="flex items-center justify-end pt-2">
                    {statusMessage && statusMessage.type === 'success' && <p className="text-green-400 text-sm mr-4">{statusMessage.text}</p>}
                    <button
                        type="submit"
                        className="justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
                    >
                        Salvar
                    </button>
                </div>
            </form>

            <fieldset className="border border-accent rounded-lg p-4 mt-8">
                <legend className="text-lg font-medium text-light px-2">Backup e Restauração</legend>
                <p className="text-sm text-highlight mb-4">
                    Exporte todos os dados (usuários e registros) para um arquivo JSON ou importe um backup para restaurar o sistema.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold text-light mb-2">Exportar Dados</h4>
                        <button
                            onClick={handleExportClick}
                            disabled={statusMessage?.type === 'loading'}
                            className="w-full justify-center py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-blue-500 transition disabled:bg-gray-500"
                        >
                            Exportar Backup (JSON)
                        </button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-light mb-2">Importar Dados</h4>
                        <label
                            htmlFor="import-file"
                            className="w-full text-center cursor-pointer py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-yellow-500 transition block"
                        >
                            Importar Arquivo (JSON)
                        </label>
                        <input
                            type="file"
                            id="import-file"
                            className="hidden"
                            accept=".json"
                            onChange={handleImportFile}
                            disabled={statusMessage?.type === 'loading'}
                        />
                    </div>
                </div>
                 <div className="mt-4 text-center">
                    <p className="text-xs text-red-400 font-semibold">
                        Atenção: A importação é uma operação destrutiva e substituirá os dados existentes. Recomenda-se exportar um backup antes de prosseguir.
                    </p>
                    <p className="text-xs text-highlight mt-1">
                        Esta operação restaura apenas os dados do banco de dados (Firestore), não as contas de autenticação dos usuários (logins e senhas).
                    </p>
                </div>
                 {statusMessage && (
                    <div className={`mt-4 text-center text-sm font-medium ${getStatusMessageColor()}`}>
                        {statusMessage.text}
                    </div>
                 )}
            </fieldset>

        </div>
    );
};

export default Settings;