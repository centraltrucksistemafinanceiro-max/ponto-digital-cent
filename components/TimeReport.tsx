import React, { useState, useMemo, useEffect } from 'react';
import { User, TimeEntry, TimeEntryType } from '../types';
import Modal from './Modal';
import { EditIcon, ChartBarIcon, TargetIcon, ClockIcon, WarningIcon, PrintIcon, ExcelIcon, PdfIcon, UserGroupIcon, TrashIcon, PlusCircleIcon } from './icons';

// Add jsPDF and XLSX types to the global window object for use with CDN script
declare global {
  interface Window {
    jspdf: any;
    XLSX: any;
  }
}

interface TimeReportProps {
  users: User[];
  timeEntries: TimeEntry[];
  // FIX: Renamed prop to follow camelCase convention.
  onUpdateTimeEntry: (entry: TimeEntry) => void;
  onDeleteTimeEntry: (entryId: string) => void;
  onAddTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  workdayHours: number;
}

interface ProcessedEntry {
    id: string;
    userId: string;
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
    tags: { text: string; color: string }[];
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; subtitle?: string;}> = ({ icon, title, value, subtitle }) => (
    <div className="bg-primary p-4 rounded-lg flex items-center space-x-4">
        <div>{icon}</div>
        <div>
            <span className="text-2xl font-bold text-light">{value}</span>
            <p className="text-sm text-highlight">{title}</p>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
    </div>
);

const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

