
export enum Role {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string; // Firebase Auth UID / Firestore Document ID
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
}

export enum TimeEntryType {
  ENTRADA = 'Entrada',
  INICIO_INTERVALO = 'Início Intervalo',
  FIM_INTERVALO = 'Fim Intervalo',
  SAIDA = 'Saída',
}

export interface TimeEntry {
  id: string; // Firestore Document ID
  userId: string; // User's Firestore Document ID
  timestamp: Date;
  type: TimeEntryType;
  observation: string;
}