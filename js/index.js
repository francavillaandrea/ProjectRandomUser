"use strict";

// jQuery-based RandomUser UI migliorata
$(function () {
    // --- Stato applicazione ---
    const initialSliderValue = parseInt($("#slider-results").val() || "20", 10);
    const state = {
        allData: [],
        currentPage: 1,
        // elementi per pagina nelle card (fisso, le pagine si adattano)
        itemsPerPage: 8,
        // numero totale di utenti da richiedere all'API (da slider)
        resultsRequested: Number.isNaN(initialSliderValue) ? 20 : initialSliderValue,
        selectedGender: $('input[name="gender"]:checked').val() || "all",
        selectedNationalities: getSelectedNats(),
        totalResults: 0,
        totalPages: 0,
        favorites: loadFavorites()
    };

    // timer per ricaricare automaticamente i dati dopo modifiche ai filtri
    let reloadTimeout = null;

    // sincronizza il valore mostrato accanto allo slider
    $("#slider-value").text(state.resultsRequested);

    // --- Helpers ---
    function getSelectedNats() {
        // Tutti i checkbox con id che inizia per nat-
        return $('input[id^="nat-"]:checked')
            .map(function () {
                return $(this).val();
            })
            .get();
    }

    function saveFavorites() {
        try {
            localStorage.setItem("randomuser_favorites", JSON.stringify(state.favorites));
        } catch (_) {
            // Se localStorage non è disponibile, semplicemente ignora
        }
        renderFavoritesMenu();
    }

    function loadFavorites() {
        try {
            const raw = localStorage.getItem("randomuser_favorites");
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // --- Theme switcher (Bootswatch, con persistenza) ---
    const THEME_KEY = "randomuser_theme_href";

    function applyThemeFromStorage() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved && typeof saved === "string") {
            $("#theme-link").attr("href", saved);
        }
    }

    applyThemeFromStorage();

    // --- Gestione dropdown senza Bootstrap JS ---
    function initDropdowns() {
        // Toggle dropdown al click sul bottone
        $("#themeDropdown, #favoritesDropdown").on("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $button = $(this);
            const $menu = $button.next(".dropdown-menu");
            const isOpen = $menu.hasClass("show");
            
            // Chiudi tutti gli altri dropdown
            $(".dropdown-menu").removeClass("show");
            $(".dropdown-toggle").attr("aria-expanded", "false");
            
            // Toggle questo dropdown
            if (!isOpen) {
                $menu.addClass("show");
                $button.attr("aria-expanded", "true");
            }
        });
        
        // Chiudi dropdown quando si clicca su un item
        $(".dropdown-item").on("click", function () {
            $(this).closest(".dropdown-menu").removeClass("show");
            $(this).closest(".dropdown").find(".dropdown-toggle").attr("aria-expanded", "false");
        });
        
        // Chiudi dropdown quando si clicca fuori
        $(document).on("click", function (e) {
            if (!$(e.target).closest(".dropdown").length) {
                $(".dropdown-menu").removeClass("show");
                $(".dropdown-toggle").attr("aria-expanded", "false");
            }
        });
    }
    
    initDropdowns();

    $(".theme-option").on("click", function (e) {
        e.preventDefault();
        const href = $(this).data("theme");
        if (!href) return;
        $("#theme-link").attr("href", href);
        try {
            localStorage.setItem(THEME_KEY, href);
        } catch (_) {
            // ignora errori di storage
        }
    });

    // --- Favorites menu ---
    function renderFavoritesMenu() {
        const $menu = $("#favorites-menu");
        const wasOpen = $menu.hasClass("show");
        $menu.empty();

        if (!state.favorites || state.favorites.length === 0) {
            $menu.append('<li class="dropdown-item text-muted">Nessun preferito salvato</li>');
            if (wasOpen) $menu.addClass("show");
            return;
        }

        state.favorites.forEach((item) => {
            const safeName = escapeHtml(item.name);
            const $li = $(
                `<li><a class="dropdown-item" href="#" data-uuid="${item.uuid}">${safeName}</a></li>`
            );
            $menu.append($li);
        });

        $menu.append('<li><hr class="dropdown-divider"></li>');
        $menu.append(
            '<li><a class="dropdown-item text-danger" href="#" id="clear-favs">Rimuovi tutti</a></li>'
        );
        
        if (wasOpen) $menu.addClass("show");
    }

    // Click su un preferito nel menu → salta alla pagina giusta e evidenzia card
    $("#favorites-menu").on("click", "a.dropdown-item[data-uuid]", function (e) {
        e.preventDefault();
        const uuid = $(this).data("uuid");
        const idx = state.allData.findIndex((u) => u.login && u.login.uuid === uuid);

        if (idx === -1) {
            alert("Utente non presente nella lista corrente. Ricarica i dati.");
            return;
        }

        const page = Math.floor(idx / state.itemsPerPage) + 1;
        renderPage(page);

        const rowIdx = idx % state.itemsPerPage;
        const $card = $("#cards-container .user-card").eq(rowIdx);
        $card.addClass("highlight");
        setTimeout(() => $card.removeClass("highlight"), 1500);
    });

    // Rimuovi tutti i preferiti
    $("#favorites-menu").on("click", "#clear-favs", function (e) {
        e.preventDefault();
        if (!confirm("Rimuovere tutti i preferiti?")) return;
        state.favorites = [];
        saveFavorites();
    });

    // --- Eventi UI ---
    // Slider numero risultati totali da generare
    $("#slider-results").on("input change", function () {
        const value = parseInt($(this).val(), 10);
        if (!Number.isNaN(value)) {
            state.resultsRequested = value;
            $("#slider-value").text(state.resultsRequested);
            scheduleReload();
        }
    });

    // Cambio genere
    $('input[name="gender"]').on("change", function () {
        state.selectedGender = $(this).val();
        scheduleReload();
    });

    // Cambio nazionalità
    $('input[id^="nat-"]').on("change", function () {
        state.selectedNationalities = getSelectedNats();
        scheduleReload();
    });

    // Bottone caricamento manuale (opzionale, per forzare reload)
    $("#btn-load").on("click", function () {
        loadUsers();
    });

    // Download ZIP con un JSON per ogni persona
    $("#btn-download-all").on("click", function (e) {
        e.preventDefault();
        if (!state.allData || state.allData.length === 0) {
            alert("Nessun utente da scaricare. Genera prima alcuni utenti.");
            return;
        }
        downloadAllAsZip();
    });

    // Navigazione paginata
    $("#btn-first").on("click", function () {
        goToPage(1);
    });
    $("#btn-prev").on("click", function () {
        goToPage(state.currentPage - 1);
    });
    $("#btn-next").on("click", function () {
        goToPage(state.currentPage + 1);
    });
    $("#btn-last").on("click", function () {
        goToPage(state.totalPages);
    });

    // --- Caricamento utenti da API (GET via ajax.sendRequest) ---
    function loadUsers() {
        state.currentPage = 1;
        state.allData = [];
        state.selectedNationalities = getSelectedNats();

        const params = {
            // numero di utenti richiesti dall'utente tramite slider
            results: Math.max(1, state.resultsRequested)
        };

        if (state.selectedGender && state.selectedGender !== "all") {
            params.gender = state.selectedGender;
        }
        if (state.selectedNationalities && state.selectedNationalities.length) {
            params.nat = state.selectedNationalities.join(",");
        }

        setLoading(true);
        hideError();

        // Tutte le GET passano da ajax.sendRequest (libreria.js)
        ajax
            .sendRequest("get", "/api/", params)
            .then(function (resp) {
                if (!resp.data || !Array.isArray(resp.data.results)) {
                    throw new Error("Formato risposta non corretto");
                }
                // garantisco di usare al massimo il numero richiesto
                state.allData = resp.data.results.slice(0, state.resultsRequested);
                state.totalResults = state.allData.length;
                state.totalPages = Math.max(
                    1,
                    Math.ceil(state.totalResults / state.itemsPerPage)
                );

                if (state.totalResults === 0) {
                    showNoResults();
                    setLoading(false);
                    return;
                }

                renderPage(1);
            })
            .catch(function (err) {
                showError("Errore nel caricamento. Riprova più tardi.");
                ajax.errore(err);
            })
            .finally(function () {
                setLoading(false);
            });
    }

    function scheduleReload() {
        if (reloadTimeout) {
            clearTimeout(reloadTimeout);
        }
        reloadTimeout = setTimeout(function () {
            loadUsers();
        }, 400);
    }

    // --- Helpers per bandiere nazionalità ---
    function getFlagUrl(nat) {
        if (!nat) return "";
        // RandomUser usa codici ISO 3166-1 alpha-2 (IT, DE, FR, ecc.)
        // FlagCDN fornisce PNG pronti all'uso
        const code = String(nat).toLowerCase();
        return "https://flagcdn.com/24x18/" + code + ".png";
    }

    function getCountryNameFromNat(nat) {
        if (!nat) return "";
        const upper = String(nat).toUpperCase();
        const map = {
            IT: "Italia",
            DE: "Germania",
            FR: "Francia",
            ES: "Spagna",
            BR: "Brasile",
            GB: "Regno Unito",
            UK: "Regno Unito",
            US: "Stati Uniti",
            CA: "Canada",
            AU: "Australia",
            NL: "Paesi Bassi",
            SE: "Svezia"
        };
        return map[upper] || upper;
    }

    // --- Rendering della pagina corrente ---
    function renderPage(page) {
        if (page < 1) page = 1;
        if (page > state.totalPages) page = state.totalPages;

        state.currentPage = page;

        const start = (page - 1) * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const slice = state.allData.slice(start, end);
        const $container = $("#cards-container").empty();

        if (!slice || slice.length === 0) {
            showNoResults();
            updatePaginationUI();
            return;
        }

        slice.forEach(function (u) {
            const name = escapeHtml(
                (u.name && (u.name.title + " " + u.name.first + " " + u.name.last)) || ""
            );
            const email = escapeHtml(u.email || "");
            const city = escapeHtml((u.location && u.location.city) || "");
            const country = escapeHtml((u.location && u.location.country) || "");
            const rawNat = u.nat || "";
            const nat = escapeHtml(rawNat);
            const age = u.dob && typeof u.dob.age === "number" ? u.dob.age : null;
            const avatar = u.picture && u.picture.large ? u.picture.large : "";
            const uuid = u.login && u.login.uuid ? u.login.uuid : "";
            const isFav = state.favorites.find((f) => f.uuid === uuid);
            const favClass = isFav ? "text-warning" : "text-muted";
            const flagUrl = rawNat ? getFlagUrl(rawNat) : "";
            const countryName = rawNat ? escapeHtml(getCountryNameFromNat(rawNat)) : "";

            const $col = $('<div class="col-12 col-sm-6 col-md-4 col-lg-3"></div>');

            const cardHtml =
                '<article class="card user-card h-100" data-uuid="' +
                uuid +
                '">' +
                '<div class="card-header text-center border-0 pb-0">' +
                (avatar
                    ? '<img src="' +
                      avatar +
                      '" alt="Foto profilo di ' +
                      name +
                      '" class="user-avatar mb-2" loading="lazy">'
                    : "") +
                '<h2 class="h6 mb-0">' +
                name +
                "</h2>" +
                (age !== null
                    ? '<p class="text-muted mb-1 small">Età: ' + age + " anni</p>"
                    : "") +
                "</div>" +
                '<div class="card-body pt-2 user-meta">' +
                '<p class="mb-1"><i class="bi bi-envelope-open me-1"></i><a href="mailto:' +
                email +
                '">' +
                email +
                "</a></p>" +
                '<p class="mb-1"><i class="bi bi-geo-alt me-1"></i>' +
                city +
                (country ? ", " + country : "") +
                "</p>" +
                (rawNat
                    ? '<p class="mb-2"><i class="bi bi-flag me-1"></i>' +
                      (flagUrl
                          ? '<img class="flag-icon me-1" src="' +
                            flagUrl +
                            '" alt="Bandiera ' +
                            countryName +
                            '" loading="lazy">'
                          : "") +
                      "<span>" +
                      nat +
                      "</span></p>"
                    : "") +
                "</div>" +
                '<div class="card-footer bg-transparent border-0 pt-0 d-flex justify-content-between align-items-center flex-wrap gap-1 user-actions">' +
                '<button class="btn btn-sm btn-outline-success save-fav" data-uuid="' +
                uuid +
                '" data-name="' +
                name +
                '" title="Aggiungi ai preferiti">' +
                '<i class="bi bi-star ' +
                favClass +
                '"></i><span class="d-none d-sm-inline"> Preferito</span></button>' +
                '<a class="btn btn-sm btn-outline-primary" href="mailto:' +
                email +
                '"><i class="bi bi-send-fill me-1"></i><span class="d-none d-sm-inline"> Email</span></a>' +
                '<button class="btn btn-sm btn-outline-secondary download-json" data-uuid="' +
                uuid +
                '"><i class="bi bi-filetype-json me-1"></i><span class="d-none d-sm-inline"> JSON</span></button>' +
                "</div>" +
                "</article>";

            const $card = $(cardHtml);
            $col.append($card);
            $container.append($col);
        });

        hideNoResults();
        updatePaginationUI();
        renderFavoritesMenu();
    }

    // Gestione click su bottone "Preferito"
    $("#cards-container").on("click", ".save-fav", function (e) {
        e.preventDefault();
        const uuid = $(this).data("uuid");
        const name = $(this).data("name");

        if (!uuid) {
            alert("Utente senza id, impossibile salvare");
            return;
        }

        const exists = state.favorites.find((f) => f.uuid === uuid);
        const $icon = $(this).find("i");

        if (exists) {
            // Rimuovi
            state.favorites = state.favorites.filter((f) => f.uuid !== uuid);
            $icon.removeClass("text-warning").addClass("text-muted");
        } else {
            // Aggiungi
            state.favorites.push({ uuid: uuid, name: name });
            $icon.removeClass("text-muted").addClass("text-warning");
        }

        saveFavorites();
    });

    // Download JSON singolo utente
    $("#cards-container").on("click", ".download-json", function (e) {
        e.preventDefault();
        const uuid = $(this).data("uuid");
        if (!uuid) {
            alert("Utente senza id, impossibile esportare il JSON.");
            return;
        }
        const user = state.allData.find(function (u) {
            return u.login && u.login.uuid === uuid;
        });
        if (!user) {
            alert("Utente non trovato per l'esportazione.");
            return;
        }
        const filename = "randomuser-" + uuid + ".json";
        downloadJson(filename, user);
    });

    // --- Paging helpers ---
    function goToPage(page) {
        if (page < 1) page = 1;
        if (page > state.totalPages) page = state.totalPages;

        renderPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function updatePaginationUI() {
        $("#page-info").text("Pagina " + state.currentPage + " di " + state.totalPages);

        if (state.totalPages > 1) {
            $("#pagination-section").show();
        } else {
            $("#pagination-section").hide();
        }

        $("#btn-first, #btn-prev").prop("disabled", state.currentPage === 1);
        $("#btn-next, #btn-last").prop("disabled", state.currentPage === state.totalPages);
    }

    // --- UI helpers ---
    function setLoading(flag) {
        if (flag) {
            $("#loading").show();
            $("#btn-load").prop("disabled", true);
        } else {
            $("#loading").hide();
            $("#btn-load").prop("disabled", false);
        }
    }

    function showError(msg) {
        $("#error-message").text(msg).show();
    }

    function hideError() {
        $("#error-message").hide();
    }

    function showNoResults() {
        $("#no-results").show();
        $("#cards-container").hide();
    }

    function hideNoResults() {
        $("#no-results").hide();
        $("#cards-container").show();
    }

    function slugify(str) {
        return String(str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase();
    }

    function downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function downloadJson(filename, data) {
        try {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            downloadBlob(filename, blob);
        } catch (e) {
            console.error(e);
            alert("Impossibile scaricare il JSON.");
        }
    }

    function downloadAllAsZip() {
        if (typeof JSZip === "undefined") {
            // Fallback: scarica un file JSON per ogni persona (senza ZIP)
            if (!state.allData || state.allData.length === 0) {
                alert("Nessun utente da scaricare. Genera prima alcuni utenti.");
                return;
            }
            if (!confirm("La funzione ZIP non è disponibile. Vuoi scaricare un file JSON separato per ogni persona?")) {
                return;
            }
            state.allData.forEach(function (u, index) {
                const first = u.name && u.name.first ? u.name.first : "user";
                const last = u.name && u.name.last ? u.name.last : String(index + 1);
                const baseName = slugify(first + "-" + last);
                const filename = (baseName || "user-" + (index + 1)) + ".json";
                downloadJson(filename, u);
            });
            return;
        }
        const zip = new JSZip();
        state.allData.forEach(function (u, index) {
            const first = u.name && u.name.first ? u.name.first : "user";
            const last = u.name && u.name.last ? u.name.last : String(index + 1);
            const baseName = slugify(first + "-" + last);
            const filename = baseName ? baseName + ".json" : "user-" + (index + 1) + ".json";
            const json = JSON.stringify(u, null, 2);
            zip.file(filename, json);
        });
        zip.generateAsync({ type: "blob" }).then(function (blob) {
            downloadBlob("randomusers-all.zip", blob);
        }).catch(function (err) {
            console.error(err);
            alert("Impossibile generare lo ZIP.");
        });
    }

    // --- Init ---
    renderFavoritesMenu(); // popola menu preferiti all'avvio
    // Non caricare automaticamente all'avvio - l'utente deve premere "Carica Utenti" o modificare i filtri
    window._randomUserState = state; // utile per debugging da console
});