const TimeReport: React.FC<TimeReportProps> = ({ users, timeEntries, onUpdateTimeEntry, onDeleteTimeEntry, onAddTimeEntry, workdayHours }) => {
  const [editingDay, setEditingDay] = useState<ProcessedEntry | null>(null);
  const [filters, setFilters] = useState({
    userId: 'all',
    reportType: 'daily',
    startDate: '',
    endDate: '',
  });

  const processedEntries = useMemo(() => {
    const groupedByDay: { [key: string]: { userId: string; date: string; entries: TimeEntry[] } } = {};

    timeEntries.forEach(entry => {
      const dateKey = `${entry.userId}-${entry.timestamp.toLocaleDateString('pt-BR')}`;
      if (!groupedByDay[dateKey]) {
        groupedByDay[dateKey] = {
          userId: entry.userId,
          date: entry.timestamp.toLocaleDateString('pt-BR'),
          entries: [],
        };
      }
      groupedByDay[dateKey].entries.push(entry);
    });

    return Object.values(groupedByDay).map((dayGroup): ProcessedEntry => {
      const sortedEntries = dayGroup.entries.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
      
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
      const balance = (entrada && saida) ? workedHours - workdayHours : 0;
      
      const status = (entrada && saida) ? "Completo" : "Incompleto";
      const observation = sortedEntries.map(e => e.observation).filter(Boolean).join('; ');

      const tags: {text: string, color: string}[] = [];
      if (status === 'Completo') {
        tags.push({text: 'Completo', color: 'bg-green-600'});
        if (workedHours > (workdayHours + 0.5)) { // 0.5 for tolerance
            tags.push({text: 'Hora Extra', color: 'bg-blue-600'});
        }
        if (entrada && entrada.timestamp.getHours() >= 9) {
            tags.push({text: 'Atraso', color: 'bg-red-600'});
        }
      } else {
        tags.push({text: 'Incompleto', color: 'bg-yellow-600'});
      }


      return {
        id: `${dayGroup.userId}-${dayGroup.date}`,
        userId: dayGroup.userId,
        date: dayGroup.date,
        entrada: entrada?.timestamp,
        inicioIntervalo: inicioIntervalo?.timestamp,
        fimIntervalo: fimIntervalo?.timestamp,
        saida: saida?.timestamp,
        workedHours,
        balance,
        status,
        observation,
        originalEntries: sortedEntries,
        tags
      };
    })
    .sort((a, b) => new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime());
  }, [timeEntries, workdayHours]);

  useEffect(() => {
    if (editingDay) {
      const updatedDayData = processedEntries.find(entry => entry.id === editingDay.id);
      if (updatedDayData) {
        setEditingDay(updatedDayData);
      } else {
        setEditingDay(null);
      }
    }
  }, [processedEntries, editingDay]);

  const filteredEntries = useMemo(() => {
    return processedEntries.filter(entry => {
      if (filters.userId !== 'all' && entry.userId !== filters.userId) {
        return false;
      }
      if (filters.startDate) {
        const entryDate = new Date(entry.date.split('/').reverse().join('-'));
        const filterDate = new Date(filters.startDate);
        if (entryDate < filterDate) return false;
      }
      if (filters.endDate) {
        const entryDate = new Date(entry.date.split('/').reverse().join('-'));
        const filterDate = new Date(filters.endDate);
        if (entryDate > filterDate) return false;
      }
      return true;
    });
  }, [processedEntries, filters]);

  const entriesWithAccumulatedBalance = useMemo(() => {
    // Use a map to track balance per user
    const accumulatedBalances: { [key: string]: number } = {};
    
    // We sort the filtered entries by date to correctly calculate the running total
    const sorted = [...filteredEntries].sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());

    const entries = sorted.map(entry => {
        // Get the current balance for the user, or 0 if it's the first entry for them
        const currentBalance = accumulatedBalances[entry.userId] || 0;
        
        // Calculate the new accumulated balance
        const newAccumulatedBalance = currentBalance + entry.balance;
        
        // Update the balance for the user in our tracking map
        accumulatedBalances[entry.userId] = newAccumulatedBalance;
        
        // Return the entry with the new property
        return { ...entry, accumulatedBalance: newAccumulatedBalance };
    });
    
    // Return to descending order for display
    return entries.reverse();
  }, [filteredEntries]);

  const summaryStats = useMemo(() => {
    const currentMonthEntries = processedEntries.filter(e => {
        const entryDate = new Date(e.date.split('/').reverse().join('-'));
        const today = new Date();
        return entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear();
    });

    const totalHoursMonth = currentMonthEntries.reduce((acc, curr) => acc + curr.workedHours, 0);
    const totalBalance = processedEntries.reduce((acc, curr) => acc + curr.balance, 0);
    const overtime = currentMonthEntries.reduce((acc, curr) => acc + (curr.workedHours > workdayHours ? curr.workedHours - workdayHours : 0), 0);
    const lateness = currentMonthEntries.filter(e => e.entrada && e.entrada.getHours() >= 9).length;

    const today = new Date();
    const entriesToday = timeEntries.filter(entry => isSameDay(entry.timestamp, today));
    
    const userStatus: { [userId: string]: TimeEntryType | null } = {};

    entriesToday
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .forEach(entry => {
            userStatus[entry.userId] = entry.type;
        });
    
    const currentlyWorking = Object.values(userStatus).filter(
        status => status && status !== TimeEntryType.SAIDA
    ).length;


    return {
        totalHoursMonth: totalHoursMonth.toFixed(2) + 'h',
        totalBalance: totalBalance.toFixed(2) + 'h',
        overtime: overtime.toFixed(2) + 'h',
        lateness,
        currentlyWorking
    };
  }, [processedEntries, timeEntries, workdayHours]);

  const totalWorkedHours = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => acc + curr.workedHours, 0);
  }, [filteredEntries]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const formatHours = (hours: number) => {
    const sign = hours < 0 ? "-" : "+";
    const absoluteHours = Math.abs(hours);
    const h = Math.floor(absoluteHours);
    const m = Math.round((absoluteHours * 60) % 60);
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatTime = (date?: Date) => date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--';
  
  const handleExportExcel = () => {
    if (!window.XLSX) {
        console.error("XLSX library not loaded");
        alert("Não foi possível gerar o Excel. A biblioteca XLSX não foi carregada.");
        return;
    }

    const dataForExport = entriesWithAccumulatedBalance.map(entry => {
        const user = users.find(u => u.id === entry.userId);
        return {
            "Funcionário": user?.name || 'N/A',
            "Data": entry.date,
            "Entrada": formatTime(entry.entrada),
            "Início Intervalo": formatTime(entry.inicioIntervalo),
            "Fim Intervalo": formatTime(entry.fimIntervalo),
            "Saída": formatTime(entry.saida),
            "Horas Trabalhadas": parseFloat(entry.workedHours.toFixed(2)),
            "Saldo Dia": formatHours(entry.balance),
            "Status": entry.status,
            "Observação": entry.observation
        };
    });

    const worksheet = window.XLSX.utils.json_to_sheet(dataForExport);
    
    // Adicionar linha de total ao final
    window.XLSX.utils.sheet_add_aoa(worksheet, [
        ["Total", "", "", "", "", "", parseFloat(totalWorkedHours.toFixed(2))]
    ], { origin: -1 });

    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Ponto");

    window.XLSX.writeFile(workbook, "relatorio_ponto.xlsx");
  };
  
  const handleExportPdf = () => {
      if (!window.jspdf) {
          console.error("jsPDF not loaded");
          alert("Não foi possível gerar o PDF. A biblioteca jsPDF não foi carregada.");
          return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.text("Relatório de Ponto", 14, 15);

      const tableColumn = [
          "Funcionário",
          "Data",
          "Entrada",
          "Saída",
          "Horas",
          "Saldo Dia",
          "Status",
      ];
      const tableRows: (string|number)[][] = [];

      entriesWithAccumulatedBalance.forEach(entry => {
          const user = users.find(u => u.id === entry.userId);
          const rowData = [
              user?.name || 'N/A',
              entry.date,
              formatTime(entry.entrada),
              formatTime(entry.saida),
              entry.workedHours.toFixed(2),
              formatHours(entry.balance),
              entry.status,
          ];
          tableRows.push(rowData);
      });

      (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 20,
          theme: 'grid',
          headStyles: { fillColor: [27, 38, 59] }, // Cor 'secondary'
          styles: {
              font: 'helvetica',
              fontSize: 8,
          },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 40;

      doc.setFontSize(10);
      doc.text(`Total de Horas Trabalhadas: ${totalWorkedHours.toFixed(2)}h`, 14, finalY + 10);
      
      doc.save("relatorio_ponto.pdf");
  };

  return (
    <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 print:hidden">
            <StatCard icon={<UserGroupIcon />} title="Trabalhando Agora" value={summaryStats.currentlyWorking.toString()} />
            <StatCard icon={<ChartBarIcon />} title="Horas no Mês" value={summaryStats.totalHoursMonth} />
            <StatCard icon={<ClockIcon />} title="Saldo Geral (Banco)" value={summaryStats.totalBalance} subtitle="Todos os funcionários" />
            <StatCard icon={<TargetIcon />} title="Horas Extras" value={summaryStats.overtime} subtitle="Este mês" />
            <StatCard icon={<WarningIcon />} title="Atrasos" value={summaryStats.lateness.toString()} subtitle="Este mês" />
        </div>

        {/* Detailed Reports */}
        <div className="bg-secondary p-4 sm:p-6 rounded-lg shadow-lg">
             <div className="md:flex justify-between items-center mb-4 print:hidden">
                <div>
                    <h3 className="text-lg font-semibold text-light">Relatórios Detalhados</h3>
                    <p className="text-sm text-highlight">Visualize e gerencie os registros de ponto dos funcionários.</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
                    <button onClick={() => window.print()} className="flex items-center bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-3 rounded-md transition"><PrintIcon/> <span className="hidden sm:inline ml-1">Imprimir</span></button>
                    <button onClick={handleExportExcel} className="flex items-center bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded-md transition"><ExcelIcon/> <span className="hidden sm:inline ml-1">Excel</span></button>
                    <button onClick={handleExportPdf} className="flex items-center bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 px-3 rounded-md transition"><PdfIcon/> <span className="hidden sm:inline ml-1">PDF</span></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-end print:hidden">
                <div>
                    <label className="block text-sm font-medium text-highlight mb-1">Funcionário</label>
                    <select name="userId" value={filters.userId} onChange={handleFilterChange} className="w-full bg-primary border border-accent rounded-md px-3 py-2 text-light focus:ring-highlight focus:border-highlight">
                        <option value="all">Todos</option>
                        {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-highlight mb-1">Tipo de Relatório</label>
                    <select name="reportType" value={filters.reportType} onChange={handleFilterChange} className="w-full bg-primary border border-accent rounded-md px-3 py-2 text-light focus:ring-highlight focus:border-highlight">
                        <option value="daily">Diário</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-highlight mb-1">Data Início</label>
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full bg-primary border border-accent rounded-md px-3 py-2 text-light focus:ring-highlight focus:border-highlight" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-highlight mb-1">Data Fim</label>
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full bg-primary border border-accent rounded-md px-3 py-2 text-light focus:ring-highlight focus:border-highlight" />
                </div>
            </div>
            
            <div className="overflow-x-auto mt-6">
              <table className="min-w-full divide-y divide-accent">
                <thead className="bg-primary">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Funcionário</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Data</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Entrada</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Início Intervalo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Fim Intervalo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Saída</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Horas Trab.</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Saldo Dia</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Saldo Acumulado</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Observação</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-secondary divide-y divide-accent">
                  {entriesWithAccumulatedBalance.map(entry => {
                    const user = users.find(u => u.id === entry.userId);
                    const balanceColor = entry.balance < 0 ? 'text-red-400' : 'text-green-400';
                    const accumulatedBalanceColor = entry.accumulatedBalance < 0 ? 'text-red-400' : 'text-green-400';

                    return (
                      <tr key={entry.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{user?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{entry.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(entry.entrada)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(entry.inicioIntervalo)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(entry.fimIntervalo)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{formatTime(entry.saida)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light">{entry.workedHours.toFixed(2)}h</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${balanceColor}`}>{formatHours(entry.balance)}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${accumulatedBalanceColor}`}>{formatHours(entry.accumulatedBalance)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light max-w-xs truncate" title={entry.observation}>{entry.observation}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-light text-center print:hidden">
                          <button onClick={() => setEditingDay(entry)} className="text-highlight hover:text-light p-1 rounded-full hover:bg-accent transition">
                              <EditIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEntries.length === 0 && (
                    <tr>
                        <td colSpan={11} className="px-6 py-10 text-center text-highlight">Nenhum registro encontrado para os filtros selecionados.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-primary">
                    <tr>
                        <td colSpan={6} className="px-6 py-4 text-right text-sm font-bold text-highlight uppercase tracking-wider">Totais</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-light">{totalWorkedHours.toFixed(2)}h</td>
                        <td colSpan={4} className="print:hidden"></td>
                        <td colSpan={3} className="hidden print:table-cell"></td>
                    </tr>
                </tfoot>
              </table>
            </div>

        </div>

        {editingDay && (
            <EditDayModal 
                day={editingDay} 
                onClose={() => setEditingDay(null)} 
                onSave={onUpdateTimeEntry}
                onDelete={onDeleteTimeEntry}
                onAdd={onAddTimeEntry}
            />
        )}
    </div>
  );
};

interface EditDayModalProps {
    day: ProcessedEntry;
    onClose: () => void;
    onSave: (entry: TimeEntry) => void;
    onDelete: (entryId: string) => void;
    onAdd: (entry: Omit<TimeEntry, 'id'>) => void;
}

const EditDayModal: React.FC<EditDayModalProps> = ({ day, onClose, onSave, onDelete, onAdd }) => {
    const [entries, setEntries] = useState<TimeEntry[]>(day.originalEntries);
    const [isAdding, setIsAdding] = useState(false);
    const [newEntryData, setNewEntryData] = useState({
        type: TimeEntryType.ENTRADA,
        timestamp: new Date(),
        observation: '',
    });

    useEffect(() => {
        setEntries(day.originalEntries);
    }, [day.originalEntries]);
    
    const handleTimeChange = (id: string, newDateTime: string) => {
        setEntries(prev => prev.map(e => e.id === id ? {...e, timestamp: new Date(newDateTime)} : e));
    };

    const handleObservationChange = (id: string, newObservation: string) => {
        setEntries(prev => prev.map(e => e.id === id ? {...e, observation: newObservation} : e));
    };
    
    const handleSaveUpdates = () => {
        entries.forEach(entry => {
            const original = day.originalEntries.find(o => o.id === entry.id);
            if (original?.timestamp !== entry.timestamp || original?.observation !== entry.observation) {
                onSave(entry);
            }
        });
        onClose();
    };

    const handleDelete = (entryId: string) => {
        // The confirm dialog was removed because it was being blocked by the execution environment's sandbox,
        // preventing the delete action from ever running.
        // The optimistic UI update was also removed to rely on the single source of truth from props,
        // ensuring the UI only reflects the confirmed state of the database.
        onDelete(entryId);
    };

    const handleAddNewEntry = () => {
        const [dayDate, month, year] = day.date.split('/').map(Number);
        const newTimestamp = new Date(newEntryData.timestamp);
        // Set the date from the day being edited, preserving the new time
        newTimestamp.setFullYear(year, month - 1, dayDate);

        onAdd({
            userId: day.userId,
            timestamp: newTimestamp,
            type: newEntryData.type,
            observation: newEntryData.observation,
        });
        setIsAdding(false);
        setNewEntryData({type: TimeEntryType.ENTRADA, timestamp: new Date(), observation: ''});
    };
    
    // Helper to format date for datetime-local input
    const toLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60000));
        return adjustedDate.toISOString().slice(0, 16);
    }
    
    return (
        <Modal isOpen={true} onClose={onClose} title={`Editar Dia: ${day.date}`}>
             <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {entries.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()).map(entry => (
                    <div key={entry.id} className="p-3 bg-primary rounded-md">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-highlight">{entry.type}</h4>
                            <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-300 transition-colors" aria-label="Excluir registro">
                                <TrashIcon />
                            </button>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-highlight">Data e Hora</label>
                                <input
                                    type="datetime-local"
                                    value={toLocalISOString(entry.timestamp)}
                                    onChange={(e) => handleTimeChange(entry.id, e.target.value)}
                                    className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-highlight">Observação</label>
                                <input
                                    type="text"
                                    value={entry.observation}
                                    onChange={(e) => handleObservationChange(entry.id, e.target.value)}
                                    className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {isAdding && (
                    <div className="p-3 bg-primary border border-dashed border-accent rounded-md mt-4">
                        <h4 className="font-semibold text-light mb-2">Novo Registro</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-medium text-highlight">Tipo</label>
                                <select 
                                    value={newEntryData.type}
                                    onChange={(e) => setNewEntryData({...newEntryData, type: e.target.value as TimeEntryType})}
                                    className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                >
                                    {Object.values(TimeEntryType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-highlight">Hora</label>
                                <input
                                    type="time"
                                    value={newEntryData.timestamp.toTimeString().slice(0,5)}
                                    onChange={(e) => {
                                        const [hours, minutes] = e.target.value.split(':');
                                        const newDate = new Date(newEntryData.timestamp);
                                        newDate.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0);
                                        setNewEntryData({...newEntryData, timestamp: newDate});
                                    }}
                                    className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                                />
                            </div>
                        </div>
                         <div className="mt-4">
                             <label className="block text-xs font-medium text-highlight">Observação</label>
                              <input
                                type="text"
                                value={newEntryData.observation}
                                onChange={(e) => setNewEntryData({...newEntryData, observation: e.target.value})}
                                className="mt-1 block w-full bg-secondary border border-accent rounded-md shadow-sm py-2 px-3 text-light focus:outline-none focus:ring-highlight focus:border-highlight sm:text-sm"
                            />
                        </div>
                        <div className="flex justify-end space-x-2 mt-4">
                             <button onClick={() => setIsAdding(false)} className="py-1 px-3 border border-accent rounded-md text-sm text-light hover:bg-accent">Cancelar</button>
                             <button onClick={handleAddNewEntry} className="py-1 px-3 bg-accent rounded-md text-sm text-white hover:bg-highlight">Adicionar</button>
                        </div>
                    </div>
                )}

                 {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)} 
                        className="w-full mt-4 flex items-center justify-center space-x-2 text-sm text-highlight hover:text-light bg-primary hover:bg-accent transition-colors py-2 px-4 border border-dashed border-accent rounded-md"
                    >
                        <PlusCircleIcon />
                        <span>Adicionar Registro</span>
                    </button>
                )}

            </div>
            <div className="mt-6 flex justify-end space-x-4">
                <button
                    onClick={onClose}
                    className="py-2 px-4 border border-accent rounded-md shadow-sm text-sm font-medium text-light hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSaveUpdates}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight transition"
                >
                    Salvar Alterações
                </button>
            </div>
        </Modal>
    );
}

export default TimeReport;