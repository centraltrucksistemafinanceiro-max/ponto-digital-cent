import React, { useState, useMemo, useEffect } from 'react';
import { User, TimeEntry, TimeEntryType } from '../types';
import { AppConfig } from '../App';
import Modal from './Modal';
import { EditIcon, ClockIcon } from './icons';

interface EmployeeDashboardProps {
  user: User;
  timeEntries: TimeEntry[];
  onAddTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  // FIX: Renamed prop to follow camelCase convention.
  onUpdateTimeEntry: (entry: TimeEntry) => void;
  appConfig: AppConfig;
}

interface ProcessedDayEntry {
    date: string;
    entrada?: Date;
    inicioIntervalo?: Date;
    fimIntervalo?: Date;
    saida?: Date;
    workedHours: number;
    balance: number;
    status: string;
    observation: string;
    originalEntries: TimeEntry[];
}

const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}


// Haversine formula to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, timeEntries, onAddTimeEntry, onUpdateTimeEntry, appConfig }) => {
  const [observation, setObservation] = useState('');
  const [editingDay, setEditingDay] = useState<ProcessedDayEntry | null>(null);
  const [locationState, setLocationState] = useState<'checking' | 'allowed' | 'denied' | 'error'>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState('error');
      setLocationError('Geolocalização não é suportada neste navegador.');
      return;
    }

    const { latitude: targetLatitude, longitude: targetLongitude, radius: allowedRadius } = appConfig;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(latitude, longitude, targetLatitude, targetLongitude);

        if (distance <= allowedRadius) {
          setLocationState('allowed');
          setLocationError(null);
        } else {
          setLocationState('denied');
          setLocationError(`Você está a ${distance.toFixed(0)} metros do local de trabalho. O raio permitido é de ${allowedRadius}m.`);
        }
      },
      (error) => {
        setLocationState('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permissão de localização negada. Habilite para registrar o ponto.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Informações de localização não estão disponíveis.');
            break;
          case error.TIMEOUT:
            setLocationError('A solicitação para obter a localização expirou.');
            break;
          default:
            setLocationError('Ocorreu um erro ao obter a localização.');
            break;
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [appConfig]);
  
  const todayEntries = useMemo(() => {
    const now = new Date();
    return timeEntries
      .filter(entry => isSameDay(entry.timestamp, now))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [timeEntries]);
  
  const lastAction = useMemo(() => {
    return todayEntries.length > 0 ? todayEntries[todayEntries.length - 1].type : null;
  }, [todayEntries]);

  const handleRegister = (type: TimeEntryType) => {
    onAddTimeEntry({
      userId: user.id,
      timestamp: new Date(),
      type,
      observation,
    });
    setObservation('');
  };

  const actionButtons = [
    { type: TimeEntryType.ENTRADA, label: 'Registrar Entrada', enabled: !lastAction || lastAction === TimeEntryType.SAIDA },
    { type: TimeEntryType.INICIO_INTERVALO, label: 'Início Intervalo', enabled: lastAction === TimeEntryType.ENTRADA },
    { type: TimeEntryType.FIM_INTERVALO, label: 'Fim Intervalo', enabled: lastAction === TimeEntryType.INICIO_INTERVALO },
    { type: TimeEntryType.SAIDA, label: 'Registrar Saída', enabled: lastAction === TimeEntryType.ENTRADA || lastAction === TimeEntryType.FIM_INTERVALO },
  ];

  const processedDailyEntries: ProcessedDayEntry[] = useMemo(() => {
    const groupedByDay: { [key: string]: TimeEntry[] } = {};

    timeEntries.forEach(entry => {
      const dateKey = entry.timestamp.toLocaleDateString('pt-BR');
      if (!groupedByDay[dateKey]) {
        groupedByDay[dateKey] = [];
      }
      groupedByDay[dateKey].push(entry);
    });

    const processed = Object.values(groupedByDay).map(dayEntries => {
        const sortedEntries = dayEntries.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        const entrada = sortedEntries.find(e => e.type === TimeEntryType.ENTRADA);
        const inicioIntervalo = sortedEntries.find(e => e.type === TimeEntryType.INICIO_INTERVALO);
        const fimIntervalo = sortedEntries.find(e => e.type === TimeEntryType.FIM_INTERVALO);
        const saida = sortedEntries.find(e => e.type === TimeEntryType.SAIDA);
        
        let workedMillis = 0;
        if (entrada && saida) {
            const totalMillis = saida.timestamp.getTime() - entrada.timestamp.getTime();
            let breakMillis = 0;
            if (inicioIntervalo && fimIntervalo) {
            breakMillis = fimIntervalo.timestamp.getTime() - inicioIntervalo.timestamp.getTime();
            }
            workedMillis = totalMillis - breakMillis;
        }
        
        const workedHours = workedMillis > 0 ? (workedMillis / (1000 * 60 * 60)) : 0;
        const balance = (entrada && saida) ? workedHours - appConfig.workdayHours : 0;

        const status = (entrada && saida) ? "Completo" : "Incompleto";
        const observation = sortedEntries.map(e => e.observation).filter(Boolean).join('; ');

        return {
            date: sortedEntries[0].timestamp.toLocaleDateString('pt-BR'),
            entrada: entrada?.timestamp,
            inicioIntervalo: inicioIntervalo?.timestamp,
            fimIntervalo: fimIntervalo?.timestamp,
            saida: saida?.timestamp,
            workedHours,
            balance,
            status,
            observation,
            originalEntries: sortedEntries,
        };
    });

    return processed.sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateB.getTime() - dateA.getTime();
    });
  }, [timeEntries, appConfig.workdayHours]);

  const totalWorkedHours = useMemo(() => {
    return processedDailyEntries.reduce((acc, curr) => acc + curr.workedHours, 0);
  }, [processedDailyEntries]);

  const formatTime = (date?: Date) => date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--';

  const renderLocationStatus = () => {
    if (locationState === 'checking') {
      return (
        <div className="text-center p-3 mb-4 bg-primary rounded-md text-highlight">
          Verificando sua localização...
        </div>
      );
    }
    if (locationError) {
      return (
        <div className="text-center p-3 mb-4 bg-red-900/70 rounded-md text-red-200">
          {locationError}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-secondary p-4 sm:p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-light">Registrar Ponto</h2>
            {renderLocationStatus()}
            <div className="mb-4">
                <label htmlFor="observation" className="block text-sm font-medium text-highlight mb-1">
                    Observação (opcional)
                </label>
                <input
                    type="text"
                    id="observation"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    className="w-full bg-primary border border-accent rounded-md px-3 py-2 text-light focus:ring-highlight focus:border-highlight"
                    placeholder="Ex: Reunião externa"
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actionButtons.map(btn => (
                <button
                key={btn.type}
                onClick={() => handleRegister(btn.type)}
                disabled={!btn.enabled || locationState !== 'allowed'}
                className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                    ${(btn.enabled && locationState === 'allowed')
                    ? 'bg-accent hover:bg-highlight' 
                    : 'bg-gray-500 cursor-not-allowed opacity-50'}`}
                >
                {btn.label}
                </button>
            ))}
            </div>
        </div>
      </div>
      
      <div className="bg-secondary p-4 sm:p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-light">Meus Registros</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-accent">
            <thead className="bg-primary">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Entrada</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Início Intervalo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Fim Intervalo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Saída</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Horas Trab.</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Observação</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-secondary divide-y divide-accent">
              {processedDailyEntries.map(day => (
                <tr key={day.date}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{day.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(day.entrada)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(day.inicioIntervalo)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(day.fimIntervalo)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(day.saida)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{day.workedHours.toFixed(2)}h</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{day.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light max-w-xs truncate" title={day.observation}>{day.observation}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-light text-center">
                    <button onClick={() => setEditingDay(day)} className="text-highlight hover:text-light p-1 rounded-full hover:bg-accent transition">
                        <EditIcon />
                    </button>
                  </td>
                </tr>
              ))}
               {processedDailyEntries.length === 0 && (
                <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-highlight">Nenhum registro encontrado.</td>
                </tr>
               )}
            </tbody>
            <tfoot className="bg-primary">
                <tr>
                    <td colSpan={5} className="px-6 py-4 text-right text-sm font-bold text-highlight uppercase tracking-wider">Totais</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-light">{totalWorkedHours.toFixed(2)}h</td>
                    <td colSpan={3}></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {editingDay && (
        <EditObservationModal
            day={editingDay}
            onClose={() => setEditingDay(null)}
            onSave={onUpdateTimeEntry}
        />
      )}
    </div>
  );
};

interface EditObservationModalProps {
    day: ProcessedDayEntry;
    onClose: () => void;
    onSave: (entry: TimeEntry) => void;
}

const EditObservationModal: React.FC<EditObservationModalProps> = ({ day, onClose, onSave }) => {
    const [entries, setEntries] = useState<TimeEntry[]>(day.originalEntries);

    const handleObservationChange = (id: string, newObservation: string) => {
        setEntries(prev => prev.map(e => e.id === id ? {...e, observation: newObservation} : e));
    };

    const handleSave = () => {
        entries.forEach(entry => {
            onSave(entry);
});
        onClose();
    };

    const formatTime = (date?: Date) => date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--';

    return (
        <Modal isOpen={true} onClose={onClose} title={`Editar Observações - ${day.date}`}>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {entries.map(entry => (
                    <div key={entry.id} className="p-3 bg-primary rounded-md">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-highlight">{entry.type}</h4>
                            <span className="text-sm text-gray-400">{formatTime(entry.timestamp)}</span>
                        </div>
                        <div>
                            <label htmlFor={`obs-${entry.id}`} className="block text-xs font-medium text-highlight">Observação</label>
                            <input
                                id={`obs-${entry.id}`}
                                type="text"
                                value={entry.observation}
                                onChange={(e) => handleObservationChange(entry.id, e.target.value)}
                                className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                            />
                        </div>
                    </div>
                ))}
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


export default EmployeeDashboard;