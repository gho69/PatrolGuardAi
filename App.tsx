import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePatrolFile } from './utils/parser';
import { generateMissingData } from './utils/generator';
import { PatrolLog, SiteConfig, ReportData, DayConfig, CustomRoundSlot } from './types';

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

const App: React.FC = () => {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [activeTab, setActiveTab] = useState<'base' | 'shifts' | 'slots' | 'weekend'>('base');
  const [config, setConfig] = useState<SiteConfig>({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    roundsPerShift: 1, // Default a 1 per notte/giorno secondo l'esigenza del cliente corporativo
    tagsPerSite: 2,    // Default a 2 tag come da configurazione cliente nell'immagine
    nightShiftEnabled: true,
    dayShift1Enabled: false,
    dayShift2Enabled: false,
    nightStart: "23:00",
    nightEnd: "06:00",
    dayShift1Start: "06:00",
    dayShift1End: "14:00",
    dayShift2Start: "14:00",
    dayShift2End: "22:00",
    tagNames: [
      "Ispezione: 1 INGRESSO UFFICI",
      "Ispezione: 2 VIA GRANAROLO"
    ],
    tagIntervalMin: 2,
    tagIntervalMax: 5,
    saturdayConfig: { nightEnabled: true, day1Enabled: false, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 1, day2Rounds: 1 },
    sundayConfig: { nightEnabled: true, day1Enabled: false, day2Enabled: false, rounds: 3, nightRounds: 3, day1Rounds: 1, day2Rounds: 1 },
    customRoundSlotsEnabled: false,
    customRoundSlots: [
      { id: '1', name: '1° Giro Notturno', startTime: '00:00', endTime: '01:00', enabled: true, daysFilter: 'all' },
      { id: '2', name: '2° Giro Notturno', startTime: '02:00', endTime: '03:00', enabled: true, daysFilter: 'all' },
      { id: '3', name: 'Apertura Obbligatoria', startTime: '04:30', endTime: '05:00', enabled: true, daysFilter: 'all' }
    ]
  });

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
    const data = logs.map(l => ({ 
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
    // @ts-ignore
    window.XLSX.writeFile(wb, `Report_Patrol_${config.year}_${config.month + 1}.xlsx`);
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
          <Card className="p-4" title="Configurazione Client" icon="fas fa-sliders">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <span className="text-xs text-slate-405 italic leading-snug line-clamp-2">{aiSummary || "Nessun dato caricato nel sistema"}</span>
            </div>
          </div>

          <Card title="Database Ispezioni Integrato" icon="fas fa-database" className="flex-1 flex flex-col min-h-[600px]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Visualizzazione Tabella</span>
              <button 
                type="button"
                onClick={exportToExcel} 
                disabled={logs.length === 0} 
                className="cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1 px-4 rounded transition-all disabled:opacity-30"
              >
                <i className="fas fa-download mr-2"></i> Scarica Report Excel
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
                        <td className="px-4 py-2 font-mono text-sky-450 font-bold">{l.time.substring(0, 5)}</td>
                        <td className="px-4 py-2 text-slate-100 font-medium">{l.tag}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.isGenerated ? 'text-emerald-450 bg-emerald-400/15' : 'text-sky-450 bg-sky-400/15'}`}>
                            {l.isGenerated ? 'SISTEMA (INTEGRATO)' : 'REALE'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="py-32 text-center opacity-25 uppercase tracking-[0.3em] text-xs">Caricare un file TXT per iniziare l'editing</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default App;
