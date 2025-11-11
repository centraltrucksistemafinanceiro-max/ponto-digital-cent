import React, { useState, useCallback, useEffect } from 'react';
import { User, Role, TimeEntry, TimeEntryType } from './types';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import Header from './components/Header';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';


export interface AppConfig {
  latitude: number;
  longitude: number;
  radius: number;
  workdayHours: number;
}


function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    latitude: -20.85411,
    longitude: -49.34039,
    radius: 10,
    workdayHours: 8,
  });

  const logActivity = useCallback(async (actor: User | null, action: string, details: Record<string, any> = {}) => {
    if (!actor) {
        console.warn("Log activity attempted without an actor for action:", action);
        return;
    }
    try {
        await addDoc(collection(db, "audit_logs"), {
            timestamp: new Date(),
            actorId: actor.id,
            actorName: actor.name,
            action,
            details,
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
  }, []);

  const logAnonymousActivity = useCallback(async (action: string, details: Record<string, any> = {}) => {
      try {
          await addDoc(collection(db, "audit_logs"), {
              timestamp: new Date(),
              actorId: 'anonymous',
              actorName: 'System',
              action,
              details,
          });
      } catch (error) {
          console.error("Failed to log anonymous activity:", error);
      }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        // User is signed in, find their profile in Firestore
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as User);
        } else {
            console.error("User profile not found in Firestore for email:", user.email);
            setCurrentUser(null); // Or handle this case appropriately
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listeners for real-time data
  useEffect(() => {
    if (!currentUser) return;

    // Listen to users collection (for Admin)
    const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(usersData);
    });

    // Listen to time entries collection
    const timeEntriesUnsubscribe = onSnapshot(collection(db, "time_entries"), (snapshot) => {
        const entriesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp).toDate(),
            } as TimeEntry;
        });
        setTimeEntries(entriesData);
    });

    // Listen to config
    const configUnsubscribe = onSnapshot(doc(db, "config", "main"), (doc) => {
        if (doc.exists()) {
            setAppConfig(doc.data() as AppConfig);
        }
    });

    return () => {
        usersUnsubscribe();
        timeEntriesUnsubscribe();
        configUnsubscribe();
    };
  }, [currentUser]);


  // FIX: Renamed `password_hash` parameter to `password` for clarity.
  const handleLogin = useCallback(async (nameOrEmail: string, password: string, rememberMe: boolean): Promise<{success: boolean; error?: string}> => {
    const email = nameOrEmail.includes('@') ? nameOrEmail : `${nameOrEmail.toLowerCase()}@ponto.app`;
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const user = userCredential.user;
      if (user && user.email) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const loggedInUser = { id: userDoc.id, ...userDoc.data() } as User;
              // We pass the fetched user object directly, as `currentUser` state is not updated yet.
              await logActivity(loggedInUser, 'USER_LOGIN_SUCCESS', { email: loggedInUser.email });
          }
      }

      return { success: true };
    } catch (error: any) {
      console.error("Login failed:", error);
      await logAnonymousActivity('USER_LOGIN_FAIL', { attemptedEmail: email, errorCode: error.code });
      let message = 'Nome de usuário ou senha inválidos.';
      if (error.code === 'auth/configuration-not-found') {
          message = 'Erro de configuração do Firebase. Verifique as credenciais no arquivo `firebase.ts` e as configurações no console do Firebase.';
      }
      return { success: false, error: message };
    }
  }, [logActivity, logAnonymousActivity]);

  const handleLogout = useCallback(() => {
    if(currentUser) {
        logActivity(currentUser, 'USER_LOGOUT', { email: currentUser.email });
    }
    signOut(auth);
  }, [currentUser, logActivity]);

  const handleAddTimeEntry = useCallback(async (entry: Omit<TimeEntry, 'id'>) => {
    try {
      await addDoc(collection(db, "time_entries"), entry);
      await logActivity(currentUser, 'ADD_TIME_ENTRY', {
          entryType: entry.type,
          targetUserId: entry.userId,
          observation: entry.observation
      });
    } catch (error) {
      console.error("Error adding time entry:", error);
    }
  }, [currentUser, logActivity]);

  // FIX: Renamed function to follow camelCase convention.
  const handleUpdateTimeEntry = useCallback(async (updatedEntry: TimeEntry) => {
    const { id, ...data } = updatedEntry;
    const originalEntry = timeEntries.find(e => e.id === updatedEntry.id);
    await logActivity(currentUser, 'UPDATE_TIME_ENTRY', {
        targetUserId: updatedEntry.userId,
        targetEntryId: updatedEntry.id,
        before: originalEntry ? {
            timestamp: originalEntry.timestamp.toISOString(),
            observation: originalEntry.observation
        } : {},
        after: {
            timestamp: updatedEntry.timestamp.toISOString(),
            observation: updatedEntry.observation
        }
    });
    try {
      await updateDoc(doc(db, "time_entries", id), data);
    } catch (error) {
      console.error("Error updating time entry:", error);
    }
  }, [currentUser, logActivity, timeEntries]);

  // FIX: Renamed `password_hash` parameter to `password` for clarity.
  const handleAddUser = useCallback(async (user: Omit<User, 'id'>, password: string) => {
    if (users.some(u => u.name.toLowerCase() === user.name.toLowerCase() || u.email.toLowerCase() === user.email.toLowerCase())) {
        alert("Usuário com este nome ou e-mail já existe.");
        return;
    }
    try {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
        const newAuthUser = userCredential.user;

        // 2. Create user document in Firestore
        await setDoc(doc(db, 'users', newAuthUser.uid), {
            name: user.name,
            email: user.email,
            role: user.role
        });

        await logActivity(currentUser, 'CREATE_USER', {
            targetUserId: newAuthUser.uid,
            newUserEmail: user.email,
            newUserName: user.name,
            newUserRole: user.role
        });
    } catch (error) {
        console.error("Error adding user: ", error);
        alert("Falha ao criar usuário. Verifique o console para mais detalhes.");
    }
  }, [users, currentUser, logActivity]);
  
  const handleUpdateUser = useCallback(async (updatedUser: User) => {
    const { id, ...data } = updatedUser;
    const originalUser = users.find(u => u.id === updatedUser.id);
    await logActivity(currentUser, 'UPDATE_USER', {
        targetUserId: updatedUser.id,
        before: originalUser ? {
            name: originalUser.name,
            role: originalUser.role
        } : {},
        after: {
            name: updatedUser.name,
            role: updatedUser.role
        }
    });
    try {
        await updateDoc(doc(db, "users", id), data);
    } catch (error) {
        console.error("Error updating user: ", error);
    }
  }, [users, currentUser, logActivity]);

  const handleUpdateAppConfig = useCallback(async (newConfig: AppConfig) => {
    await logActivity(currentUser, 'UPDATE_APP_CONFIG', {
        before: appConfig,
        after: newConfig
    });
    try {
        await setDoc(doc(db, "config", "main"), newConfig);
    } catch (error) {
        console.error("Error updating config:", error);
    }
  }, [appConfig, currentUser, logActivity]);

  const handleExportData = useCallback(async () => {
    try {
        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch all time entries
        const timeEntriesSnapshot = await getDocs(collection(db, "time_entries"));
        const timeEntriesData = timeEntriesSnapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data, 
                // Convert Firestore Timestamp to ISO string for JSON compatibility
                timestamp: (data.timestamp as Timestamp).toDate().toISOString() 
            };
        });

        const backupData = {
            users: usersData,
            time_entries: timeEntriesData,
            exportedAt: new Date().toISOString()
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `backup_ponto_digital_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await logActivity(currentUser, 'EXPORT_DATA_SUCCESS');

    } catch (error) {
        console.error("Error exporting data:", error);
        await logActivity(currentUser, 'EXPORT_DATA_FAIL', { error: error instanceof Error ? error.message : String(error) });
        alert("Ocorreu um erro ao exportar os dados.");
    }
  }, [currentUser, logActivity]);

  const handleImportData = useCallback(async (fileContent: string): Promise<{ success: boolean; message: string }> => {
    try {
        const data = JSON.parse(fileContent);

        if (!data.users || !data.time_entries || !Array.isArray(data.users) || !Array.isArray(data.time_entries)) {
            return { success: false, message: "Arquivo de backup inválido. A estrutura esperada não foi encontrada." };
        }

        const batch = writeBatch(db);

        // Process users
        data.users.forEach((user: any) => {
            const { id, ...userData } = user;
            if (id) {
                const userRef = doc(db, "users", id);
                batch.set(userRef, userData);
            }
        });

        // Process time entries
        data.time_entries.forEach((entry: any) => {
            const { id, ...entryData } = entry;
            if (id && entry.timestamp) {
                const entryRef = doc(db, "time_entries", id);
                // Convert ISO string back to Firestore Timestamp
                const timestamp = Timestamp.fromDate(new Date(entry.timestamp));
                batch.set(entryRef, { ...entryData, timestamp });
            }
        });

        await batch.commit();

        await logActivity(currentUser, 'IMPORT_DATA_SUCCESS', { usersImported: data.users.length, entriesImported: data.time_entries.length });
        return { success: true, message: `Importação concluída com sucesso! ${data.users.length} usuários e ${data.time_entries.length} registros de ponto processados.` };

    } catch (error) {
        console.error("Error importing data:", error);
        await logActivity(currentUser, 'IMPORT_DATA_FAIL', { error: error instanceof Error ? error.message : String(error) });
        return { success: false, message: `Ocorreu um erro durante a importação: ${error instanceof Error ? error.message : String(error)}` };
    }
  }, [currentUser, logActivity]);

  const handleAdminSetUserPassword = useCallback(async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== Role.ADMIN) {
        return { success: false, message: "Apenas administradores podem realizar esta ação." };
    }

    // --- IMPLEMENTATION WARNING ---
    // Changing another user's password is a privileged action that CANNOT be done
    // securely from the client-side using the standard Firebase Auth SDK.
    // This functionality requires the Firebase Admin SDK in a secure backend environment,
    // such as a Firebase Cloud Function.

    // The code below is a placeholder to illustrate how the call to such a backend function would look.
    console.error("FUNCTIONALITY NOT IMPLEMENTED: Password changes require a backend (Firebase Cloud Function).");
    
    await logActivity(currentUser, 'ADMIN_PASSWORD_SET_ATTEMPT', { targetUserId: userId });

    // This is a placeholder for the UI while the backend function is not available:
    const message = "Funcionalidade indisponível. A alteração de senha de outro usuário requer uma configuração de backend (servidor) que não está presente nesta aplicação.";
    alert(message);
    return { success: false, message: "Funcionalidade indisponível." };

  }, [currentUser, logActivity]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-primary text-light">Carregando...</div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <Header user={currentUser} onLogout={handleLogout} className="print:hidden" />
      <main className="p-4 sm:p-6 lg:p-8">
        {currentUser.role === Role.ADMIN ? (
          <AdminDashboard 
            users={users} 
            timeEntries={timeEntries}
            onAddUser={handleAddUser}
            onUpdateTimeEntry={handleUpdateTimeEntry}
            onUpdateUser={handleUpdateUser}
            appConfig={appConfig}
            onUpdateAppConfig={handleUpdateAppConfig}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onSetUserPassword={handleAdminSetUserPassword}
          />
        ) : (
          <EmployeeDashboard 
            user={currentUser} 
            timeEntries={timeEntries.filter(e => e.userId === currentUser.id)}
            onAddTimeEntry={handleAddTimeEntry}
            onUpdateTimeEntry={handleUpdateTimeEntry}
            appConfig={appConfig}
          />
        )}
      </main>
    </div>
  );
}

export default App;
