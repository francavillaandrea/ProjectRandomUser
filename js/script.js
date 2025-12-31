"use strict";

$(function () {
    // ============================================
    // COSTANTI - Valori fissi che non cambiano
    // ============================================
    const FAV_KEY = "ru-favorites";
    const SLIDER_KEY = "ru-slider-position";
    const GENDER_KEY = "ru-gender-filter";
    const NAT_KEY = "ru-nat-filters";

    // Elenco delle nazioni disponibili
    const NATIONALITIES = {
        'AU': 'Australia', 'BR': 'Brasile', 'CA': 'Canada', 'CH': 'Svizzera',
        'DE': 'Germania', 'DK': 'Danimarca', 'ES': 'Spagna', 'FI': 'Finlandia',
        'FR': 'Francia', 'GB': 'Regno Unito', 'IE': 'Irlanda', 'IN': 'India',
        'IR': 'Iran', 'MX': 'Messico', 'NL': 'Paesi Bassi', 'NO': 'Norvegia',
        'NZ': 'Nuova Zelanda', 'RS': 'Serbia', 'TR': 'Turchia', 'UA': 'Ucraina',
        'US': 'Stati Uniti'
    };

    const GENDERS = { 'male': 'Uomo', 'female': 'Donna' };
    const ITEMS_PER_PAGE = 8; // Quanti utenti mostrare per pagina

    // ============================================
    // VARIABILI GLOBALI - Lo stato dell'app
    // ============================================
    // COME FUNZIONA:
    // - "users" contiene TUTTI gli utenti scaricati dall'API (mai modificato se non al caricamento)
    // - "filtered" contiene gli utenti DOPO ricerca e filtri (cambia continuamente)
    // - "page" traccia quale pagina stai visualizzando (per la paginazione)
    // - "totalPages" è il numero totale di pagine disponibili
    // - "favorites" sono gli utenti salvati nel browser (localStorage)
    // - "hero" è l'utente speciale mostrato in alto (cambia con il refresh)
    //
    // FLUSSO DATI:
    // 1. Utenti scaricati dall'API -> users
    // 2. Applica ricerca -> filtered
    // 3. Applica ordinamento -> filtered
    // 4. Calcola paginazione -> totalPages e page
    // 5. Mostra gli utenti della pagina corrente -> renderPage()

    const state = {
        users: [],           // Tutti gli utenti caricati
        filtered: [],        // Utenti dopo ricerca/filtri
        page: 1,            // Pagina corrente
        totalPages: 1,      // Totale pagine
        favorites: JSON.parse(localStorage.getItem(FAV_KEY) || "[]"), // Preferiti salvati
        hero: null,         // Utente in evidenza in alto
    };

    // ============================================
    // FUNZIONI DI UTILITÀ
    // ============================================

    // Ritarda l'esecuzione di una funzione (es: non cercare ad ogni lettera digitata)
    function debounce(func, delay) {
        let timeout;
        // Ritorna una funzione che cattura gli argomenti (...args) e li passerà a func dopo il delay
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Mostra un messaggio popup temporaneo
    function showToast(message, isError = false) {
        const color = isError ? 'bg-danger' : 'bg-primary';
        const $toast = $('<div>', {
            class: `toast align-items-center text-white ${color} border-0`,
            role: 'alert'
        }).append(
            $('<div>').addClass('d-flex').append(
                $('<div>').addClass('toast-body').text(message),
                $('<button>').attr({
                    type: 'button',
                    class: 'btn-close btn-close-white me-2 m-auto',
                    'data-bs-dismiss': 'toast'
                })
            )
        );

        $('#toastPlacement').append($toast);
        const toast = new bootstrap.Toast($toast[0], { delay: 3000 });
        toast.show();
        $toast.on('hidden.bs.toast', function () {
            $(this).remove();
        });
    }

    // Salva i dati dell'utente come file JSON
    function saveUserAsJson(user) {
        if (!user) return;

        // Crea il testo JSON formattato
        const jsonText = JSON.stringify(user, null, 2);

        // Crea un link di download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonText);
        const downloadLink = document.createElement('a');
        downloadLink.setAttribute("href", dataStr);
        downloadLink.setAttribute("download", `${user.name.first}_${user.name.last}.json`);
        downloadLink.click();

        showToast(`Dati di ${user.name.first} salvati.`);
    }

    // Mostra il JSON in una finestra popup
    function showJsonViewer(user) {
        if (!user) return;
        const jsonText = JSON.stringify(user, null, 2);
        $('#json-viewer-content').text(jsonText);
        new bootstrap.Modal('#jsonViewerModal').show();
    }

    // ============================================
    // CARICAMENTO DATI DALL'API
    // ============================================

    // Scarica gli utenti dall'API
    function fetchUsers(params) {
        return ajax.sendRequest('GET', '/api/', params)
            .then(response => response.data.results)
            .catch(err => {
                ajax.errore(err);
                return [];
            });
    }

    // Carica una lista di utenti
    function loadUsers(filters) {
        // Disabilita il pulsante e mostra lo spinner
        $('#btn-load').prop('disabled', true)
            .html('<span class="spinner-border spinner-border-sm"></span>');

        // Leggi i filtri attuali dai controlli HTML
        const currentFilters = filters || {
            results: Number($("#slider-results").val()),
            gender: $("input[name=gender]:checked").val(),
            nat: $(".nat:checked").map((_, el) => el.value).get()
        };

        // Se ci sono filtri passati, aggiorna i controlli
        if (filters) {
            $("#slider-results").val(currentFilters.results);
            $("#slider-value").text(currentFilters.results);
            $(`input[name=gender][value=${currentFilters.gender}]`).prop('checked', true);
            $(".nat").prop('checked', false);
            // Usa jQuery .each() per iterare sulle nazionalità
            $.each(currentFilters.nat, (_, n) => $(`#nat-${n.toLowerCase()}`).prop('checked', true));
        }

        // Prepara i parametri per l'API
        const params = {
            results: currentFilters.results,
            inc: 'gender,name,location,email,login,dob,phone,cell,picture,nat,registered'
        };

        // Aggiungi parametri opzionali solo se necessari
        if (currentFilters.gender !== 'all') params.gender = currentFilters.gender;
        if (currentFilters.nat.length > 0) params.nat = currentFilters.nat.join(',');

        // Scarica i dati e aggiorna la pagina
        fetchUsers(params).then(users => {
            if (!users) return;

            state.users = users;
            state.page = 1;

            applyFiltersAndRender();
            calculateAndRenderStats();
            renderFavorites();

            // Riabilita il pulsante
            $('#btn-load').prop('disabled', false)
                .html('<i class="bi bi-cloud-download"></i> Carica');
        });
    }

    // Carica un singolo utente per la sezione hero (in alto)
    function loadHero(filters) {
        $('#btn-refresh-hero').prop('disabled', true).addClass('rotating');

        const currentFilters = filters || {
            gender: $("input[name=gender]:checked").val(),
            nat: $(".nat:checked").map((_, el) => el.value).get()
        };

        const params = {
            results: 1,
            inc: 'gender,name,location,email,login,dob,phone,cell,picture,nat,registered'
        };

        // Aggiungi parametri opzionali solo se necessari
        if (currentFilters.gender !== 'all') params.gender = currentFilters.gender;
        if (currentFilters.nat.length > 0) params.nat = currentFilters.nat.join(',');

        fetchUsers(params).then(users => {
            $('#btn-refresh-hero').prop('disabled', false).removeClass('rotating');

            const user = users[0]; // Prendi il primo (unico) utente
            if (!user) return;

            state.hero = user;

            // Aggiorna i dati visualizzati
            $("#hero-avatar img").attr("src", user.picture.large);
            $("#hero-name").text(`${user.name.first} ${user.name.last}`);
            $("#hero-email").html(`<i class="bi bi-envelope"></i> ${user.email}`);
            $("#hero-username").html(`<i class="bi bi-person-badge"></i> @${user.login.username}`);

            const genderIcon = user.gender === 'male' ? 'bi-gender-male' : 'bi-gender-female';
            $("#hero-gender").html(`<i class="bi ${genderIcon}"></i> ${GENDERS[user.gender]}`);
            $("#hero-nat").html(`<i class="bi bi-globe"></i> ${NATIONALITIES[user.nat]}`);
            $("#hero-age").html(`<i class="bi bi-calendar-event"></i> ${user.dob.age} anni`);

            updateHeroFavButton();
        });
    }

    // ============================================
    // FILTRI E RICERCA
    // ============================================

    // Applica tutti i filtri e mostra i risultati
    function applyFiltersAndRender() {
        applySearch();      // Filtra per testo
        applySort();        // Ordina
        paginate();         // Calcola le pagine
        renderPage();       // Mostra gli utenti
        renderActiveFilters(); // Mostra i badge dei filtri attivi
    }

    // Filtra gli utenti in base al testo di ricerca
    function applySearch() {
        const searchText = $("#search").val().toLowerCase().trim();

        if (!searchText) {
            // Se il campo ricerca è vuoto, copia tutti gli utenti in un nuovo array usando lo spread operator
            // Questo evita di modificare accidentalmente l'array originale state.users
            state.filtered = [...state.users];
        } else {
            state.filtered = state.users.filter(u => {
                const fullText = `${u.name.first} ${u.name.last} ${u.email}`.toLowerCase();
                return fullText.includes(searchText);
            });
        }
    }

    // Ordina gli utenti filtrati
    function applySort() {
        const sortValue = $("#sort").val();
        if (sortValue === "none") return;

        state.filtered.sort((a, b) => {
            if (!a || !b || !a.name || !b.name) return 0;

            const nameA = `${a.name.first} ${a.name.last}`;
            const nameB = `${b.name.first} ${b.name.last}`;

            if (sortValue === "name-asc") {
                return nameA.localeCompare(nameB);
            }
            if (sortValue === "name-desc") {
                return nameB.localeCompare(nameA);
            }
            if (sortValue === "nat-asc") {
                return a.nat.localeCompare(b.nat);
            }
            return 0;
        });
    }

    // Calcola quante pagine servono
    function paginate() {
        state.totalPages = Math.max(1, Math.ceil(state.filtered.length / ITEMS_PER_PAGE));
        state.page = Math.min(state.page, state.totalPages); // Non superare l'ultima pagina
    }

    // ============================================
    // GESTIONE PREFERITI
    // ============================================

    // Controlla se un utente è tra i preferiti
    function isFav(uuid) {
        return state.favorites.some(fav => fav && fav.login && fav.login.uuid === uuid);
    }

    // Salva i preferiti nel browser
    function saveFavs() {
        localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
        renderFavorites();
    }

    // Aggiungi o rimuovi dai preferiti
    function toggleFavorite(user) {
        if (!user || !user.login) return;

        // Cerca se l'utente è già nei preferiti
        const index = state.favorites.findIndex(fav =>
            fav && fav.login && fav.login.uuid === user.login.uuid
        );

        if (index >= 0) {
            // Rimuovi
            state.favorites.splice(index, 1);
            showToast(`${user.name.first} rimosso dai preferiti!`);
        } else {
            // Aggiungi
            state.favorites.push(user);
            showToast(`${user.name.first} aggiunto ai preferiti!`);
        }

        saveFavs();
    }

    // Aggiorna il pulsante preferito dell'hero
    function updateHeroFavButton() {
        if (!state.hero) return;

        const isFavorite = isFav(state.hero.login.uuid);

        if (isFavorite) {
            $("#btn-hero-fav")
                .html('<i class="bi bi-heart-fill"></i> Rimuovi')
                .removeClass("btn-primary")
                .addClass("btn-outline-danger");
        } else {
            $("#btn-hero-fav")
                .html('<i class="bi bi-heart"></i> Aggiungi')
                .removeClass("btn-outline-danger")
                .addClass("btn-primary");
        }

        // Aggiungi cuoricino al nome se è preferito
        $("#hero-name .bi-heart-fill").remove();
        if (isFavorite) {
            $("#hero-name").append(' <i class="bi bi-heart-fill text-danger"></i>');
        }
    }

    // ============================================
    // VISUALIZZAZIONE PAGINA
    // ============================================

    // Crea le checkbox delle nazionalità
    function renderNationalities() {
        const container = $("#nat-container");

        // Usa jQuery .each() invece di Object.entries() per iterare l'oggetto NATIONALITIES
        $.each(NATIONALITIES, (code, name) => {
            const html = `
                <div class="form-check form-check-inline">
                    <input class="form-check-input nat" type="checkbox" 
                           value="${code}" id="nat-${code.toLowerCase()}">
                    <label class="form-check-label" for="nat-${code.toLowerCase()}">
                        <img src="https://flagcdn.com/w20/${code.toLowerCase()}.png" 
                             alt="${name}" class="me-1" width="20">${name}
                    </label>
                </div>`;
            container.append(html);
        });
    }

    // Mostra i badge dei filtri attivi
    function renderActiveFilters() {
        const container = $('#active-filters-container').empty();
        const gender = $("input[name=gender]:checked").val();
        const nats = $(".nat:checked").map((_, el) => el.value).get();

        // Badge per il genere
        if (gender !== 'all') {
            const badge = `
                <span class="badge bg-secondary d-inline-flex align-items-center">
                    Genere: ${GENDERS[gender]} 
                    <button class="btn-close btn-close-white ms-2" data-filter-type="gender"></button>
                </span>`;
            container.append(badge);
        }

        // Badge per ogni nazione
        $.each(nats, (_, nat) => {
            const badge = `
                <span class="badge bg-secondary d-inline-flex align-items-center">
                    Nazione: ${NATIONALITIES[nat]} 
                    <button class="btn-close btn-close-white ms-2" 
                            data-filter-type="nat" data-filter-value="${nat}"></button>
                </span>`;
            container.append(badge);
        });
    }

    // Mostra gli utenti della pagina corrente
    function renderPage() {
        const container = $("#cards-container").empty();

        // Calcola quali utenti mostrare
        const start = (state.page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageUsers = state.filtered.slice(start, end);

        // Mostra/nascondi messaggi
        $("#no-results").toggle(pageUsers.length === 0);
        $("#pager").toggle(pageUsers.length > 0 && state.totalPages > 1);

        if (pageUsers.length === 0) return;

        // Crea una card per ogni utente
        $.each(pageUsers, (index, user) => {
            if (!user || !user.login) return;

            const isFavorite = isFav(user.login.uuid);
            const favClass = isFavorite ? 'btn-danger' : 'btn-outline-danger';
            const favIcon = isFavorite ? 'bi-heart-fill' : 'bi-heart';

            const card = $('<article>')
                .addClass('user-card fade-in')
                .attr('data-id', user.login.uuid)
                .css('animation-delay', `${index * 50}ms`)
                .html(`
                    <div class="uimg">
                        <img src="${user.picture.medium}" alt="Avatar">
                    </div>
                    <div class="udata">
                        <div class="name">${user.name.first} ${user.name.last}</div>
                        <div class="small">${user.email}</div>
                        <div class="actions mt-2">
                            <button class="btn btn-sm btn-outline-secondary btn-details" 
                                    title="Mostra dettagli">
                                <i class="bi bi-info-circle"></i>
                            </button>
                            <button class="btn btn-sm btn-fav ${favClass}" 
                                    title="${isFavorite ? 'Rimuovi' : 'Aggiungi'}">
                                <i class="bi ${favIcon}"></i>
                            </button>
                        </div>
                    </div>
                `);

            container.append(card);
        });

        updatePager();
    }

    // Mostra la lista dei preferiti nella sidebar
    function renderFavorites() {
        const list = $("#favorites-list").empty();

        if (state.favorites.length === 0) {
            list.html('<div class="text-muted small p-2">Nessun preferito.</div>');
            return;
        }

        $.each(state.favorites, (_, user) => {
            if (!user || !user.login) return;

            const item = `
                <div class="fav-item mb-2">
                    <img src="${user.picture.thumbnail}" alt="Avatar">
                    <div class="small flex-grow-1">${user.name.first} ${user.name.last}</div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary btn-details" 
                                data-id="${user.login.uuid}" title="Dettagli">
                            <i class="bi bi-info-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-remove-fav" 
                                data-id="${user.login.uuid}" title="Rimuovi">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>`;

            list.append(item);
        });
    }

    // Calcola e mostra le statistiche
    function calculateAndRenderStats() {
        const container = $('#stats-container');

        if (state.users.length === 0) {
            container.html('<div class="text-muted small p-2">Nessun dato da analizzare.</div>');
            return;
        }

        const total = state.users.length;
        const males = state.users.filter(u => u.gender === 'male').length;
        const females = total - males;

        // Calcola età media con jQuery .each()
        let totalAge = 0;
        $.each(state.users, (_, u) => totalAge += u.dob.age);
        const avgAge = (totalAge / total).toFixed(1);

        // Trova la nazione più comune con jQuery .each()
        const natCounts = {};
        $.each(state.users, (_, u) => {
            natCounts[u.nat] = (natCounts[u.nat] || 0) + 1;
        });

        let topNat = '';
        let maxCount = 0;
        for (const nat in natCounts) {
            if (natCounts[nat] > maxCount) {
                maxCount = natCounts[nat];
                topNat = nat;
            }
        }

        const html = `
            <ul class="list-unstyled small">
                <li><i class="bi bi-gender-male"></i> Uomo: <b>${Math.round(males / total * 100)}%</b></li>
                <li><i class="bi bi-gender-female"></i> Donna: <b>${Math.round(females / total * 100)}%</b></li>
                <li><i class="bi bi-cake2"></i> Età media: <b>${avgAge}</b></li>
                <li><i class="bi bi-globe"></i> Top Nazionalità: <b>${NATIONALITIES[topNat]}</b> (${maxCount})</li>
            </ul>`;

        container.html(html);
    }

    // Aggiorna i controlli di paginazione
    function updatePager() {
        const start = (state.page - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(start + ITEMS_PER_PAGE - 1, state.filtered.length);

        const text = end > 0 ?
            `Visualizzati ${start}-${end} di ${state.filtered.length}` :
            'Nessun risultato';

        $("#page-info").text(`Pag. ${state.page}/${state.totalPages} (${text})`);

        // Disabilita pulsanti se necessario
        $("#btn-first, #btn-prev").prop("disabled", state.page === 1);
        $("#btn-last, #btn-next").prop("disabled", state.page === state.totalPages);
    }

    // Mostra tutti i dettagli di un utente in una finestra popup
    function showUserDetails(user) {
        if (!user) return;

        const modal = $('#detailsModal');

        // Header
        modal.find("#modal-avatar").attr("src", user.picture.large);
        modal.find("#modal-name").text(`${user.name.first} ${user.name.last}`);
        modal.find("#modal-email").text(user.email);

        const genderIcon = user.gender === 'male' ? 'bi-gender-male' : 'bi-gender-female';
        modal.find("#modal-natgender").html(`
            <p class="mb-0 d-flex align-items-center gap-2">
                <i class="bi ${genderIcon}"></i> ${GENDERS[user.gender]}
            </p>
            <p class="mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-globe"></i> ${NATIONALITIES[user.nat]}
            </p>
        `);

        // Dettagli organizzati in sezioni
        const details = {
            "Anagrafica": {
                "Nome Completo": `${user.name.title} ${user.name.first} ${user.name.last}`,
                "Nazionalità": NATIONALITIES[user.nat],
                "Genere": GENDERS[user.gender],
                "Data di nascita": `${new Date(user.dob.date).toLocaleDateString('it-IT')} (${user.dob.age} anni)`,
                "Registrato da": `${user.registered.age} anni`,
            },
            "Contatti": {
                "Email": user.email,
                "Telefono": user.phone,
                "Cellulare": user.cell,
                "Indirizzo": `${user.location.street.number} ${user.location.street.name}, ${user.location.city}, ${user.location.state}, ${user.location.country} - ${user.location.postcode}`,
            },
            "Posizione": {
                "Latitudine": user.location.coordinates.latitude,
                "Longitudine": user.location.coordinates.longitude,
                "Timezone": `${user.location.timezone.offset} ${user.location.timezone.description}`,
            },
            "Account": {
                "Username": user.login.username,
                "Password": `${user.login.password} (Demo)`,
                "UUID": user.login.uuid,
            }
        };

        const body = modal.find("#modal-body-details").empty();

        // Crea le sezioni
        for (const sectionName in details) {
            body.append(`<h5>${sectionName}</h5>`);
            const sectionDiv = $('<div>').addClass('row mb-3');

            const sectionData = details[sectionName];
            for (const key in sectionData) {
                const value = sectionData[key];
                sectionDiv.append(`
                    <div class="col-md-6 mb-2">
                        <p class="mb-0"><strong>${key}:</strong></p>
                        <p class="text-muted">${value}</p>
                    </div>
                `);
            }

            body.append(sectionDiv);
        }

        // Aggiungi pulsanti extra
        modal.find('.btn-extra').remove();

        const jsonBtn = $('<button>')
            .addClass('btn btn-sm btn-outline-info btn-extra me-2')
            .html('<i class="bi bi-file-code"></i> Vedi JSON')
            .on('click', () => showJsonViewer(user));

        const saveBtn = $('<button>')
            .addClass('btn btn-sm btn-primary btn-extra')
            .html('<i class="bi bi-download"></i> Salva JSON')
            .on('click', () => saveUserAsJson(user));

        modal.find('button[data-bs-dismiss="modal"]').before(jsonBtn).before(saveBtn);

        new bootstrap.Modal(modal[0]).show();
    }

    // ============================================
    // GESTIONE EVENTI (Click, Input, ecc.)
    // ============================================

    function initEventHandlers() {
        // Funzione con ritardo per ricaricare gli utenti
        const debouncedLoad = debounce(() => {
            loadUsers({
                results: Number($("#slider-results").val()),
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            });
        }, 400);

        // Quando cambia lo slider del numero di risultati
        $(document).on("input", "#slider-results", function () {
            const value = $(this).val();
            $("#slider-value").text(value);
            localStorage.setItem(SLIDER_KEY, value);
            debouncedLoad();
        });

        // Quando cambia il genere
        $(document).on('change', 'input[name=gender]', function () {
            localStorage.setItem(GENDER_KEY, $(this).val());
            debouncedLoad();
        });

        // Quando cambia una nazionalità
        $(document).on('change', '.nat', () => {
            const nats = $(".nat:checked").map((_, el) => el.value).get();
            localStorage.setItem(NAT_KEY, JSON.stringify(nats));
            loadUsers({
                results: Number($("#slider-results").val()),
                gender: $("input[name=gender]:checked").val(),
                nat: nats
            });
        });

        // Click su "Carica utenti"
        $(document).on("click", "#btn-load", () => loadUsers());

        // Click su "Refresh hero"
        $(document).on("click", "#btn-refresh-hero", () => {
            loadHero({
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            });
        });

        // Click su cuore hero
        $(document).on("click", "#btn-hero-fav", () => {
            if (state.hero) {
                toggleFavorite(state.hero);
                updateHeroFavButton();
            }
        });

        // Click su dettagli hero
        $(document).on("click", "#btn-hero-details", () => showUserDetails(state.hero));

        // Ricerca con ritardo
        const debouncedSearch = debounce(() => applyFiltersAndRender(), 350);
        $(document).on('input', '#search', debouncedSearch);

        // Cambio ordinamento
        $(document).on("change", "#sort", () => applyFiltersAndRender());

        // Click sui pulsanti di paginazione
        $(document).on("click", "#pager button", function () {
            const buttonId = this.id;

            if (buttonId === 'btn-first') state.page = 1;
            if (buttonId === 'btn-last') state.page = state.totalPages;
            if (buttonId === 'btn-prev' && state.page > 1) state.page--;
            if (buttonId === 'btn-next' && state.page < state.totalPages) state.page++;

            renderPage();
        });

        // Click sul cuore di una card
        $(document).on("click", "#cards-container .btn-fav", function (e) {
            e.stopPropagation();

            const uuid = $(this).closest(".user-card").data("id");
            const user = state.users.find(u => u.login.uuid === uuid);

            if (user) {
                toggleFavorite(user);

                // Aggiorna il pulsante
                const isFavorite = isFav(uuid);
                $(this)
                    .toggleClass('btn-danger', isFavorite)
                    .toggleClass('btn-outline-danger', !isFavorite)
                    .html(isFavorite ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>');
            }
        });

        // Click su una card utente (mostra dettagli)
        $(document).on("click", "#cards-container .user-card", function (e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            const user = state.users.find(u => u.login.uuid === uuid);
            showUserDetails(user);
        });

        // Click su rimuovi dalla lista preferiti
        $(document).on("click", "#favorites-list .btn-remove-fav", function (e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            const user = state.favorites.find(fav => fav.login.uuid === uuid);

            if (user) {
                toggleFavorite(user);
                renderPage();
                updateHeroFavButton();
            }
        });

        // Click su dettagli dalla lista preferiti
        $(document).on("click", "#favorites-list .btn-details", function (e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            const user = state.favorites.find(fav => fav.login.uuid === uuid);
            if (user) showUserDetails(user);
        });

        // Click su "Svuota preferiti"
        $(document).on("click", "#clear-fav", () => {
            if (confirm("Sei sicuro di voler svuotare ipreferiti?")) {
                state.favorites = [];
                saveFavs();
                renderPage();
                updateHeroFavButton();
            }
        });// Click su "Pulisci filtri"
        $(document).on("click", "#btn-clear-filters", () => {
            localStorage.removeItem(SLIDER_KEY);
            localStorage.removeItem(GENDER_KEY);
            localStorage.removeItem(NAT_KEY);

            $(".nat").prop("checked", false);
            $("input[name=gender][value=all]").prop("checked", true);
            $("#search").val("");
            $("#sort").val("none");
            $("#slider-results").val(10);
            $("#slider-value").text(10);

            loadUsers();
        });

        // Click su X di un singolo filtro attivo
        $(document).on('click', '#active-filters-container button', function () {
            const type = $(this).data('filter-type');

            if (type === 'gender') {
                $('input[name=gender][value=all]').prop('checked', true).trigger('change');
            } else if (type === 'nat') {
                const value = $(this).data('filter-value');
                $(`.nat[value=${value}]`).prop('checked', false).trigger('change');
            }
        });

        // Pulsante "Torna su"
        const backToTopButton = $('#btn-back-to-top');

        $(window).on('scroll', () => {
            if ($(window).scrollTop() > 300) {
                backToTopButton.fadeIn();
            } else {
                backToTopButton.fadeOut();
            }
        });

        backToTopButton.on('click', (e) => {
            e.preventDefault();
            $('html, body').animate({ scrollTop: 0 }, '300');
        });
    }

    // ============================================
    // INIZIALIZZAZIONE - Avvio dell'app
    // ============================================

    function init() {
        // Ripristina lo slider dal browser
        const savedSlider = localStorage.getItem(SLIDER_KEY);
        if (savedSlider) {
            $("#slider-results").val(savedSlider);
            $("#slider-value").text(savedSlider);
        }

        // Ripristina il genere dal browser
        const savedGender = localStorage.getItem(GENDER_KEY);
        if (savedGender) {
            $(`input[name=gender][value=${savedGender}]`).prop('checked', true);
        }

        // Ripristina le nazionalità dal browser
        const savedNats = JSON.parse(localStorage.getItem(NAT_KEY) || "[]");
        $.each(savedNats, (_, nat) => $(`#nat-${nat.toLowerCase()}`).prop('checked', true));

        // Pulizia vecchi dati (migrazione)
        if (state.favorites.length > 0 && typeof state.favorites[0] === 'string') {
            state.favorites = [];
            localStorage.setItem(FAV_KEY, JSON.stringify([]));
        }

        // Avvia l'applicazione
        renderNationalities();
        initEventHandlers();
        renderFavorites();
        loadHero();
        loadUsers();
    }
    init();
});