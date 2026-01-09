
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePatrolFile } from './utils/parser';
import { generateMissingData } from './utils/generator';
import { PatrolLog, SiteConfig, ReportData } from './types';
import { GoogleGenAI } from "@google/genai";

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
    roundsPerShift: 3,
    tagsPerSite: 16,
    nightShiftEnabled: true,
    dayShiftEnabled: false,
    nightStart: "23:00",
    nightEnd: "06:00",
    dayStart: "08:00",
    dayEnd: "17:00",
    tagNames: Array.from({ length: 16 }, (_, i) => `Punto ${i + 1}`)
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
  }, [logs.length > 0 && logs.filter(l => !l.isGenerated).length > 0]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedLogs = parsePatrolFile(content);
      if (parsedLogs.length === 0) {
        alert("Errore: Il formato del file non è riconosciuto. Assicurati che sia un file di pattuglia standard (;).");
      } else {
        setLogs(parsedLogs);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processReport = async () => {
    if (logs.length === 0) {
      alert("Carica prima il file TXT delle ispezioni.");
      return;
    }
    
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    
    try {
      const completeLogs = generateMissingData(logs, config);
      setLogs(completeLogs);
      setAiSummary(`Analisi completata. Generati ${(completeLogs.length - logs.filter(l => !l.isGenerated).length)} nuovi punti di ispezione per completare i ${config.roundsPerShift} giri previsti.`);
    } catch (err) {
      console.error(err);
      setAiSummary("Errore durante l'elaborazione dei dati.");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToExcel = () => {
    // @ts-ignore
    if (!window.XLSX) return;
    // Esportiamo solo Data, Ora, Nome Tag
    const data = logs.map(l => ({ 
      Data: l.date.split('-').reverse().join('/'), 
      Ora: l.time.substring(0, 5), 
      'Punto Ispezione': l.tag 
    }));
    // @ts-ignore
    const ws = window.XLSX.utils.json_to_sheet(data);
    // @ts-ignore
    const wb = window.XLSX.utils.book_new();
    // @ts-ignore
    window.XLSX.utils.book_append_sheet(wb, ws, "Report_Pattuglia");
    // @ts-ignore
    window.XLSX.writeFile(wb, `Report_${config.year}_${config.month + 1}.xlsx`);
  };

  const stats = useMemo(() => {
    const imported = logs.filter(l => !l.isGenerated).length;
    const generated = logs.filter(l => l.isGenerated).length;
    return { imported, generated, total: logs.length };
  }, [logs]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center mr-4 shadow-[0_0_20px_rgba(14,165,233,0.5)]">
            <i className="fas fa-shield-halved text-2xl text-white"></i>
          </div>
          <div>
            <h1 className="text-3xl font-orbitron font-black glow-text tracking-tighter uppercase">
              Patrol<span className="text-sky-400">Guard</span> AI
            </h1>
            <p className="text-sky-500/60 uppercase text-[10px] tracking-[0.4em] font-bold mt-1">Quantum Reporting Interface</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="neon-btn text-white px-6 py-3 rounded-full cursor-pointer flex items-center font-bold uppercase text-xs tracking-widest">
            <i className="fas fa-upload mr-2"></i> 1. Importa TXT
            <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={processReport}
            disabled={isProcessing || logs.length === 0}
            className={`px-6 py-3 rounded-full flex items-center font-bold uppercase text-xs tracking-widest transition-all duration-300 ${isProcessing || logs.length === 0 ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' : 'bg-transparent border border-sky-400 text-sky-400 hover:bg-sky-400/10'}`}
          >
            <i className={`fas ${isProcessing ? 'fa-spinner fa-spin' : 'fa-bolt'} mr-2`}></i> 2. Elabora Report
          </button>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card title="Configurazione" icon="fas fa-cog">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-sky-400/60 uppercase font-bold block mb-1">Periodo</label>
                  <select value={config.month} onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-sky-500/30 rounded p-2 text-xs text-sky-100">
                    {["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"].map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-sky-400/60 uppercase font-bold block mb-1">Anno</label>
                  <input type="number" value={config.year} onChange={(e) => setConfig({...config, year: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-sky-500/30 rounded p-2 text-xs text-sky-100" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-sky-400/60 uppercase font-bold block mb-2">Giri Minimi: {config.roundsPerShift}</label>
                <input type="range" min="1" max="10" value={config.roundsPerShift} onChange={(e) => setConfig({...config, roundsPerShift: parseInt(e.target.value)})} className="w-full accent-sky-500" />
              </div>

              <div>
                <label className="text-[10px] text-sky-400/60 uppercase font-bold block mb-2">Tag per Giro: {config.tagsPerSite}</label>
                <input type="range" min="1" max="16" value={config.tagsPerSite} onChange={(e) => setConfig({...config, tagsPerSite: parseInt(e.target.value)})} className="w-full accent-sky-500" />
              </div>

              <div className="pt-4 border-t border-sky-500/10 space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-sky-300">Turno Notturno</span>
                    <input type="checkbox" checked={config.nightShiftEnabled} onChange={e => setConfig({...config, nightShiftEnabled: e.target.checked})} className="accent-sky-500" />
                 </div>
                 <div className="flex gap-2">
                    <input type="time" value={config.nightStart} onChange={e => setConfig({...config, nightStart: e.target.value})} className="bg-black/40 border border-sky-500/20 text-[10px] p-2 rounded flex-1" />
                    <input type="time" value={config.nightEnd} onChange={e => setConfig({...config, nightEnd: e.target.value})} className="bg-black/40 border border-sky-500/20 text-[10px] p-2 rounded flex-1" />
                 </div>
                 
                 <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold uppercase text-orange-300">Turno Diurno</span>
                    <input type="checkbox" checked={config.dayShiftEnabled} onChange={e => setConfig({...config, dayShiftEnabled: e.target.checked})} className="accent-orange-500" />
                 </div>
                 <div className="flex gap-2">
                    <input type="time" value={config.dayStart} onChange={e => setConfig({...config, dayStart: e.target.value})} className="bg-black/40 border border-orange-500/20 text-[10px] p-2 rounded flex-1" />
                    <input type="time" value={config.dayEnd} onChange={e => setConfig({...config, dayEnd: e.target.value})} className="bg-black/40 border border-orange-500/20 text-[10px] p-2 rounded flex-1" />
                 </div>
              </div>
            </div>
          </Card>

          <Card title="Log di Sistema" icon="fas fa-info-circle">
            <p className="text-sky-300/80 italic text-xs leading-relaxed">
              {aiSummary || "In attesa del caricamento dei dati di pattuglia..."}
            </p>
          </Card>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-4 rounded-xl border-l-4 border-sky-500">
              <span className="block text-[10px] text-sky-500 font-bold uppercase mb-1">Punti Reali</span>
              <span className="text-2xl font-orbitron text-white">{stats.imported}</span>
            </div>
            <div className="glass p-4 rounded-xl border-l-4 border-emerald-500">
              <span className="block text-[10px] text-emerald-500 font-bold uppercase mb-1">Punti Generati</span>
              <span className="text-2xl font-orbitron text-white">{stats.generated}</span>
            </div>
            <div className="glass p-4 rounded-xl border-l-4 border-indigo-500">
              <span className="block text-[10px] text-indigo-500 font-bold uppercase mb-1">Totale Ispezioni</span>
              <span className="text-2xl font-orbitron text-white">{stats.total}</span>
            </div>
          </div>

          <Card title="Dettaglio Ispezioni" icon="fas fa-list" className="flex-1 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${logs.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                 <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Modulo Operativo Attivo</span>
              </div>
              <button 
                onClick={exportToExcel} 
                disabled={logs.length === 0} 
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1 px-4 rounded uppercase transition-all disabled:opacity-30"
              >
                <i className="fas fa-file-excel mr-2"></i> Esporta Excel
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-sky-500/10 rounded-xl bg-black/30">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-sky-500/20 z-10">
                  <tr className="text-sky-500/70 font-orbitron uppercase">
                    <th className="px-4 py-3">Data Ispezione</th>
                    <th className="px-4 py-3">Ora</th>
                    <th className="px-4 py-3">Punto / Tag</th>
                    <th className="px-4 py-3 text-right">Origine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.length > 0 ? (
                    logs.map((l, i) => (
                      <tr key={i} className="hover:bg-sky-500/5 transition-colors">
                        <td className="px-4 py-2 font-mono text-slate-400">{l.date.split('-').reverse().join('/')}</td>
                        <td className="px-4 py-2 font-mono text-sky-300 font-bold">{l.time.substring(0, 5)}</td>
                        <td className="px-4 py-2 text-slate-200">{l.tag}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.isGenerated ? 'text-emerald-400 bg-emerald-400/10' : 'text-sky-400 bg-sky-400/10'}`}>
                            {l.isGenerated ? 'SISTEMA' : 'PATTUGLIA'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-32 text-center opacity-30">
                        <i className="fas fa-terminal text-4xl mb-4 block"></i>
                        <p className="font-orbitron text-[10px] uppercase tracking-widest">Caricare file TXT per iniziare...</p>
                      </td>
                    </tr>
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
