import React, { useState, useCallback, useEffect } from 'react';
import { User, Role, TimeEntry, TimeEntryType } from './types';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import Header from './components/Header';
import { auth, db } from './firebase';
import { 
  User as FirebaseAuthUser,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  deleteDoc,
  DocumentSnapshot,
  DocumentData,
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

  const autoFixUserInconsistency = useCallback(async (
    authUser: FirebaseAuthUser, 
    userProfileDoc: DocumentSnapshot<DocumentData>
  ): Promise<User | null> => {
    const incorrectDocId = userProfileDoc.id;
    const correctUid = authUser.uid;
    const userProfileData = userProfileDoc.data();

    if (!userProfileData) return null;

    console.warn(`[AUTO-FIXING] Detected data inconsistency for user ${authUser.email}. Starting migration.
        - Incorrect Firestore ID: ${incorrectDocId}
        - Correct Auth UID: ${correctUid}`);

    try {
        const batch = writeBatch(db);

        // 1. Create the new user document with the correct UID
        const newUserDocRef = doc(db, "users", correctUid);
        batch.set(newUserDocRef, userProfileData);

        // 2. Find and update all time entries associated with the old ID
        const timeEntriesQuery = query(collection(db, "time_entries"), where("userId", "==", incorrectDocId));
        const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
        timeEntriesSnapshot.forEach(entryDoc => {
            batch.update(entryDoc.ref, { userId: correctUid });
        });
        console.log(`[AUTO-FIXING] Migrating ${timeEntriesSnapshot.size} time entries.`);

        // 3. Find and update all audit logs associated with the old ID
        const auditLogsQuery = query(collection(db, "audit_logs"), where("actorId", "==", incorrectDocId));
        const auditLogsSnapshot = await getDocs(auditLogsQuery);
        auditLogsSnapshot.forEach(logDoc => {
            batch.update(logDoc.ref, { actorId: correctUid });
        });
        console.log(`[AUTO-FIXING] Migrating ${auditLogsSnapshot.size} audit logs.`);

        // 4. Delete the old user document
        const oldUserDocRef = doc(db, "users", incorrectDocId);
        batch.delete(oldUserDocRef);

        // 5. Commit all changes atomically
        await batch.commit();

        console.log(`[AUTO-FIXING] Data migration completed successfully for user ${authUser.email}.`);

        // Return the corrected user profile, ensuring the ID is the new, correct UID
        return { id: correctUid, ...userProfileData } as User;

    } catch (error) {
        console.error("[AUTO-FIXING] CRITICAL ERROR during data migration:", error);
        // If migration fails, we can't proceed safely.
        return null;
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        // Primary lookup: by UID (correct and efficient)
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setCurrentUser({ id: userDocSnap.id, ...userDocSnap.data() } as User);
        } else {
            // Fallback lookup: by email, with auto-fix
            const usersQuery = query(collection(db, "users"), where("email", "==", user.email));
            const querySnapshot = await getDocs(usersQuery);

            if (!querySnapshot.empty) {
                const userDocFromQuery = querySnapshot.docs[0];
                const correctedUser = await autoFixUserInconsistency(user, userDocFromQuery);
                if (correctedUser) {
                    setCurrentUser(correctedUser);
                } else {
                    console.error("Auto-fix failed during session restoration. Signing out.");
                    await signOut(auth);
                    setCurrentUser(null);
                }
            } else {
                // User profile truly not found
                console.error(`User profile not found in Firestore for UID (${user.uid}) or email (${user.email}). Signing out to prevent inconsistent state.`);
                await signOut(auth);
                setCurrentUser(null);
            }
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [autoFixUserInconsistency]);

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


  const handleLogin = useCallback(async (nameOrEmail: string, password: string, rememberMe: boolean): Promise<{success: boolean; error?: string}> => {
    try {
        // 1. Set persistence FIRST. This is the most reliable way to ensure the setting is applied for the sign-in attempt.
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        // 2. Determine the email to use for login.
        let email: string;
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        const foundUser = querySnapshot.docs.find(doc => doc.data().name.toLowerCase() === nameOrEmail.toLowerCase());

        if (foundUser) {
            email = foundUser.data().email;
        } else {
            email = nameOrEmail;
        }
      
        // 3. Attempt to sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 4. VERIFY PROFILE (with auto-fix fallback)
        const userDocRef = doc(db, "users", user.uid);
        let userDocSnap = await getDoc(userDocRef);
        let userProfileData: User | null = null;

        if (userDocSnap.exists()) {
            userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
        } else {
            // Fallback lookup by email with auto-fix
            if (user.email) {
                const usersQuery = query(collection(db, "users"), where("email", "==", user.email));
                const querySnapshotFallback = await getDocs(usersQuery);

                if (!querySnapshotFallback.empty) {
                    const userDocFromQuery = querySnapshotFallback.docs[0];
                    const correctedUser = await autoFixUserInconsistency(user, userDocFromQuery);

                    if (!correctedUser) {
                        await signOut(auth);
                        return { success: false, error: 'Falha na correção automática do perfil. Contate o suporte.' };
                    }
                    userProfileData = correctedUser;
                }
            }
        }

        if (!userProfileData) {
            // Profile truly not found
            console.error(`Login successful, but user profile not found in Firestore for UID: ${user.uid} or email: ${user.email}. Signing out.`);
            await signOut(auth);
            await logAnonymousActivity('USER_LOGIN_FAIL_NO_PROFILE', { attemptedIdentifier: nameOrEmail, uid: user.uid });
            return { success: false, error: 'Autenticação bem-sucedida, mas o perfil não foi encontrado. Contate um administrador.' };
        }
      
        // 5. On success, log the activity using the verified profile data.
        await logActivity(userProfileData, 'USER_LOGIN_SUCCESS', { email: userProfileData.email });

        return { success: true };

    } catch (error: any) {
        // 6. Unified error handling for the entire process
        console.error("Login process failed:", error);
        await logAnonymousActivity('USER_LOGIN_FAIL', { attemptedIdentifier: nameOrEmail, errorCode: error.code });
      
        let message = 'Ocorreu um erro desconhecido.';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found') {
            message = 'Nome de usuário/e-mail ou senha inválidos.';
        } else if (error.code === 'auth/configuration-not-found') {
            message = 'Erro de configuração do Firebase. Verifique as credenciais no arquivo `firebase.ts` e as configurações no console do Firebase.';
        } else {
            message = 'Falha ao fazer login. Verifique suas credenciais e a conexão com a internet.';
        }
        return { success: false, error: message };
    }
  }, [logActivity, logAnonymousActivity, autoFixUserInconsistency]);

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

  const handleDeleteTimeEntry = useCallback(async (entryId: string) => {
      const entryToDelete = timeEntries.find(e => e.id === entryId);
      if (!entryToDelete) {
          console.error("Time entry not found for deletion:", entryId);
          return;
      }

      await logActivity(currentUser, 'DELETE_TIME_ENTRY', {
          targetUserId: entryToDelete.userId,
          targetEntryId: entryToDelete.id,
          deletedEntry: {
              type: entryToDelete.type,
              timestamp: entryToDelete.timestamp.toISOString(),
              observation: entryToDelete.observation
          }
      });

      try {
          await deleteDoc(doc(db, "time_entries", entryId));
      } catch (error) {
          console.error("Error deleting time entry:", error);
      }
  }, [currentUser, logActivity, timeEntries]);

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

  const handleAdminTriggerPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== Role.ADMIN) {
        return { success: false, message: "Apenas administradores podem realizar esta ação." };
    }
    try {
        await sendPasswordResetEmail(auth, email);
        await logActivity(currentUser, 'ADMIN_PASSWORD_RESET_EMAIL_SENT', { targetUserEmail: email });
        return { success: true, message: `E-mail de redefinição enviado para ${email}. Peça ao funcionário para verificar a caixa de entrada e a pasta de spam.` };
    } catch (error: any) {
        console.error("Error sending password reset email:", error);
        await logActivity(currentUser, 'ADMIN_PASSWORD_RESET_EMAIL_FAIL', { targetUserEmail: email, error: error.message });
        let message = 'Falha ao enviar e-mail de redefinição de senha.';
        if (error.code === 'auth/user-not-found') {
            message = 'Nenhum usuário encontrado com este e-mail.';
        }
        return { success: false, message: message };
    }
  }, [currentUser, logActivity]);

  const handleChangePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string; }> => {
    const user = auth.currentUser;
    if (!user || !user.email) {
        return { success: false, message: "Usuário não autenticado." };
    }
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        // Re-authenticate the user to confirm their identity
        await reauthenticateWithCredential(user, credential);
        // If re-authentication is successful, update the password
        await updatePassword(user, newPassword);
        
        await logActivity(currentUser, 'USER_PASSWORD_CHANGE_SUCCESS');
        return { success: true, message: "Senha alterada com sucesso!" };

    } catch (error: any) {
        console.error("Password change failed:", error);
        await logActivity(currentUser, 'USER_PASSWORD_CHANGE_FAIL', { error: error.code });
        let message = "Ocorreu um erro ao alterar a senha.";
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "A senha atual está incorreta.";
        } else if (error.code === 'auth/weak-password') {
            message = "A nova senha é muito fraca. Tente uma senha mais forte.";
        }
        return { success: false, message };
    }
  }, [currentUser, logActivity]);


  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-primary text-light">Carregando...</div>;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
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
            onDeleteTimeEntry={handleDeleteTimeEntry}
            onAddTimeEntry={handleAddTimeEntry}
            onUpdateUser={handleUpdateUser}
            appConfig={appConfig}
            onUpdateAppConfig={handleUpdateAppConfig}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onTriggerPasswordReset={handleAdminTriggerPasswordReset}
          />
        ) : (
          <EmployeeDashboard 
            user={currentUser} 
            timeEntries={timeEntries.filter(e => e.userId === currentUser.id)}
            onAddTimeEntry={handleAddTimeEntry}
            onUpdateTimeEntry={handleUpdateTimeEntry}
            onChangePassword={handleChangePassword}
            appConfig={appConfig}
          />
        )}
      </main>
    </div>
  );
}

export default App;