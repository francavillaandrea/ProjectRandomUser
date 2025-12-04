# Random User Generator

Un'applicazione web interattiva e **completamente responsive** che consente di generare e visualizzare utenti casuali da tutto il mondo, con filtri avanzati e navigazione paginata.

---

### Come Usare l'App

1. **Regola il numero di risultati** usando lo slider (predefinito: 20)
2. **Seleziona il genere** con i radio button (Tutti è preselezionato)
3. **Scegli le nazionalità** con i checkbox (Italia è preselezionata)
4. **Clicca "Carica Utenti"** per recuperare i dati
5. **Naviga i risultati** con i pulsanti di pagina

### Parametri API

L'applicazione utilizza l'API pubblica di **randomuser.me**:
```
GET https://randomuser.me/api/?results=N&gender=GENDER&nat=NATIONALITY_CODE
```

- **results**: Numero di risultati (massimo consigliato: 100)
- **gender**: `male`, `female`, o omettere per "all"
- **nat**: Codici nazionalità ISO 2 (comma-separated per più paesi)

---

## 💻 Tecnologie Utilizzate


## 🔧 Dettagli Implementazione

### State Management (`appState`)
```javascript
{
  allData: [],                 // Tutti i risultati caricati
  currentPage: 1,              // Pagina corrente
  itemsPerPage: 20,            // Risultati per pagina
  selectedGender: "all",       // Filtro genere
  selectedNationalities: [],   // Filtri nazionalità selezionati
  totalResults: 0,             // Total results count
  totalPages: 0,               // Calculated total pages
  isLoading: false             // Loading state
}
```

### Flusso Principale
1. **Caricamento**: `loadUsers()` → API call con parametri filtrati
2. **Salvataggio**: Dati salvati in `appState.allData`
3. **Rendering**: `renderPage()` → Slice e display della pagina corrente
4. **Navigazione**: Pulsanti aggiornano `currentPage` e richiamano `renderPage()`

### Sanitizzazione Dati
La funzione `escapeHtml()` previene XSS:
- Escapa `&`, `<`, `>`, `"`, `'`
- Applicata a tutti i dati dinamici

---

## 📱 Responsive Design Breakpoints

### Mobile (< 480px)
- Font size ridotti
- Grid checkbox: 1 colonna
- Slider vertical (column layout)
- Padding/Margin ottimizzati
- Tabella font: 0.75rem

### Tablet (480px - 768px)
- Font intermedi
- Grid checkbox: 2 colonne
- Layout compattato

### Desktop (> 768px)
- Layout pieno
- Grid checkbox: 3 colonne
- Font size standard
- Hover effects completi

---

## 🐛 Troubleshooting

### "Nessun risultato trovato"
- Verifica i filtri selezionati
- Riduci il numero di risultati richiesti
- Prova con "Tutti" come genere

### Errore di connessione
- Verifica la connessione internet
- L'API potrebbe essere temporaneamente indisponibile
- Prova in incognito (evita cache)

### Tabella non visible su mobile
- Lo slider potrebbe essere non responsive se il browser è vecchio
- Aggiorna il browser o usa Chrome, Firefox, Safari recenti

---

## 🌐 Deploy su AlterVista

### Prerequisiti
- Account AlterVista gratuito (www.altervista.org)

### Passaggi

1. **Registrati su AlterVista**
   - Crea un account gratuito
   - Configura il nome utente (diventerà tuo_nome.altervista.org)

2. **Accedi al File Manager**
   - Login su altervista.org
   - Vai su "File Manager"

3. **Carica i file**
   - Crea una cartella `randomuser` (facoltativo)
   - Carica tutti i file:
     - `index.html`
     - `index.css`
     - `index.js`
     - `libreria.js`
     - `axios@1.13.min.js`

4. **Accedi all'app**
   - URL: `http://tuonome.altervista.org/index.html`
   - O crea un file `index.php` con redirect

### Note su AlterVista
- CORS potrebbe bloccare l'API (prova HTTPS)
- Se l'API è bloccata, usa un proxy CORS:
  ```javascript
  // In index.js, aggiungi prima di sendRequest:
  const corsProxy = "https://cors-anywhere.herokuapp.com/";
  ```

---

## 📊 API Endpoints Disponibili

### RandomUser.me API
```bash
# Base URL
https://randomuser.me/api/

# Esempio con tutti i parametri
https://randomuser.me/api/?results=20&gender=male&nat=IT,DE,FR

# Parametri
- results: 1-100 (default: 1)
- gender: male, female
- nat: 2-letter country codes (IT, DE, GB, ES, FR, BR, etc.)
- seed: per risultati consistenti

# Response
{
  "results": [
    {
      "name": { "title", "first", "last" },
      "email": "...",
      "location": { "city", "state", "country" },
      "nat": "IT"
    }
  ]
}
```

---

## 🎓 Learning Outcomes

Questo progetto insegna:
- ✅ AJAX e fetch asincrono
- ✅ State management in vanilla JS
- ✅ Responsive design (mobile-first)
- ✅ HTML semantico
- ✅ CSS moderno (Grid, Flexbox)
- ✅ DOM manipulation
- ✅ Event handling
- ✅ Sanitizzazione dati (XSS prevention)
- ✅ UX/UI principles
- ✅ Deploment web

---

## 📝 Esercizio Originale

Realizzato per corso TPSI (Tecnologie e Programmazione dei Sistemi Informatici) presso ISTITUTO TECNICO INDUSTRIALE STATALE "G." - 4° anno

**Requisiti completati:**
- ✅ Slider di selezione numero record
- ✅ Pulsanti di navigazione (avanti, indietro, etc)
- ✅ Radio buttons genere
- ✅ Checkbox nazionalità (6 paesi)
- ✅ README dettagliato
- ✅ Design responsive
- ✅ Deploy indicazioni

---

## 📄 Licenza

Open source per scopo educativo.

---

## 🔗 Risorse

- [RandomUser.me API](https://randomuser.me/documentation)
- [MDN Web Docs](https://developer.mozilla.org/)
- [CSS-Tricks](https://css-tricks.com/)
- [AlterVista Help](https://www.altervista.org/help/)

---

**Creato con ❤️ per imparare JavaScript e Web Development**

*Last Updated: 4 Dicembre 2025*