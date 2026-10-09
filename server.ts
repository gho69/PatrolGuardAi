import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_CLIENTS } from './defaultClients';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const ACTIVE_CLIENT_FILE = path.join(DATA_DIR, 'active_client.json');

// Assicura l'esistenza della cartella dati
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inizializza i file di persistenza se non presenti
if (!fs.existsSync(CLIENTS_FILE)) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(DEFAULT_CLIENTS, null, 2), 'utf-8');
}

app.use(express.json({ limit: '10mb' }));

// API: Restituisce l'elenco dei clienti salvati su disco
app.get('/api/clients', (_req, res) => {
  try {
    if (fs.existsSync(CLIENTS_FILE)) {
      const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const isObsoleteDemoList = parsed.every((c: any) => ['granarolo', 'logistica', 'commerciale'].includes(c.id));
        if (!isObsoleteDemoList) {
          return res.json(parsed);
        }
      }
    }
    // Se non presente o obsoleto, salva e restituisce i profili reali predefiniti
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(DEFAULT_CLIENTS, null, 2), 'utf-8');
    return res.json(DEFAULT_CLIENTS);
  } catch (err) {
    console.error('Errore lettura clients.json:', err);
    return res.json(DEFAULT_CLIENTS);
  }
});

// API: Salva l'elenco dei clienti su disco
app.post('/api/clients', (req, res) => {
  try {
    const clients = req.body;
    if (Array.isArray(clients) && clients.length > 0) {
      fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
      return res.json({ success: true, count: clients.length });
    }
    return res.status(400).json({ error: 'Array clienti non valido' });
  } catch (err) {
    console.error('Errore scrittura clients.json:', err);
    return res.status(500).json({ error: 'Errore salvataggio server' });
  }
});

// API: Gestione ID cliente attivo
app.get('/api/clients/active', (_req, res) => {
  try {
    if (fs.existsSync(ACTIVE_CLIENT_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACTIVE_CLIENT_FILE, 'utf-8'));
      return res.json(data);
    }
  } catch {}
  return res.json({ activeId: DEFAULT_CLIENTS[0].id });
});

app.post('/api/clients/active', (req, res) => {
  try {
    const { activeId } = req.body;
    if (activeId) {
      fs.writeFileSync(ACTIVE_CLIENT_FILE, JSON.stringify({ activeId }), 'utf-8');
      return res.json({ success: true });
    }
  } catch {}
  return res.status(400).json({ error: 'ID non valido' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware in modalità dev
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // File statici in produzione
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PatrolGuard Server] Server in ascolto su http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[PatrolGuard Server] Errore di avvio:', err);
  process.exit(1);
});
