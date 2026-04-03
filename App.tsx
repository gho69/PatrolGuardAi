
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePatrolFile } from './utils/parser';
import { generateMissingData } from './utils/generator';
import { PatrolLog, SiteConfig, ReportData, DayConfig } from './types';

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

const App: React.FC = () => {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [config, setConfig] = useState<SiteConfig>({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    roundsPerShift: 2, // Default a 2 per le ispezioni notturne come richiesto
    tagsPerSite: 5,    // Default a 5 tag come da screenshot
    nightShiftEnabled: true,
    dayShiftEnabled: false,
    nightStart: "23:00",
    nightEnd: "06:00",
    dayStart: "08:00",
    dayEnd: "18:00",
    tagNames: [
      "Ispezione: 1 INGRESSO UFFICI",
      "Ispezione: 2 VIA GRANAROLO",
      "Ispezione: 3 WEELNESS",
      "Ispezione: 4 PERIMETRO CONFINANTE (VICINO)",
      "Ispezione: 5 RETRO TAGLIO"
    ],
    tagIntervalMin: 2,
    tagIntervalMax: 5,
    saturdayConfig: { nightEnabled: true, dayEnabled: false, rounds: 2 },
    sundayConfig: { nightEnabled: true, dayEnabled: false, rounds: 2 }
  });
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
        setAiSummary("Attenzione: nessun dato reale trovato nel file.");
        setLogs([]);
      } else {
        setLogs(parsedLogs);
        setAiSummary(`Caricati ${parsedLogs.length} passaggi reali. Pronto a colmare i giorni mancanti.`);
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
      setAiSummary(`Operazione conclusa. Il sistema ha generato i turni mancanti garantendo la copertura totale.`);
    } catch (err) {
      console.error(err);
      setAiSummary("Errore di elaborazione. Controllare i parametri.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateWeekend = (day: 'saturday' | 'sunday', field: keyof DayConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [`${day}Config`]: { ...prev[`${day}Config`], [field]: value }
    }));
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
      'Fonte': l.isGenerated ? 'SISTEMA' : 'OPERATORE'
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
          <label className="neon-btn text-white px-6 py-3 rounded-full cursor-pointer flex items-center font-bold uppercase text-xs tracking-widest">
            <i className="fas fa-file-import mr-2"></i> 1. Importa TXT
            <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
          </label>
          <button onClick={processReport} disabled={isProcessing} className="bg-transparent border border-sky-400 text-sky-400 px-6 py-3 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-sky-400/10">
            {isProcessing ? <i className="fas fa-sync fa-spin mr-2"></i> : <i className="fas fa-magic mr-2"></i>}
            2. Genera Gaps
          </button>
          {logs.length > 0 && (
            <button onClick={clearData} className="text-slate-500 hover:text-red-400 p-2 transition-colors">
              <i className="fas fa-undo-alt"></i>
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card title="Configurazione Client" icon="fas fa-sliders">
            <div className="space-y-6">
              {/* PERIODO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 p-2 rounded border border-sky-500/10">
                   <label className="text-[9px] text-sky-400 uppercase font-bold block mb-1">Mese</label>
                   <select value={config.month} onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})} className="w-full bg-transparent text-xs text-white outline-none">
                     {["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"].map((m, i) => (
                       <option key={m} value={i} className="bg-slate-900">{m}</option>
                     ))}
                   </select>
                </div>
                <div className="bg-black/20 p-2 rounded border border-sky-500/10">
                   <label className="text-[9px] text-sky-400 uppercase font-bold block mb-1">Anno</label>
                   <input type="number" value={config.year} onChange={(e) => setConfig({...config, year: parseInt(e.target.value)})} className="w-full bg-transparent text-xs text-white outline-none" />
                </div>
              </div>

              {/* PARAMETRI ISPEZIONE */}
              <div className="pt-4 border-t border-sky-500/10">
                <h3 className="text-[10px] font-bold text-sky-300 uppercase mb-3 tracking-widest">Parametri Tecnici</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-400 uppercase">Tag per Giro: {config.tagsPerSite}</span>
                    </div>
                    <input type="range" min="1" max="20" value={config.tagsPerSite} onChange={(e) => setConfig({...config, tagsPerSite: parseInt(e.target.value)})} className="w-full accent-sky-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 bg-sky-500/5 p-2 rounded border border-sky-500/10">
                    <div>
                      <span className="text-[9px] text-sky-400/60 uppercase block mb-1">Gap Min: {config.tagIntervalMin}m</span>
                      <input type="range" min="1" max="10" value={config.tagIntervalMin} onChange={(e) => setConfig({...config, tagIntervalMin: parseInt(e.target.value)})} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <span className="text-[9px] text-sky-400/60 uppercase block mb-1">Gap Max: {config.tagIntervalMax}m</span>
                      <input type="range" min="1" max="20" value={config.tagIntervalMax} onChange={(e) => setConfig({...config, tagIntervalMax: Math.max(config.tagIntervalMin, parseInt(e.target.value))})} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* TURNI STANDARD */}
              <div className="pt-4 border-t border-sky-500/10">
                <h3 className="text-[10px] font-bold text-sky-300 uppercase mb-3 tracking-widest">Turni Giornalieri (Sempre Attivi)</h3>
                <div className="space-y-3">
                   <div className="flex justify-between items-center p-2 bg-sky-500/5 rounded">
                     <span className="text-xs text-slate-300">Servizio Notturno ({config.nightStart}-{config.nightEnd})</span>
                     <input type="checkbox" checked={config.nightShiftEnabled} onChange={e => setConfig({...config, nightShiftEnabled: e.target.checked})} className="accent-sky-500" />
                   </div>
                   <div className="flex justify-between items-center p-2 bg-orange-500/5 rounded">
                     <span className="text-xs text-slate-300">Servizio Diurno ({config.dayStart}-{config.dayEnd})</span>
                     <input type="checkbox" checked={config.dayShiftEnabled} onChange={e => setConfig({...config, dayShiftEnabled: e.target.checked})} className="accent-orange-500" />
                   </div>
                   <div className="flex justify-between items-center pt-2 px-1">
                     <span className="text-xs text-slate-300 font-bold">Giri richiesti: {config.roundsPerShift}</span>
                     <input type="range" min="1" max="10" value={config.roundsPerShift} onChange={e => setConfig({...config, roundsPerShift: parseInt(e.target.value)})} className="w-32 accent-sky-500" />
                   </div>
                </div>
              </div>

              {/* WEEKEND OVERRIDE */}
              <div className="pt-4 border-t border-sky-500/10">
                <h3 className="text-[10px] font-bold text-emerald-400 uppercase mb-3 tracking-widest flex items-center">
                  <i className="fas fa-adjust mr-2"></i> Variazioni Weekend
                </h3>
                
                <div className="space-y-3">
                  {/* SABATO */}
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-emerald-300 uppercase">Sabato</span>
                      <div className="flex gap-2">
                        <button onClick={() => updateWeekend('saturday', 'nightEnabled', !config.saturdayConfig.nightEnabled)} className={`text-[9px] px-2 py-0.5 rounded border ${config.saturdayConfig.nightEnabled ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-700 text-slate-500'}`}>N</button>
                        <button onClick={() => updateWeekend('saturday', 'dayEnabled', !config.saturdayConfig.dayEnabled)} className={`text-[9px] px-2 py-0.5 rounded border ${config.saturdayConfig.dayEnabled ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-slate-700 text-slate-500'}`}>G</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Giri: {config.saturdayConfig.rounds}</span>
                      <input type="range" min="0" max="12" value={config.saturdayConfig.rounds} onChange={e => updateWeekend('saturday', 'rounds', parseInt(e.target.value))} className="w-24 accent-emerald-500" />
                    </div>
                  </div>

                  {/* DOMENICA */}
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-emerald-300 uppercase">Domenica</span>
                      <div className="flex gap-2">
                        <button onClick={() => updateWeekend('sunday', 'nightEnabled', !config.sundayConfig.nightEnabled)} className={`text-[9px] px-2 py-0.5 rounded border ${config.sundayConfig.nightEnabled ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-700 text-slate-500'}`}>N</button>
                        <button onClick={() => updateWeekend('sunday', 'dayEnabled', !config.sundayConfig.dayEnabled)} className={`text-[9px] px-2 py-0.5 rounded border ${config.sundayConfig.dayEnabled ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-slate-700 text-slate-500'}`}>G</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Giri: {config.sundayConfig.rounds}</span>
                      <input type="range" min="0" max="12" value={config.sundayConfig.rounds} onChange={e => updateWeekend('sunday', 'rounds', parseInt(e.target.value))} className="w-24 accent-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* DASHBOARD STATS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-4 rounded-xl border-l-4 border-sky-500">
              <span className="block text-[10px] text-sky-500 font-bold uppercase mb-1">Passaggi Eseguiti</span>
              <span className="text-2xl font-orbitron text-white">{logs.filter(l => !l.isGenerated).length}</span>
            </div>
            <div className="glass p-4 rounded-xl border-l-4 border-emerald-500">
              <span className="block text-[10px] text-emerald-500 font-bold uppercase mb-1">Passaggi Integrati</span>
              <span className="text-2xl font-orbitron text-white">{logs.filter(l => l.isGenerated).length}</span>
            </div>
            <div className="glass p-4 rounded-xl border-l-4 border-indigo-500">
              <span className="block text-[10px] text-indigo-500 font-bold uppercase mb-1">Stato Sistema</span>
              <span className="text-xs text-slate-400 italic truncate">{aiSummary || "Nessun dato caricato"}</span>
            </div>
          </div>

          <Card title="Database Ispezioni" icon="fas fa-database" className="flex-1 flex flex-col min-h-[600px]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Vista Operativa</span>
              <button onClick={exportToExcel} disabled={logs.length === 0} className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1 px-4 rounded transition-all disabled:opacity-30">
                <i className="fas fa-download mr-2"></i> Download Excel
              </button>
            </div>
            <div className="flex-1 overflow-auto border border-sky-500/10 rounded-xl bg-black/30">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-sky-500/20 z-10">
                  <tr className="text-sky-500/70 font-orbitron uppercase">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Giorno</th>
                    <th className="px-4 py-3">Ora</th>
                    <th className="px-4 py-3">Punto Ispezione</th>
                    <th className="px-4 py-3 text-right">Stato</th>
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
                        <td className={`px-4 py-2 font-bold ${isWeekend ? 'text-emerald-400' : 'text-slate-500'}`}>{dayLabel}</td>
                        <td className="px-4 py-2 font-mono text-sky-300 font-bold">{l.time.substring(0, 5)}</td>
                        <td className="px-4 py-2 text-slate-200">{l.tag}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.isGenerated ? 'text-emerald-400 bg-emerald-400/10' : 'text-sky-400 bg-sky-400/10'}`}>
                            {l.isGenerated ? 'INTEGRATO' : 'REALE'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="py-32 text-center opacity-20 uppercase tracking-[0.3em] text-xs">Caricare un file per iniziare</td></tr>
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
