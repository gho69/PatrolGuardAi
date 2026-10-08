import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePatrolFile } from './utils/parser';
import { generateMissingData } from './utils/generator';
import { PatrolLog, SiteConfig, ReportData, DayConfig, CustomRoundSlot, ClientProfile } from './types';

const Card: React.FC<{ children: React.ReactNode, title?: string, icon?: string, className?: string }> = ({ children, title, icon, className = "" }) => (
  <div className={`glass p-6 rounded-2xl neon-border transition-all duration-300 ${className}`}>
    {title && (
      <div className="flex items-center mb-6 border-b border-sky-500/20 pb-4">
        {icon && <i className={`${icon} text-sky-400 mr-3 text-xl`}></i>}
        <h2 className="text-xl font-orbitron font-bold text-sky-100 uppercase tracking-widest">{title}</h2>
      </div>
    )}
    {children}
  </div>
);

const NumericStepper: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  suffix?: string;
  badge?: string;
  badgeClass?: string;
}> = ({ label, value, min, max, onChange, suffix = "", badge, badgeClass }) => {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };
  const increment = () => {
    if (value < max) onChange(value + 1);
  };
  
  return (
    <div className="flex items-center justify-between p-2 rounded-xl bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 transition-all">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider h-full flex items-center pr-2">
        {badge && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded mr-1.5 ${badgeClass || 'bg-sky-500/20 text-sky-300'}`}>
            {badge}
          </span>
        )}
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button 
          onClick={decrement}
          disabled={value <= min}
          type="button"
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 border border-sky-400/20 font-bold text-sky-400 text-sm cursor-pointer disabled:opacity-20 transition-all select-none"
        >
          -
        </button>
        <span className="w-10 text-center text-xs font-orbitron font-bold text-white bg-slate-900/60 py-1 rounded-lg border border-sky-500/5">
          {value}{suffix}
        </span>
        <button 
          onClick={increment}
          disabled={value >= max}
          type="button"
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 border border-sky-400/20 font-bold text-sky-400 text-sm cursor-pointer disabled:opacity-20 transition-all select-none"
        >
          +
        </button>
      </div>
    </div>
  );
};

const DEFAULT_CLIENTS: ClientProfile[] = [
  {
    id: 'granarolo',
    name: 'Sede Uffici Granarolo',
    code: 'CLI-001',
    notes: 'Presidio notturno Lun-Ven (1 giro), weekend con ronda notturna intensiva (3 giri).',
    roundsPerShift: 1,
    tagsPerSite: 2,
    tagNames: [
      'Ispezione: 1 INGRESSO UFFICI',
      'Ispezione: 2 VIA GRANAROLO'
    ],
    tagIntervalMin: 2,
    tagIntervalMax: 5,
    nightShiftEnabled: true,
    dayShift1Enabled: false,
    dayShift2Enabled: false,
    nightStart: '23:00',
    nightEnd: '06:00',
    dayShift1Start: '06:00',
    dayShift1End: '14:00',
    dayShift2Start: '14:00',
    dayShift2End: '22:00',
    saturdayConfig: { nightEnabled: true, day1Enabled: false, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 1, day2Rounds: 1 },
    sundayConfig: { nightEnabled: true, day1Enabled: false, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 1, day2Rounds: 1 },
    customRoundSlotsEnabled: false,
    customRoundSlots: [
      { id: '1', name: '1° Giro Notturno', startTime: '00:00', endTime: '01:00', enabled: true, daysFilter: 'all' },
      { id: '2', name: '2° Giro Notturno', startTime: '02:00', endTime: '03:00', enabled: true, daysFilter: 'all' },
      { id: '3', name: 'Apertura Obbligatoria', startTime: '04:30', endTime: '05:00', enabled: true, daysFilter: 'all' }
    ]
  },
  {
    id: 'logistica',
    name: 'Hub Logistico Interporto',
    code: 'CLI-002',
    notes: 'Magazzini e banchine merci. 2 giri notturni, operatività continua weekend giorno e notte.',
    roundsPerShift: 2,
    tagsPerSite: 4,
    tagNames: [
      'Punto 1: Banchine Carico 1-8',
      'Punto 2: Varco Carraio Nord',
      'Punto 3: Recinzione Perimetrale Ovest',
      'Punto 4: Cabina Elettrica & Gruppo'
    ],
    tagIntervalMin: 3,
    tagIntervalMax: 7,
    nightShiftEnabled: true,
    dayShift1Enabled: false,
    dayShift2Enabled: false,
    nightStart: '22:00',
    nightEnd: '06:00',
    dayShift1Start: '06:00',
    dayShift1End: '14:00',
    dayShift2Start: '14:00',
    dayShift2End: '22:00',
    saturdayConfig: { nightEnabled: true, day1Enabled: true, day2Enabled: true, rounds: 2, nightRounds: 2, day1Rounds: 2, day2Rounds: 2 },
    sundayConfig: { nightEnabled: true, day1Enabled: true, day2Enabled: true, rounds: 2, nightRounds: 2, day1Rounds: 2, day2Rounds: 2 },
    customRoundSlotsEnabled: false,
    customRoundSlots: [
      { id: '1', name: 'Controllo Banchine', startTime: '23:00', endTime: '00:30', enabled: true, daysFilter: 'all' },
      { id: '2', name: 'Ronda Perimetrale', startTime: '03:00', endTime: '04:30', enabled: true, daysFilter: 'all' }
    ]
  },
  {
    id: 'commerciale',
    name: 'Centro Commerciale Le Cupole',
    code: 'CLI-003',
    notes: 'Galleria commerciale e parcheggi: 3 ispezioni notturne con apertura varchi programmata alle 05:45.',
    roundsPerShift: 3,
    tagsPerSite: 3,
    tagNames: [
      'Galleria Negozi Livello 0',
      'Uscite di Sicurezza Retro',
      'Parcheggio Sotterraneo Settore B'
    ],
    tagIntervalMin: 2,
    tagIntervalMax: 5,
    nightShiftEnabled: true,
    dayShift1Enabled: false,
    dayShift2Enabled: false,
    nightStart: '21:30',
    nightEnd: '06:30',
    dayShift1Start: '06:30',
    dayShift1End: '14:30',
    dayShift2Start: '14:30',
    dayShift2End: '21:30',
    saturdayConfig: { nightEnabled: true, day1Enabled: false, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 1, day2Rounds: 1 },
    sundayConfig: { nightEnabled: true, day1Enabled: true, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 2, day2Rounds: 1 },
    customRoundSlotsEnabled: true,
    customRoundSlots: [
      { id: '1', name: 'Ispezione Chiusura', startTime: '22:00', endTime: '23:15', enabled: true, daysFilter: 'all' },
      { id: '2', name: 'Controllo Notturno', startTime: '02:00', endTime: '03:30', enabled: true, daysFilter: 'all' },
      { id: '3', name: 'Apertura Varchi Staff', startTime: '05:45', endTime: '06:30', enabled: true, daysFilter: 'all' }
    ]
  }
];

const App: React.FC = () => {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [activeTab, setActiveTab] = useState<'base' | 'shifts' | 'slots' | 'weekend'>('base');

  // Gestione profili clienti salvati in memoria/localStorage
  const [clients, setClients] = useState<ClientProfile[]>(() => {
    try {
      const saved = localStorage.getItem('patrolguard_clients_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Errore nel caricamento dei clienti salvati', e);
    }
    return DEFAULT_CLIENTS;
  });

  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('patrolguard_selected_client_id');
      if (savedId) return savedId;
    } catch (e) {}
    return DEFAULT_CLIENTS[0].id;
  });

  const activeClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || clients[0] || DEFAULT_CLIENTS[0];
  }, [clients, selectedClientId]);

  // Stato modali
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientCode, setNewClientCode] = useState<string>('');
  const [newClientNotes, setNewClientNotes] = useState<string>('');
  const [newClientCopyCurrent, setNewClientCopyCurrent] = useState<boolean>(true);

  const [showManageClientsModal, setShowManageClientsModal] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientProfile | null>(null);
  const [archiveStatusMessage, setArchiveStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<SiteConfig>(() => {
    const initial = clients.find(c => c.id === selectedClientId) || clients[0] || DEFAULT_CLIENTS[0];
    return {
      clientId: initial.id,
      clientName: initial.name,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      roundsPerShift: initial.roundsPerShift,
      tagsPerSite: initial.tagsPerSite,
      nightShiftEnabled: initial.nightShiftEnabled,
      dayShift1Enabled: initial.dayShift1Enabled,
      dayShift2Enabled: initial.dayShift2Enabled,
      nightStart: initial.nightStart,
      nightEnd: initial.nightEnd,
      dayShift1Start: initial.dayShift1Start,
      dayShift1End: initial.dayShift1End,
      dayShift2Start: initial.dayShift2Start,
      dayShift2End: initial.dayShift2End,
      tagNames: [...initial.tagNames],
      tagIntervalMin: initial.tagIntervalMin,
      tagIntervalMax: initial.tagIntervalMax,
      saturdayConfig: { ...initial.saturdayConfig },
      sundayConfig: { ...initial.sundayConfig },
      customRoundSlotsEnabled: initial.customRoundSlotsEnabled ?? false,
      customRoundSlots: initial.customRoundSlots ? [...initial.customRoundSlots] : []
    };
  });

  // Sincronizzazione automatica della configurazione corrente sul profilo cliente attivo in localStorage
  useEffect(() => {
    const currentId = config.clientId || selectedClientId;
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === currentId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const updated = [...prev];
      updated[idx] = {
        ...current,
        name: config.clientName || current.name,
        roundsPerShift: config.roundsPerShift,
        tagsPerSite: config.tagsPerSite,
        tagNames: [...config.tagNames],
        tagIntervalMin: config.tagIntervalMin,
        tagIntervalMax: config.tagIntervalMax,
        nightShiftEnabled: config.nightShiftEnabled,
        nightStart: config.nightStart,
        nightEnd: config.nightEnd,
        dayShift1Enabled: config.dayShift1Enabled,
        dayShift1Start: config.dayShift1Start,
        dayShift1End: config.dayShift1End,
        dayShift2Enabled: config.dayShift2Enabled,
        dayShift2Start: config.dayShift2Start,
        dayShift2End: config.dayShift2End,
        saturdayConfig: { ...config.saturdayConfig },
        sundayConfig: { ...config.sundayConfig },
        customRoundSlotsEnabled: config.customRoundSlotsEnabled,
        customRoundSlots: config.customRoundSlots ? [...config.customRoundSlots] : []
      };
      try {
        localStorage.setItem('patrolguard_clients_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, [
    config.roundsPerShift,
    config.tagsPerSite,
    config.tagNames,
    config.tagIntervalMin,
    config.tagIntervalMax,
    config.nightShiftEnabled,
    config.nightStart,
    config.nightEnd,
    config.dayShift1Enabled,
    config.dayShift1Start,
    config.dayShift1End,
    config.dayShift2Enabled,
    config.dayShift2Start,
    config.dayShift2End,
    config.saturdayConfig,
    config.sundayConfig,
    config.customRoundSlotsEnabled,
    config.customRoundSlots,
    config.clientId,
    config.clientName,
    selectedClientId
  ]);

  const handleSelectClient = (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;
    setSelectedClientId(clientId);
    try {
      localStorage.setItem('patrolguard_selected_client_id', clientId);
    } catch (e) {}

    setConfig(prev => ({
      ...prev,
      clientId: target.id,
      clientName: target.name,
      roundsPerShift: target.roundsPerShift,
      tagsPerSite: target.tagsPerSite,
      tagNames: [...target.tagNames],
      tagIntervalMin: target.tagIntervalMin,
      tagIntervalMax: target.tagIntervalMax,
      nightShiftEnabled: target.nightShiftEnabled,
      nightStart: target.nightStart,
      nightEnd: target.nightEnd,
      dayShift1Enabled: target.dayShift1Enabled,
      dayShift1Start: target.dayShift1Start,
      dayShift1End: target.dayShift1End,
      dayShift2Enabled: target.dayShift2Enabled,
      dayShift2Start: target.dayShift2Start,
      dayShift2End: target.dayShift2End,
      saturdayConfig: { ...target.saturdayConfig },
      sundayConfig: { ...target.sundayConfig },
      customRoundSlotsEnabled: target.customRoundSlotsEnabled ?? false,
      customRoundSlots: target.customRoundSlots ? [...target.customRoundSlots] : []
    }));

    setSaveStatusMessage(`Profilo "${target.name}" caricato.`);
    setTimeout(() => setSaveStatusMessage(null), 2500);
  };

  const saveCurrentToClientExplicit = () => {
    setSaveStatusMessage(`Configurazione salvata per "${config.clientName || 'Cliente'}"!`);
    setTimeout(() => setSaveStatusMessage(null), 2500);
  };

  const handleCreateNewClient = () => {
    const name = newClientName.trim() || `Nuovo Cliente ${clients.length + 1}`;
    const newId = `cli_${Date.now()}`;
    const baseSource = newClientCopyCurrent ? config : DEFAULT_CLIENTS[0];

    const newProfile: ClientProfile = {
      id: newId,
      name,
      code: newClientCode.trim() || `CLI-${String(clients.length + 1).padStart(3, '0')}`,
      notes: newClientNotes.trim() || 'Postazione di vigilanza programmata',
      roundsPerShift: baseSource.roundsPerShift,
      tagsPerSite: baseSource.tagsPerSite,
      tagNames: [...baseSource.tagNames],
      tagIntervalMin: baseSource.tagIntervalMin,
      tagIntervalMax: baseSource.tagIntervalMax,
      nightShiftEnabled: baseSource.nightShiftEnabled,
      nightStart: baseSource.nightStart,
      nightEnd: baseSource.nightEnd,
      dayShift1Enabled: baseSource.dayShift1Enabled,
      dayShift1Start: baseSource.dayShift1Start,
      dayShift1End: baseSource.dayShift1End,
      dayShift2Enabled: baseSource.dayShift2Enabled,
      dayShift2Start: baseSource.dayShift2Start,
      dayShift2End: baseSource.dayShift2End,
      saturdayConfig: { ...baseSource.saturdayConfig },
      sundayConfig: { ...baseSource.sundayConfig },
      customRoundSlotsEnabled: baseSource.customRoundSlotsEnabled ?? false,
      customRoundSlots: baseSource.customRoundSlots ? [...baseSource.customRoundSlots] : []
    };

    const updated = [...clients, newProfile];
    setClients(updated);
    try {
      localStorage.setItem('patrolguard_clients_v2', JSON.stringify(updated));
      localStorage.setItem('patrolguard_selected_client_id', newId);
    } catch (e) {}

    setSelectedClientId(newId);
    setConfig(prev => ({
      ...prev,
      clientId: newProfile.id,
      clientName: newProfile.name,
      roundsPerShift: newProfile.roundsPerShift,
      tagsPerSite: newProfile.tagsPerSite,
      tagNames: [...newProfile.tagNames],
      tagIntervalMin: newProfile.tagIntervalMin,
      tagIntervalMax: newProfile.tagIntervalMax,
      nightShiftEnabled: newProfile.nightShiftEnabled,
      nightStart: newProfile.nightStart,
      nightEnd: newProfile.nightEnd,
      dayShift1Enabled: newProfile.dayShift1Enabled,
      dayShift1Start: newProfile.dayShift1Start,
      dayShift1End: newProfile.dayShift1End,
      dayShift2Enabled: newProfile.dayShift2Enabled,
      dayShift2Start: newProfile.dayShift2Start,
      dayShift2End: newProfile.dayShift2End,
      saturdayConfig: { ...newProfile.saturdayConfig },
      sundayConfig: { ...newProfile.sundayConfig },
      customRoundSlotsEnabled: newProfile.customRoundSlotsEnabled ?? false,
      customRoundSlots: newProfile.customRoundSlots ? [...newProfile.customRoundSlots] : []
    }));

    setShowNewClientModal(false);
    setNewClientName('');
    setNewClientCode('');
    setNewClientNotes('');
    setSaveStatusMessage(`Cliente "${name}" creato e attivato!`);
    setTimeout(() => setSaveStatusMessage(null), 3000);
  };

  const handleDuplicateClient = (targetId: string) => {
    const source = clients.find(c => c.id === targetId);
    if (!source) return;
    const newId = `cli_${Date.now()}`;
    const duplicated: ClientProfile = {
      ...source,
      id: newId,
      name: `${source.name} (Copia)`,
      code: source.code ? `${source.code}-B` : undefined,
      tagNames: [...source.tagNames],
      saturdayConfig: { ...source.saturdayConfig },
      sundayConfig: { ...source.sundayConfig },
      customRoundSlots: source.customRoundSlots ? [...source.customRoundSlots] : []
    };

    const updated = [...clients, duplicated];
    setClients(updated);
    try {
      localStorage.setItem('patrolguard_clients_v2', JSON.stringify(updated));
    } catch (e) {}
    handleSelectClient(newId);
  };

  const handleDeleteClick = (client: ClientProfile) => {
    if (clients.length <= 1) {
      setArchiveStatusMessage({
        type: 'error',
        text: "Impossibile eliminare: deve essere presente almeno un cliente configurato in archivio."
      });
      setTimeout(() => setArchiveStatusMessage(null), 3500);
      return;
    }
    setClientToDelete(client);
  };

  const confirmDeleteClient = () => {
    if (!clientToDelete) return;
    const targetId = clientToDelete.id;
    const deletedName = clientToDelete.name;

    if (clients.length <= 1) {
      setArchiveStatusMessage({
        type: 'error',
        text: "Impossibile eliminare l'unico cliente presente in archivio."
      });
      setClientToDelete(null);
      setTimeout(() => setArchiveStatusMessage(null), 3500);
      return;
    }

    const remaining = clients.filter(c => c.id !== targetId);
    setClients(remaining);
    try {
      localStorage.setItem('patrolguard_clients_v2', JSON.stringify(remaining));
    } catch (e) {}

    // Se stiamo eliminando il cliente correntemente selezionato, passiamo al primo rimanente
    if (selectedClientId === targetId || config.clientId === targetId) {
      const nextClient = remaining[0];
      setSelectedClientId(nextClient.id);
      try {
        localStorage.setItem('patrolguard_selected_client_id', nextClient.id);
      } catch (e) {}

      setConfig(prev => ({
        ...prev,
        clientId: nextClient.id,
        clientName: nextClient.name,
        roundsPerShift: nextClient.roundsPerShift,
        tagsPerSite: nextClient.tagsPerSite,
        tagNames: [...nextClient.tagNames],
        tagIntervalMin: nextClient.tagIntervalMin,
        tagIntervalMax: nextClient.tagIntervalMax,
        nightShiftEnabled: nextClient.nightShiftEnabled,
        nightStart: nextClient.nightStart,
        nightEnd: nextClient.nightEnd,
        dayShift1Enabled: nextClient.dayShift1Enabled,
        dayShift1Start: nextClient.dayShift1Start,
        dayShift1End: nextClient.dayShift1End,
        dayShift2Enabled: nextClient.dayShift2Enabled,
        dayShift2Start: nextClient.dayShift2Start,
        dayShift2End: nextClient.dayShift2End,
        saturdayConfig: { ...nextClient.saturdayConfig },
        sundayConfig: { ...nextClient.sundayConfig },
        customRoundSlotsEnabled: nextClient.customRoundSlotsEnabled ?? false,
        customRoundSlots: nextClient.customRoundSlots ? [...nextClient.customRoundSlots] : []
      }));
    }

    setClientToDelete(null);
    setArchiveStatusMessage({
      type: 'success',
      text: `Profilo "${deletedName}" eliminato con successo dall'archivio.`
    });
    setSaveStatusMessage(`Cliente "${deletedName}" eliminato.`);
    setTimeout(() => {
      setArchiveStatusMessage(null);
      setSaveStatusMessage(null);
    }, 3500);
  };

  const handleUpdateClientInfo = (id: string, name: string, code: string, notes: string) => {
    setClients(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, name, code, notes } : c);
      try {
        localStorage.setItem('patrolguard_clients_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (config.clientId === id || selectedClientId === id) {
      setConfig(prev => ({ ...prev, clientName: name }));
    }
    setEditingClient(null);
    setArchiveStatusMessage({
      type: 'success',
      text: `Dati cliente "${name}" aggiornati con successo!`
    });
    setSaveStatusMessage(`Informazioni cliente aggiornate!`);
    setTimeout(() => {
      setArchiveStatusMessage(null);
      setSaveStatusMessage(null);
    }, 2500);
  };

  const handleExportClientsJson = () => {
    const jsonStr = JSON.stringify(clients, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `configurazioni_clienti_patrolguard_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setArchiveStatusMessage({
      type: 'success',
      text: `Esportato backup JSON con ${clients.length} clienti!`
    });
    setTimeout(() => setArchiveStatusMessage(null), 3000);
  };

  const handleImportClientsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data) && data.length > 0 && data[0].name && Array.isArray(data[0].tagNames)) {
          setClients(data);
          try {
            localStorage.setItem('patrolguard_clients_v2', JSON.stringify(data));
          } catch (e) {}
          handleSelectClient(data[0].id);
          setArchiveStatusMessage({
            type: 'success',
            text: `Importati con successo ${data.length} profili cliente dal file di backup!`
          });
          setSaveStatusMessage(`Importati ${data.length} profili cliente!`);
          setTimeout(() => {
            setArchiveStatusMessage(null);
            setSaveStatusMessage(null);
          }, 3500);
        } else {
          setArchiveStatusMessage({
            type: 'error',
            text: "File JSON non valido: verificare che contenga profili cliente validi."
          });
          setTimeout(() => setArchiveStatusMessage(null), 3500);
        }
      } catch (err) {
        setArchiveStatusMessage({
          type: 'error',
          text: "Errore nella lettura del file JSON di backup."
        });
        setTimeout(() => setArchiveStatusMessage(null), 3500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addCustomSlot = () => {
    setConfig(prev => {
      const slots = prev.customRoundSlots || [];
      const newSlot: CustomRoundSlot = {
        id: Date.now().toString(),
        name: `Giro ${slots.length + 1}`,
        startTime: '00:00',
        endTime: '01:00',
        enabled: true,
        daysFilter: 'all'
      };
      return {
        ...prev,
        customRoundSlotsEnabled: true,
        customRoundSlots: [...slots, newSlot]
      };
    });
  };

  const updateCustomSlot = (id: string, field: keyof CustomRoundSlot, value: any) => {
    setConfig(prev => {
      const slots = prev.customRoundSlots || [];
      return {
        ...prev,
        customRoundSlots: slots.map(s => s.id === id ? { ...s, [field]: value } : s)
      };
    });
  };

  const removeCustomSlot = (id: string) => {
    setConfig(prev => {
      const slots = prev.customRoundSlots || [];
      return {
        ...prev,
        customRoundSlots: slots.filter(s => s.id !== id)
      };
    });
  };
  const [autoDetectTags, setAutoDetectTags] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");

  useEffect(() => {
    if (logs.length > 0) {
      const firstImported = logs.find(l => !l.isGenerated);
      if (firstImported) {
        const d = new Date(firstImported.date);
        if (!isNaN(d.getTime())) {
          setConfig(prev => ({ ...prev, month: d.getMonth(), year: d.getFullYear() }));
        }
      }
    }
  }, [logs.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedLogs = parsePatrolFile(content);
      if (parsedLogs.length === 0) {
        setAiSummary("Attenzione: nessun dato reale di ispezione trovato nel file.");
        setLogs([]);
      } else {
        setLogs(parsedLogs);
        
        // Estrazione intelligente e dinamica dei tag reali inseriti nel file
        const uniqueRealTags = Array.from(new Set(parsedLogs.map(l => l.tag)));
        if (uniqueRealTags.length > 0) {
          if (autoDetectTags) {
            setConfig(prev => {
              const updatedTagNames = [...prev.tagNames];
              uniqueRealTags.forEach((tag, idx) => {
                updatedTagNames[idx] = tag;
              });
              return {
                ...prev,
                tagNames: updatedTagNames,
                tagsPerSite: uniqueRealTags.length
              };
            });
            setAiSummary(`Caricati ${parsedLogs.length} passaggi reali. Rilevati in automatico ${uniqueRealTags.length} tag reali. Pronto per l'integrazione.`);
          } else {
            setAiSummary(`Caricati ${parsedLogs.length} passaggi reali. Configurazione client personalizzata mantenuta invariata (${config.tagsPerSite} tag configurati).`);
          }
        } else {
          setAiSummary(`Caricati ${parsedLogs.length} passaggi reali.`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processReport = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      const completeLogs = generateMissingData(logs, config);
      setLogs(completeLogs);
      setAiSummary(`Operazione conclusa. Il sistema ha integrato perfettamente i passaggi mancanti distribuendoli equamente.`);
    } catch (err) {
      console.error(err);
      setAiSummary("Errore di elaborazione. Controllare i parametri.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateWeekend = (day: 'saturday' | 'sunday', field: keyof DayConfig, value: any) => {
    setConfig(prev => {
      const current = prev[`${day}Config`];
      const updated = { ...current, [field]: value };
      
      // Auto-inizializzazione e sincronizzazione quando si abilitano i turni
      if (field === 'nightEnabled' && value === true && (!updated.nightRounds || updated.nightRounds < 1)) {
        updated.nightRounds = updated.rounds || prev.roundsPerShift || 3;
      }
      if (field === 'day1Enabled' && value === true && (!updated.day1Rounds || updated.day1Rounds < 1)) {
        updated.day1Rounds = 1;
      }
      if (field === 'day2Enabled' && value === true && (!updated.day2Rounds || updated.day2Rounds < 1)) {
        updated.day2Rounds = 1;
      }
      if (field === 'nightRounds') {
        updated.rounds = value;
      }
      return {
        ...prev,
        [`${day}Config`]: updated
      };
    });
  };

  const clearData = () => {
    setLogs([]);
    setAiSummary("Database svuotato.");
  };

  const exportToExcel = () => {
    // @ts-ignore
    if (!window.XLSX) return;
    const clientName = config.clientName || 'Cliente';
    const data = logs.map(l => ({ 
      Cliente: clientName,
      Data: l.date.split('-').reverse().join('/'), 
      Ora: l.time.substring(0, 5), 
      'Punto Ispezione': l.tag,
      'Fonte': l.isGenerated ? 'SISTEMA' : 'REALE'
    }));
    // @ts-ignore
    const ws = window.XLSX.utils.json_to_sheet(data);
    // @ts-ignore
    const wb = window.XLSX.utils.book_new();
    // @ts-ignore
    window.XLSX.utils.book_append_sheet(wb, ws, "Report");
    const safeClient = clientName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    // @ts-ignore
    window.XLSX.writeFile(wb, `Report_Patrol_${safeClient}_${config.year}_${config.month + 1}.xlsx`);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center mr-4 shadow-[0_0_20px_rgba(14,165,233,0.5)]">
            <i className="fas fa-user-shield text-2xl text-white"></i>
          </div>
          <div>
            <h1 className="text-3xl font-orbitron font-black glow-text tracking-tighter uppercase">
              Patrol<span className="text-sky-400">Guard</span> Pro
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="neon-btn text-white px-6 py-3 rounded-full cursor-pointer flex items-center font-bold uppercase text-xs tracking-widest transition-all">
            <i className="fas fa-file-import mr-2"></i> 1. Importa TXT
            <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={processReport} 
            disabled={isProcessing} 
            className="cursor-pointer bg-slate-900 border border-sky-400 text-sky-400 px-6 py-3 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-sky-400/10 active:scale-95 transition-all"
          >
            {isProcessing ? <i className="fas fa-sync fa-spin mr-2"></i> : <i className="fas fa-magic mr-2"></i>}
            2. Genera Gaps
          </button>
          {logs.length > 0 && (
            <button onClick={clearData} className="cursor-pointer text-slate-500 hover:text-red-400 p-2 transition-colors">
              <i className="fas fa-trash-alt"></i>
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="p-4" title="Configurazione Cliente & Postazione" icon="fas fa-building">
            {/* BARRA SELEZIONE E GESTIONE PROFILO CLIENTE */}
            <div className="mb-4 p-3 bg-gradient-to-r from-sky-950/40 via-slate-900/70 to-slate-900/50 border border-sky-400/30 rounded-xl space-y-2.5 shadow-[0_0_15px_rgba(14,165,233,0.08)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-orbitron font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                    <i className="fas fa-id-card text-sky-400 text-xs"></i>
                    Cliente Selezionato
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewClientName('');
                      setNewClientCode(`CLI-${String(clients.length + 1).padStart(3, '0')}`);
                      setNewClientNotes('');
                      setNewClientCopyCurrent(true);
                      setShowNewClientModal(true);
                    }}
                    className="px-2 py-1 text-[9px] font-bold bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-300 rounded-lg flex items-center gap-1 transition-all cursor-pointer select-none active:scale-95"
                    title="Crea una nuova postazione o profilo cliente"
                  >
                    <i className="fas fa-plus text-[8px]"></i> Nuovo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManageClientsModal(true)}
                    className="px-2 py-1 text-[9px] font-bold bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 text-slate-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer select-none active:scale-95"
                    title="Apri l'archivio completo per gestire, esportare o importare i clienti"
                  >
                    <i className="fas fa-folder-open text-[8px]"></i> Archivio
                  </button>
                </div>
              </div>

              {/* Selettore a tendina e pulsante Salva */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full bg-slate-950 border border-sky-400/40 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all cursor-pointer pr-6 appearance-none"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-950 text-white py-1">
                        {c.name} {c.code ? `[${c.code}]` : ''} ({c.tagsPerSite} Tag • {c.roundsPerShift} Giri)
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-sky-400/60 pointer-events-none text-[9px]"></i>
                </div>
                
                <button
                  type="button"
                  onClick={saveCurrentToClientExplicit}
                  className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-400/40 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                  title="Salva modifiche correnti sul profilo di questo cliente"
                >
                  <i className="fas fa-save text-xs"></i>
                  <span className="hidden sm:inline text-[10px]">Salva</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDuplicateClient(selectedClientId)}
                  className="w-7 h-7 bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-300 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Duplica questo cliente"
                >
                  <i className="fas fa-copy text-[10px]"></i>
                </button>
              </div>

              {/* Dettaglio riassuntivo cliente attivo */}
              <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-sky-500/10">
                <div className="truncate max-w-[210px] italic text-slate-300">
                  {activeClient?.notes || `${config.tagsPerSite} tag configurati • Notte ${config.nightStart}-${config.nightEnd}`}
                </div>
                {saveStatusMessage ? (
                  <span className="text-emerald-400 font-bold text-[8px] flex items-center gap-1 animate-pulse">
                    <i className="fas fa-check-circle"></i> {saveStatusMessage}
                  </span>
                ) : (
                  <span className="text-[8px] font-mono text-sky-400/70">
                    {activeClient?.code || 'ATTIVO'}
                  </span>
                )}
              </div>
            </div>

            {/* TASTATURA DI COMMUTAZIONE PARAMETRI */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900/80 rounded-xl border border-sky-500/10 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('base')}
                className={`cursor-pointer py-2 text-[9px] font-orbitron font-bold uppercase rounded-lg border transition-all text-center ${activeTab === 'base' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <i className="fas fa-cog block sm:inline mb-0.5 sm:mb-0 sm:mr-1"></i> Base
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shifts')}
                className={`cursor-pointer py-2 text-[9px] font-orbitron font-bold uppercase rounded-lg border transition-all text-center ${activeTab === 'shifts' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <i className="fas fa-clock block sm:inline mb-0.5 sm:mb-0 sm:mr-1"></i> Turni
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('slots')}
                className={`cursor-pointer py-2 text-[9px] font-orbitron font-bold uppercase rounded-lg border transition-all text-center ${activeTab === 'slots' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <i className="fas fa-list-ol block sm:inline mb-0.5 sm:mb-0 sm:mr-1"></i> Fasce
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekend')}
                className={`cursor-pointer py-2 text-[9px] font-orbitron font-bold uppercase rounded-lg border transition-all text-center ${activeTab === 'weekend' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <i className="fas fa-calendar-alt block sm:inline mb-0.5 sm:mb-0 sm:mr-1"></i> WEnd
              </button>
            </div>

            {activeTab === 'base' && (
              <div className="space-y-5 animate-fadeIn">
                {/* PERIODO */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/20 p-2 rounded-xl border border-sky-500/10">
                     <label className="text-[9px] text-sky-400 uppercase font-bold block mb-1">Mese</label>
                     <select value={config.month} onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})} className="w-full bg-slate-950 text-xs text-white outline-none border-b border-transparent py-0.5">
                       {["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"].map((m, i) => (
                         <option key={m} value={i} className="bg-slate-950 text-white">{m}</option>
                       ))}
                     </select>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl border border-sky-500/10">
                     <label className="text-[9px] text-sky-400 uppercase font-bold block mb-1">Anno</label>
                     <input type="number" value={config.year} onChange={(e) => setConfig({...config, year: parseInt(e.target.value)})} className="w-full bg-transparent text-xs text-white outline-none py-0.5" />
                  </div>
                </div>

                {/* PARAMETRI ISPEZIONE */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-sky-300 uppercase tracking-widest border-b border-sky-500/10 pb-1.5 flex justify-between items-center">
                    <span>Parametri Ispezioni</span>
                    <i className="fas fa-tools text-sky-400/50"></i>
                  </h3>
                  {/* Rilevatore Automatico Tag */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 transition-all select-none">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ricompatta/Rileva automatico da file</span>
                    <input 
                      type="checkbox" 
                      checked={autoDetectTags} 
                      onChange={(e) => setAutoDetectTags(e.target.checked)} 
                      className="accent-sky-500 w-4 h-4 cursor-pointer" 
                    />
                  </div>

                  <NumericStepper 
                    label="Tag per Giro" 
                    value={config.tagsPerSite} 
                    min={1} 
                    max={20} 
                    onChange={(val) => {
                      setAutoDetectTags(false);
                      setConfig({...config, tagsPerSite: val});
                    }} 
                  />
                  
                  {/* GENERATORE / CONFIGURATORE DINAMICO NOMI TAG */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Edita Nomi Tag Attivi ({config.tagsPerSite})</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {Array.from({ length: config.tagsPerSite }).map((_, index) => {
                        const currentVal = config.tagNames[index] || `Ispezione: ${index + 1}`;
                        return (
                          <div key={index} className="flex gap-2">
                            <span className="text-[10px] font-mono w-5 h-7 flex items-center justify-center bg-sky-500/5 border border-sky-400/20 text-sky-400 rounded-lg">{index + 1}</span>
                            <input 
                              type="text" 
                              value={currentVal} 
                              onChange={(e) => {
                                setAutoDetectTags(false);
                                const newTagNames = [...config.tagNames];
                                newTagNames[index] = e.target.value;
                                setConfig(prev => ({ ...prev, tagNames: newTagNames }));
                              }}
                              className="flex-1 bg-black/40 border border-sky-500/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-sky-400/30 transition-all"
                              placeholder={`Punto Ispezione ${index + 1}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <NumericStepper 
                      label="Gap Min" 
                      value={config.tagIntervalMin} 
                      min={1} 
                      max={15} 
                      onChange={(val) => setConfig({...config, tagIntervalMin: val})} 
                      suffix="m"
                    />
                    <NumericStepper 
                      label="Gap Max" 
                      value={config.tagIntervalMax} 
                      min={1} 
                      max={30} 
                      onChange={(val) => setConfig({...config, tagIntervalMax: Math.max(config.tagIntervalMin, val)})} 
                      suffix="m"
                    />
                  </div>

                  <div className="pt-2">
                    {/* SINCRONIZZAZIONE AUTOMATICA: quando cambia questo, aggiorna anche sabato e domenica come richiesto */}
                    <NumericStepper 
                      label="Giri richiesti" 
                      value={config.roundsPerShift} 
                      min={1} 
                      max={12} 
                      onChange={(val) => setConfig(prev => ({
                        ...prev, 
                        roundsPerShift: val,
                        saturdayConfig: { ...prev.saturdayConfig, rounds: val },
                        sundayConfig: { ...prev.sundayConfig, rounds: val }
                      }))} 
                    />
                    <span className="text-[8px] text-sky-400/60 mt-1.5 block italic leading-tight">
                      * NOTA: La modifica dei Giri qui sincronizza istantaneamente le variazioni di sabato e domenica.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shifts' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[10px] font-bold text-sky-300 uppercase tracking-widest border-b border-sky-500/10 pb-1.5 flex justify-between items-center mb-1">
                  <span>Pianificazione Servizi</span>
                  <i className="fas fa-calendar-check text-sky-400/50"></i>
                </h3>

                {/* NOTTURNO */}
                <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/10 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-sky-100 font-bold block">Servizio Notturno</span>
                    <input 
                      type="checkbox" 
                      checked={config.nightShiftEnabled} 
                      onChange={e => setConfig({...config, nightShiftEnabled: e.target.checked})} 
                      className="accent-sky-500 w-4 h-4 cursor-pointer" 
                    />
                  </div>
                  {config.nightShiftEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-500/10 mt-1">
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Inizio FASCE</label>
                        <input 
                          type="time" 
                          value={config.nightStart} 
                          onChange={e => setConfig({...config, nightStart: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Fine Fasce</label>
                        <input 
                          type="time" 
                          value={config.nightEnd} 
                          onChange={e => setConfig({...config, nightEnd: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* DIURNO MATTINA */}
                <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/10 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-sky-100 font-bold block">Diurno Mattina</span>
                    <input 
                      type="checkbox" 
                      checked={config.dayShift1Enabled} 
                      onChange={e => setConfig({...config, dayShift1Enabled: e.target.checked})} 
                      className="accent-sky-500 w-4 h-4 cursor-pointer" 
                    />
                  </div>
                  {config.dayShift1Enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-500/10 mt-1">
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Inizio Fasce</label>
                        <input 
                          type="time" 
                          value={config.dayShift1Start} 
                          onChange={e => setConfig({...config, dayShift1Start: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Fine Fasce</label>
                        <input 
                          type="time" 
                          value={config.dayShift1End} 
                          onChange={e => setConfig({...config, dayShift1End: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* DIURNO POMERIGGIO */}
                <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/10 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-sky-100 font-bold block">Diurno Pomeriggio</span>
                    <input 
                      type="checkbox" 
                      checked={config.dayShift2Enabled} 
                      onChange={e => setConfig({...config, dayShift2Enabled: e.target.checked})} 
                      className="accent-sky-500 w-4 h-4 cursor-pointer" 
                    />
                  </div>
                  {config.dayShift2Enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-500/10 mt-1">
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Inizio Fasce</label>
                        <input 
                          type="time" 
                          value={config.dayShift2Start} 
                          onChange={e => setConfig({...config, dayShift2Start: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Fine Fasce</label>
                        <input 
                          type="time" 
                          value={config.dayShift2End} 
                          onChange={e => setConfig({...config, dayShift2End: e.target.value})} 
                          className="w-full bg-slate-900 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'slots' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[10px] font-bold text-sky-300 uppercase tracking-widest border-b border-sky-500/10 pb-1.5 flex justify-between items-center mb-1">
                  <span>Fasce Orarie Specifiche / Aperture</span>
                  <i className="fas fa-list-ol text-sky-400/50"></i>
                </h3>

                {/* Switch Attivazione Fasce Specifiche */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 transition-all select-none">
                  <div className="pr-2">
                    <span className="text-xs font-bold text-sky-200 block">Attiva Fasce Giri Specifici</span>
                    <span className="text-[9px] text-slate-400 block leading-tight mt-0.5">
                      Genera i singoli giri rispettando le fasce ed orari qui definiti
                    </span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={config.customRoundSlotsEnabled ?? false} 
                    onChange={e => setConfig({...config, customRoundSlotsEnabled: e.target.checked})} 
                    className="accent-sky-500 w-5 h-5 cursor-pointer shrink-0" 
                  />
                </div>

                {config.customRoundSlotsEnabled ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Fasce Orarie Configurate ({config.customRoundSlots?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={addCustomSlot}
                        className="cursor-pointer text-[10px] bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 font-bold py-1 px-2.5 rounded-lg transition-all flex items-center gap-1"
                      >
                        <i className="fas fa-plus text-[9px]"></i> Nuova Fascia
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {config.customRoundSlots?.map((slot) => (
                        <div key={slot.id} className="bg-slate-900/90 p-3 rounded-xl border border-sky-500/15 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <input 
                              type="text" 
                              value={slot.name} 
                              onChange={e => updateCustomSlot(slot.id, 'name', e.target.value)}
                              className="bg-black/40 border border-sky-500/20 rounded-lg px-2.5 py-1 text-xs text-sky-200 font-bold outline-none flex-1 focus:border-sky-400"
                              placeholder="Nome Giro / Apertura"
                            />
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                checked={slot.enabled} 
                                onChange={e => updateCustomSlot(slot.id, 'enabled', e.target.checked)}
                                className="accent-sky-500 w-4 h-4 cursor-pointer"
                                title="Abilita / Disabilita questa fascia"
                              />
                              <button
                                type="button"
                                onClick={() => removeCustomSlot(slot.id)}
                                className="text-slate-500 hover:text-red-400 text-xs p-1 transition-colors cursor-pointer"
                                title="Elimina fascia"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                              <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Ora Inizio</label>
                              <input 
                                type="time" 
                                value={slot.startTime} 
                                onChange={e => updateCustomSlot(slot.id, 'startTime', e.target.value)}
                                className="w-full bg-black/50 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-sky-400/40"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] text-slate-400 font-bold uppercase block mb-1">Ora Fine / Fissa</label>
                              <input 
                                type="time" 
                                value={slot.endTime} 
                                onChange={e => updateCustomSlot(slot.id, 'endTime', e.target.value)}
                                className="w-full bg-black/50 border border-sky-500/15 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-sky-400/40"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className="text-[8px] uppercase font-bold text-slate-400">Giorni:</span>
                            <select
                              value={slot.daysFilter || 'all'}
                              onChange={e => updateCustomSlot(slot.id, 'daysFilter', e.target.value)}
                              className="bg-black/50 border border-sky-500/15 text-[10px] text-sky-300 font-bold rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                            >
                              <option value="all">Tutti i giorni</option>
                              <option value="weekdays">Solo Lun-Ven</option>
                              <option value="weekend">Solo Sabato e Domenica</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-center text-[10px] text-slate-400 italic">
                    I giri verranno distribuiti automaticamente nei Turni Generali (notturno/diurno). Attiva il selettore sopra per definire fasce specifiche.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'weekend' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border-b border-emerald-500/20 pb-2 flex justify-between items-center mb-1">
                  <div>
                    <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      Variazioni Weekend (Sabato / Domenica)
                    </h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Configura i singoli turni ed il numero di giri per Notte, Mattina e Pomeriggio
                    </p>
                  </div>
                  <i className="fas fa-adjust text-emerald-400/55 text-sm"></i>
                </div>
                
                {/* SABATO */}
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/25 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-500/10">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide block">Sabato</span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {((config.saturdayConfig.nightEnabled ? (config.saturdayConfig.nightRounds ?? config.saturdayConfig.rounds ?? 3) : 0) +
                          (config.saturdayConfig.day1Enabled ? (config.saturdayConfig.day1Rounds ?? 1) : 0) +
                          (config.saturdayConfig.day2Enabled ? (config.saturdayConfig.day2Rounds ?? 1) : 0))} giri totali programmati
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => updateWeekend('saturday', 'nightEnabled', !config.saturdayConfig.nightEnabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.saturdayConfig.nightEnabled ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Turno Notturno"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> N
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateWeekend('saturday', 'day1Enabled', !config.saturdayConfig.day1Enabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.saturdayConfig.day1Enabled ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Diurno Mattina"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> M
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateWeekend('saturday', 'day2Enabled', !config.saturdayConfig.day2Enabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.saturdayConfig.day2Enabled ? 'bg-orange-500/20 border-orange-400 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Diurno Pomeriggio"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> P
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {config.saturdayConfig.nightEnabled && (
                      <NumericStepper 
                        label="Giri Notturni" 
                        badge="N"
                        badgeClass="bg-sky-500/20 text-sky-300 border border-sky-400/30"
                        value={config.saturdayConfig.nightRounds ?? config.saturdayConfig.rounds ?? 3} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('saturday', 'nightRounds', val)} 
                      />
                    )}
                    {config.saturdayConfig.day1Enabled && (
                      <NumericStepper 
                        label="Giri Mattina" 
                        badge="M"
                        badgeClass="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                        value={config.saturdayConfig.day1Rounds ?? 1} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('saturday', 'day1Rounds', val)} 
                      />
                    )}
                    {config.saturdayConfig.day2Enabled && (
                      <NumericStepper 
                        label="Giri Pomeriggio" 
                        badge="P"
                        badgeClass="bg-orange-500/20 text-orange-300 border border-orange-400/30"
                        value={config.saturdayConfig.day2Rounds ?? 1} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('saturday', 'day2Rounds', val)} 
                      />
                    )}
                    {!config.saturdayConfig.nightEnabled && !config.saturdayConfig.day1Enabled && !config.saturdayConfig.day2Enabled && (
                      <div className="text-center py-2 text-[10px] text-slate-500 italic bg-black/20 rounded-lg">
                        Nessun turno abilitato per il Sabato. Clicca su N, M o P per attivare i servizi.
                      </div>
                    )}
                  </div>
                </div>

                {/* DOMENICA */}
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/25 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-500/10">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide block">Domenica</span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {((config.sundayConfig.nightEnabled ? (config.sundayConfig.nightRounds ?? config.sundayConfig.rounds ?? 3) : 0) +
                          (config.sundayConfig.day1Enabled ? (config.sundayConfig.day1Rounds ?? 1) : 0) +
                          (config.sundayConfig.day2Enabled ? (config.sundayConfig.day2Rounds ?? 1) : 0))} giri totali programmati
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => updateWeekend('sunday', 'nightEnabled', !config.sundayConfig.nightEnabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.sundayConfig.nightEnabled ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Turno Notturno"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> N
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateWeekend('sunday', 'day1Enabled', !config.sundayConfig.day1Enabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.sundayConfig.day1Enabled ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Diurno Mattina"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> M
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateWeekend('sunday', 'day2Enabled', !config.sundayConfig.day2Enabled)} 
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 border transition-all cursor-pointer ${config.sundayConfig.day2Enabled ? 'bg-orange-500/20 border-orange-400 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'border-slate-800 text-slate-500 bg-black/20'}`}
                        title="Attiva/Disattiva Diurno Pomeriggio"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> P
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {config.sundayConfig.nightEnabled && (
                      <NumericStepper 
                        label="Giri Notturni" 
                        badge="N"
                        badgeClass="bg-sky-500/20 text-sky-300 border border-sky-400/30"
                        value={config.sundayConfig.nightRounds ?? config.sundayConfig.rounds ?? 3} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('sunday', 'nightRounds', val)} 
                      />
                    )}
                    {config.sundayConfig.day1Enabled && (
                      <NumericStepper 
                        label="Giri Mattina" 
                        badge="M"
                        badgeClass="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                        value={config.sundayConfig.day1Rounds ?? 1} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('sunday', 'day1Rounds', val)} 
                      />
                    )}
                    {config.sundayConfig.day2Enabled && (
                      <NumericStepper 
                        label="Giri Pomeriggio" 
                        badge="P"
                        badgeClass="bg-orange-500/20 text-orange-300 border border-orange-400/30"
                        value={config.sundayConfig.day2Rounds ?? 1} 
                        min={1} 
                        max={12} 
                        onChange={(val) => updateWeekend('sunday', 'day2Rounds', val)} 
                      />
                    )}
                    {!config.sundayConfig.nightEnabled && !config.sundayConfig.day1Enabled && !config.sundayConfig.day2Enabled && (
                      <div className="text-center py-2 text-[10px] text-slate-500 italic bg-black/20 rounded-lg">
                        Nessun turno abilitato per la Domenica. Clicca su N, M o P per attivare i servizi.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* DASHBOARD STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass p-4 rounded-xl border-l-4 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)]">
              <span className="block text-[10px] text-amber-400 font-bold uppercase mb-1 flex items-center gap-1.5">
                <i className="fas fa-building text-xs"></i> Cliente Attivo
              </span>
              <span className="text-base font-orbitron font-bold text-white truncate block" title={config.clientName || 'Cliente'}>
                {config.clientName || 'Cliente'}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                {config.tagsPerSite} Tag • {config.roundsPerShift} Giri/Turno
              </span>
            </div>

            <div className="glass p-4 rounded-xl border-l-4 border-sky-500">
              <span className="block text-[10px] text-sky-500 font-bold uppercase mb-1">Passaggi Caricati REALI</span>
              <span className="text-2xl font-orbitron text-white">{logs.filter(l => !l.isGenerated).length}</span>
            </div>

            <div className="glass p-4 rounded-xl border-l-4 border-emerald-500">
              <span className="block text-[10px] text-emerald-500 font-bold uppercase mb-1">Passaggi INTEGRATI DA SISTEMA</span>
              <span className="text-2xl font-orbitron text-white">{logs.filter(l => l.isGenerated).length}</span>
            </div>

            <div className="glass p-4 rounded-xl border-l-4 border-indigo-500">
              <span className="block text-[10px] text-indigo-500 font-bold uppercase mb-1">Stato Operativo</span>
              <span className="text-xs text-slate-300 italic leading-snug line-clamp-2">{aiSummary || "Pronto per l'elaborazione"}</span>
            </div>
          </div>

          <Card title="Database Ispezioni Integrato" icon="fas fa-database" className="flex-1 flex flex-col min-h-[600px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Visualizzazione Tabella</span>
                <span className="text-[10px] font-bold text-sky-300 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/20">
                  <i className="fas fa-building mr-1 text-[9px]"></i> {config.clientName || 'Cliente'}
                </span>
              </div>
              <button 
                type="button"
                onClick={exportToExcel} 
                disabled={logs.length === 0} 
                className="cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-1.5 px-4 rounded-lg transition-all disabled:opacity-30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              >
                <i className="fas fa-file-excel mr-2 text-emerald-400"></i> Scarica Report Excel ({config.clientName})
              </button>
            </div>
            <div className="flex-1 overflow-auto border border-sky-500/10 rounded-xl bg-black/30">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-sky-500/20 z-10">
                  <tr className="text-sky-500/70 font-orbitron uppercase">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Giorno</th>
                    <th className="px-4 py-3">Ora</th>
                    <th className="px-4 py-3">Punto Ispezione (Tag)</th>
                    <th className="px-4 py-3 text-right">Fonte Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.length > 0 ? logs.map((l, i) => {
                    const d = new Date(l.date);
                    const dayLabel = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][d.getDay()];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <tr key={i} className="hover:bg-sky-500/5 transition-colors">
                        <td className="px-4 py-2 font-mono text-slate-400">{l.date.split('-').reverse().join('/')}</td>
                        <td className={`px-4 py-2 font-bold ${isWeekend ? 'text-emerald-400' : 'text-slate-400'}`}>{dayLabel}</td>
                        <td className="px-4 py-2 font-mono text-sky-400 font-bold">{l.time.substring(0, 5)}</td>
                        <td className="px-4 py-2 text-slate-100 font-medium">{l.tag}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.isGenerated ? 'text-emerald-400 bg-emerald-400/15' : 'text-sky-400 bg-sky-400/15'}`}>
                            {l.isGenerated ? 'SISTEMA (INTEGRATO)' : 'REALE'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="py-32 text-center opacity-30 uppercase tracking-[0.3em] text-xs">Caricare un file TXT per iniziare l'editing per {config.clientName}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {/* MODALE: CREAZIONE NUOVO CLIENTE */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(14,165,233,0.3)] space-y-4">
            <div className="flex justify-between items-center border-b border-sky-500/20 pb-3">
              <h3 className="text-lg font-orbitron font-bold text-sky-200 flex items-center gap-2">
                <i className="fas fa-plus-circle text-sky-400"></i>
                Nuovo Profilo Cliente
              </h3>
              <button 
                onClick={() => setShowNewClientModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nome Cliente / Postazione *
                </label>
                <input 
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Es: Deposito Doganale Est"
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Codice Identificativo (Opzionale)
                </label>
                <input 
                  type="text"
                  value={newClientCode}
                  onChange={(e) => setNewClientCode(e.target.value)}
                  placeholder="Es: CLI-004"
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Note / Descrizione del Servizio
                </label>
                <textarea 
                  rows={2}
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="Es: Ispezione banchine e porte emergenza, ronda notturna"
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-sky-500/5 border border-sky-500/10 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase text-sky-300 block">
                  Configurazione Iniziale di Giri, Orari e Tag:
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input 
                    type="radio"
                    name="clientInitMode"
                    checked={newClientCopyCurrent}
                    onChange={() => setNewClientCopyCurrent(true)}
                    className="accent-sky-500"
                  />
                  <span>Duplica impostazioni attuali (<b>{config.clientName}</b>)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input 
                    type="radio"
                    name="clientInitMode"
                    checked={!newClientCopyCurrent}
                    onChange={() => setNewClientCopyCurrent(false)}
                    className="accent-sky-500"
                  />
                  <span>Inizia con modello base standard</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sky-500/10">
              <button 
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-all"
              >
                Annulla
              </button>
              <button 
                type="button"
                onClick={handleCreateNewClient}
                disabled={!newClientName.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-lg transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] disabled:opacity-40"
              >
                Crea & Attiva Profilo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: ARCHIVIO & GESTIONE COMPLETA PROFILI CLIENTI */}
      {showManageClientsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(14,165,233,0.35)]">
            {/* Header del modale */}
            <div className="p-5 border-b border-sky-500/20 flex justify-between items-center bg-slate-950/40 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-orbitron font-bold text-sky-200 flex items-center gap-2.5">
                  <i className="fas fa-folder-open text-sky-400"></i>
                  Archivio Profili Clienti & Postazioni
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ogni cliente conserva la propria configurazione specifica di giri, fasce orarie, turni e punti tag.
                </p>
              </div>
              <button 
                onClick={() => setShowManageClientsModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>

            {/* Banner notifiche/stato Archivio */}
            {archiveStatusMessage && (
              <div className={`mx-5 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
                archiveStatusMessage.type === 'success' 
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' 
                  : 'bg-red-500/15 border-red-400/40 text-red-300'
              }`}>
                <div className="flex items-center gap-2">
                  <i className={`fas ${archiveStatusMessage.type === 'success' ? 'fa-check-circle text-emerald-400' : 'fa-exclamation-circle text-red-400'}`}></i>
                  <span>{archiveStatusMessage.text}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setArchiveStatusMessage(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            )}

            {/* Azioni rapide Archivio (Import/Export/Nuovo) */}
            <div className="p-4 border-b border-sky-500/10 bg-slate-900/60 flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs font-mono text-slate-300">
                Clienti registrati: <b className="text-sky-400">{clients.length}</b>
              </span>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={handleExportClientsJson}
                  className="px-3 py-1.5 text-xs font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Esporta un file JSON con tutti i clienti e le loro configurazioni"
                >
                  <i className="fas fa-file-export"></i> Esporta Backup (JSON)
                </button>

                <label className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer">
                  <i className="fas fa-file-import"></i> Importa Backup (JSON)
                  <input type="file" accept=".json" onChange={handleImportClientsJson} className="hidden" />
                </label>

                <button 
                  type="button"
                  onClick={() => {
                    setShowManageClientsModal(false);
                    setNewClientName('');
                    setNewClientCode(`CLI-${String(clients.length + 1).padStart(3, '0')}`);
                    setNewClientNotes('');
                    setNewClientCopyCurrent(true);
                    setShowNewClientModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(14,165,233,0.3)] cursor-pointer"
                >
                  <i className="fas fa-plus"></i> + Nuovo Cliente
                </button>
              </div>
            </div>

            {/* Elenco dei profili */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              {clients.map((client) => {
                const isSelected = client.id === selectedClientId;
                return (
                  <div 
                    key={client.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-sky-500/10 border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.15)]' 
                        : 'bg-black/30 border-slate-800 hover:border-sky-500/30 hover:bg-black/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]' : 'bg-slate-800 text-slate-400'}`}>
                          <i className="fas fa-building"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-orbitron font-bold text-white">{client.name}</h4>
                            {client.code && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-400/20 font-bold">
                                {client.code}
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 uppercase tracking-wider animate-pulse">
                                In Uso
                              </span>
                            )}
                          </div>
                          {client.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{client.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Azioni per cliente */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {!isSelected && (
                          <button 
                            type="button"
                            onClick={() => {
                              handleSelectClient(client.id);
                              setShowManageClientsModal(false);
                            }}
                            className="px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <i className="fas fa-check"></i> Attiva
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => setEditingClient(client)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                          title="Rinomina e modifica note"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDuplicateClient(client.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                          title="Duplica cliente"
                        >
                          <i className="fas fa-copy"></i>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteClick(client)}
                          disabled={clients.length <= 1}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-red-950/80 hover:text-red-400 border border-slate-700 hover:border-red-500/50 text-slate-400 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-1.5"
                          title={clients.length <= 1 ? "Impossibile eliminare l'unico cliente presente in archivio" : `Elimina ${client.name}`}
                        >
                          <i className="fas fa-trash-alt text-red-400/80"></i>
                          <span className="hidden sm:inline text-[11px] font-medium">Elimina</span>
                        </button>
                      </div>
                    </div>

                    {/* Scheda di sintesi configurazione del cliente */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[10px]">
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-400 block font-bold mb-0.5">🌙 Turno Notte</span>
                        <span className="text-white font-mono">{client.nightStart} - {client.nightEnd}</span>
                        <span className="text-sky-400 block font-bold mt-0.5">({client.roundsPerShift} giri/notte)</span>
                      </div>

                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-400 block font-bold mb-0.5">☀️ Turni Diurni</span>
                        <span className="text-slate-300 block">
                          M: {client.dayShift1Enabled ? `${client.dayShift1Start}-${client.dayShift1End}` : 'Disattivo'}
                        </span>
                        <span className="text-slate-300 block">
                          P: {client.dayShift2Enabled ? `${client.dayShift2Start}-${client.dayShift2End}` : 'Disattivo'}
                        </span>
                      </div>

                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-400 block font-bold mb-0.5">🏷️ Tag Ispezione ({client.tagsPerSite})</span>
                        <span className="text-slate-300 line-clamp-2" title={client.tagNames.join(' • ')}>
                          {client.tagNames.slice(0, 2).join(' • ')} {client.tagNames.length > 2 ? `(+${client.tagNames.length - 2})` : ''}
                        </span>
                      </div>

                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-400 block font-bold mb-0.5">📅 Weekend Programmati</span>
                        <span className="text-emerald-400 block">
                          Sab: {client.saturdayConfig.nightEnabled ? `${client.saturdayConfig.nightRounds ?? client.saturdayConfig.rounds ?? 3}N ` : ''}
                          {client.saturdayConfig.day1Enabled ? `${client.saturdayConfig.day1Rounds ?? 1}M ` : ''}
                          {client.saturdayConfig.day2Enabled ? `${client.saturdayConfig.day2Rounds ?? 1}P` : ''}
                        </span>
                        <span className="text-emerald-400 block">
                          Dom: {client.sundayConfig.nightEnabled ? `${client.sundayConfig.nightRounds ?? client.sundayConfig.rounds ?? 3}N ` : ''}
                          {client.sundayConfig.day1Enabled ? `${client.sundayConfig.day1Rounds ?? 1}M ` : ''}
                          {client.sundayConfig.day2Enabled ? `${client.sundayConfig.day2Rounds ?? 1}P` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer modale */}
            <div className="p-4 border-t border-sky-500/20 bg-slate-950/40 rounded-b-2xl flex justify-end">
              <button 
                type="button"
                onClick={() => setShowManageClientsModal(false)}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-bold transition-all"
              >
                Chiudi Archivio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: MODIFICA DATI RAPIDI CLIENTE (NOME / NOTE) */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(14,165,233,0.3)] space-y-4">
            <div className="flex justify-between items-center border-b border-sky-500/20 pb-3">
              <h3 className="text-base font-orbitron font-bold text-sky-200">
                Modifica Intestazione Cliente
              </h3>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-white p-1">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nome Cliente
                </label>
                <input 
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Codice Identificativo
                </label>
                <input 
                  type="text"
                  value={editingClient.code || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, code: e.target.value })}
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Note / Descrizione
                </label>
                <textarea 
                  rows={2}
                  value={editingClient.notes || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-sky-500/20 focus:border-sky-400 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sky-500/10">
              <button 
                type="button"
                onClick={() => setEditingClient(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-all"
              >
                Annulla
              </button>
              <button 
                type="button"
                onClick={() => handleUpdateClientInfo(editingClient.id, editingClient.name, editingClient.code || '', editingClient.notes || '')}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-lg transition-all"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: CONFERMA ELIMINAZIONE PROFILO CLIENTE */}
      {clientToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(239,68,68,0.35)] space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <i className="fas fa-exclamation-triangle text-lg"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-orbitron font-bold text-red-200">
                  Elimina Profilo Cliente
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sei sicuro di voler eliminare definitivamente il profilo di <strong className="text-white font-semibold">"{clientToDelete.name}"</strong>?
                </p>
                {clientToDelete.code && (
                  <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-400/20">
                    Codice: {clientToDelete.code}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-xs text-red-300/90 space-y-1.5">
              <p className="font-semibold text-red-200 flex items-center gap-1.5">
                <i className="fas fa-info-circle text-xs"></i> Azione Irreversibile
              </p>
              <p className="text-[11px] leading-relaxed">
                Tutte le configurazioni associate a questa postazione (giri richiesti feriali e weekend, fasce orarie, turni e punti tag di ispezione) verranno rimosse dall'archivio locale.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDeleteClient}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fas fa-trash-alt"></i> Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
