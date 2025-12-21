"use strict";

$(function () {
    const FAV_KEY = "ru-favorites";
    const NATIONALITIES = {
        'AU': 'Australia', 'BR': 'Brasile', 'CA': 'Canada', 'CH': 'Svizzera',
        'DE': 'Germania', 'DK': 'Danimarca', 'ES': 'Spagna', 'FI': 'Finlandia',
        'FR': 'Francia', 'GB': 'Regno Unito', 'IE': 'Irlanda', 'IN': 'India',
        'IR': 'Iran', 'MX': 'Messico', 'NL': 'Paesi Bassi', 'NO': 'Norvegia',
        'NZ': 'Nuova Zelanda', 'RS': 'Serbia', 'TR': 'Turchia', 'UA': 'Ucraina', 'US': 'Stati Uniti'
    };
    const GENDERS = {
        'male': 'Uomo',
        'female': 'Donna'
    };
    const ITEMS_PER_PAGE = 8;

    const state = {
        users: [],
        filtered: [],
        page: 1,
        totalPages: 1,
        favorites: JSON.parse(localStorage.getItem(FAV_KEY) || "[]"),
        hero: null,
    };

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    function showToast(message, isError = false) {
        const toastId = `toast-${Date.now()}`;
        const $toast = $('<div>', {
            id: toastId,
            class: `toast align-items-center text-white ${isError ? 'bg-danger' : 'bg-primary'} border-0`,
            role: 'alert',
            'aria-live': 'assertive',
            'aria-atomic': 'true'
        }).append(
            $('<div>').addClass('d-flex').append(
                $('<div>').addClass('toast-body').text(message),
                $('<button>').attr({
                    type: 'button',
                    class: 'btn-close btn-close-white me-2 m-auto',
                    'data-bs-dismiss': 'toast',
                    'aria-label': 'Close'
                })
            )
        );
        $('#toastPlacement').append($toast);
        const toast = new bootstrap.Toast($toast[0], { delay: 3000 });
        toast.show();
        $toast.on('hidden.bs.toast', function () { $(this).remove(); });
    }

    function saveUserAsJson(user) {
        if (!user) return;
        const jsonString = JSON.stringify(user, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${user.name.first}_${user.name.last}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Dati di ${user.name.first} salvati.`);
    }
    
    function showJsonViewer(user) {
        if (!user) return;
        const jsonString = JSON.stringify(user, null, 2);
        $('#json-viewer-content').text(jsonString);
        new bootstrap.Modal('#jsonViewerModal').show();
    }

    function fetchUsers(params) {
        return ajax.sendRequest('GET', '/api/', params)
            .then(response => response.data.results)
            .catch(err => {
                ajax.errore(err); // Use the error handling from libreria.js
                return []; // Always return an empty array on error to prevent breaking subsequent logic
            });
    }

    function loadUsers(filters) {
        $('#btn-load').prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');

        const currentFilters = filters || {
            results: Number($("#slider-results").val()),
            gender: $("input[name=gender]:checked").val(),
            nat: $(".nat:checked").map((_, el) => el.value).get()
        };

        if (filters) {
            $("#slider-results").val(currentFilters.results);
            $("#slider-value").text(currentFilters.results);
            $(`input[name=gender][value=${currentFilters.gender}]`).prop('checked', true);
            $(".nat").prop('checked', false);
            currentFilters.nat.forEach(n => $(`#nat-${n.toLowerCase()}`).prop('checked', true));
        }

        const params = { results: currentFilters.results, gender: currentFilters.gender, nat: currentFilters.nat.join(','), inc: 'gender,name,location,email,login,dob,phone,cell,picture,nat,registered' };
        if (params.gender === 'all') delete params.gender;
        if (!params.nat) delete params.nat;

        fetchUsers(params).then(users => {
            if (!users) return; 
            state.users = users;
            state.page = 1;
            applyFiltersAndRender();
            calculateAndRenderStats();
            renderFavorites();
            $('#btn-load').prop('disabled', false).html('<i class="bi bi-cloud-download"></i> Carica');
        });
    }
    
    function applyFiltersAndRender() {
        applySearch();
        applySort();
        paginate();
        renderPage();
        renderActiveFilters();
    }
    
    function applySearch() {
        const q = $("#search").val().toLowerCase().trim();
        state.filtered = !q ? [...state.users] : state.users.filter(u => `${u.name.first} ${u.name.last} ${u.email}`.toLowerCase().includes(q));
    }

    function applySort() {
        const v = $("#sort").val();
        if (v === "none") { return; }
        state.filtered.sort((a, b) => {
            if (v === "name-asc") return `${a.name.first} ${a.name.last}`.localeCompare(`${b.name.first} ${b.name.last}`);
            if (v === "name-desc") return `${b.name.first} ${b.name.last}`.localeCompare(`${a.name.first} ${a.name.last}`);
            if (v === "nat-asc") return a.nat.localeCompare(b.nat);
            return 0;
        });
    }

    function isFav(uuid) { return state.favorites.includes(uuid); }

    function saveFavs() {
        localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
        renderFavorites();
    }

    function toggleFavorite(uuid) {
        const idx = state.favorites.indexOf(uuid);
        const user = [...state.users, state.hero].find(u => u && u.login.uuid === uuid);
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            if(user) showToast(`'${user.name.first}' rimosso dai preferiti!`);
        } else {
            state.favorites.push(uuid);
            if(user) showToast(`'${user.name.first}' aggiunto ai preferiti!`);
        }
        saveFavs();
    }
    
    function loadHero(filters) {
        $('#btn-refresh-hero').prop('disabled', true).addClass('rotating');
        
        const currentFilters = filters || {
            gender: $("input[name=gender]:checked").val(),
            nat: $(".nat:checked").map((_, el) => el.value).get()
        };
        
        const params = { results: 1, gender: currentFilters.gender, nat: currentFilters.nat.join(','), inc: 'gender,name,location,email,login,dob,phone,cell,picture,nat,registered' };
        if (params.gender === 'all') delete params.gender;
        if (!params.nat) delete params.nat;

        fetchUsers(params).then(([user]) => {
            $('#btn-refresh-hero').prop('disabled', false).removeClass('rotating');
            if (!user) return;
            state.hero = user;
            $("#hero-avatar img").attr("src", user.picture.large);
            $("#hero-name").text(`${user.name.first} ${user.name.last}`);
            $("#hero-email").html(`<i class="bi bi-envelope"></i> ${user.email}`);
            $("#hero-username").html(`<i class="bi bi-person-badge"></i> @${user.login.username}`);
            
            const genderIcon = user.gender === 'male' ? 'bi-gender-male' : 'bi-gender-female';
            $("#hero-gender").html(`<i class="bi ${genderIcon}"></i> ${GENDERS[user.gender] || user.gender}`);
            $("#hero-nat").html(`<i class="bi bi-globe"></i> ${NATIONALITIES[user.nat] || user.nat}`);
            $("#hero-age").html(`<i class="bi bi-calendar-event"></i> ${user.dob.age} anni`);

            updateHeroFavButton();
        });
    }

    function updateHeroFavButton() {
        if (!state.hero) return;
        const isHeroFav = isFav(state.hero.login.uuid);
        $("#btn-hero-fav").html(isHeroFav ? '<i class="bi bi-heart-fill"></i> Rimuovi' : '<i class="bi bi-heart"></i> Aggiungi').toggleClass("btn-primary", !isHeroFav).toggleClass("btn-outline-danger", isHeroFav);
        
        $("#hero-name .bi-heart-fill").remove();
        if(isHeroFav) {
            $("#hero-name").append(' <i class="bi bi-heart-fill text-danger"></i>');
        }
    }

    function paginate() {
        state.totalPages = Math.max(1, Math.ceil(state.filtered.length / ITEMS_PER_PAGE));
        state.page = Math.min(state.page, state.totalPages);
    }

    function renderNationalities() {
        const container = $("#nat-container");
        for (const [code, name] of Object.entries(NATIONALITIES)) {
            container.append(`
                <div class="form-check form-check-inline">
                    <input class="form-check-input nat" type="checkbox" value="${code}" id="nat-${code.toLowerCase()}">
                    <label class="form-check-label" for="nat-${code.toLowerCase()}">
                        <img src="https://flagcdn.com/w20/${code.toLowerCase()}.png" srcset="https://flagcdn.com/w40/${code.toLowerCase()}.png 2x" alt="${name}" class="me-1" width="20">${name}
                    </label>
                </div>`);
        }
    }

    function renderActiveFilters() {
        const container = $('#active-filters-container').empty();
        const gender = $("input[name=gender]:checked").val();
        const nats = $(".nat:checked").map((_, el) => el.value).get();

        if (gender !== 'all') {
            const badge = $(`
                <span class="badge bg-secondary d-inline-flex align-items-center">
                    Genere: ${GENDERS[gender] || gender} 
                    <button class="btn-close btn-close-white ms-2" data-filter-type="gender"></button>
                </span>
            `);
            container.append(badge);
        }
        nats.forEach(nat => {
            const badge = $(`
                <span class="badge bg-secondary d-inline-flex align-items-center">
                    Nazione: ${NATIONALITIES[nat] || nat} 
                    <button class="btn-close btn-close-white ms-2" data-filter-type="nat" data-filter-value="${nat}"></button>
                </span>
            `);
            container.append(badge);
        });
    }

    function renderPage() {
        const container = $("#cards-container").empty();
        const start = (state.page - 1) * ITEMS_PER_PAGE;
        const pageUsers = state.filtered.slice(start, start + ITEMS_PER_PAGE);

        $("#no-results").toggle(!pageUsers.length);
        $("#pager").toggle(pageUsers.length > 0 && state.totalPages > 1);

        if (!pageUsers.length) return;

        pageUsers.forEach((u, index) => {
            const fav = isFav(u.login.uuid);
            const $card = $('<article>').addClass('user-card fade-in').attr('data-id', u.login.uuid).css('animation-delay', `${index * 50}ms`).append(
                $('<div>').addClass('uimg').append($('<img>').attr('src', u.picture.medium).attr('alt', 'Avatar')),
                $('<div>').addClass('udata').append(
                    $('<div>').addClass('name').text(`${u.name.first} ${u.name.last}`),
                    $('<div>').addClass('small').text(u.email),
                    $('<div>').addClass('actions mt-2').append(
                        $('<button>').addClass('btn btn-sm btn-outline-secondary btn-details').attr('title', 'Mostra dettagli').html('<i class="bi bi-info-circle"></i>'),
                        $('<button>').addClass(`btn btn-sm btn-fav ${fav ? 'btn-danger' : 'btn-outline-danger'}`).attr('title', fav ? 'Rimuovi' : 'Aggiungi').html(fav ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>')
                    )
                )
            );
            container.append($card);
        });
        updatePager();
    }

    function renderFavorites() {
        const list = $("#favorites-list").empty();
        const favUsers = [...new Map(state.favorites.map(id => [id, [...state.users, state.hero].find(u => u && u.login.uuid === id)]).filter(([, u]) => u)).values()];
        if (!favUsers.length) { list.html('<div class="text-muted small p-2">Nessun preferito.</div>'); return; }
        favUsers.forEach(u => {
            const $favItem = $('<div>').addClass('fav-item mb-2').append(
                $('<img>').attr('src', u.picture.thumbnail).attr('alt', 'Avatar'),
                $('<div>').addClass('small flex-grow-1').text(`${u.name.first} ${u.name.last}`),
                $('<div>').addClass('btn-group').append(
                    $('<button>').addClass('btn btn-sm btn-outline-primary btn-view-json').attr('data-id', u.login.uuid).attr('title', 'Vedi JSON').html('<i class="bi bi-file-code"></i>'),
                    $('<button>').addClass('btn btn-sm btn-outline-danger btn-remove-fav').attr('data-id', u.login.uuid).attr('title', 'Rimuovi').html('<i class="bi bi-trash"></i>')
                )
            );
            list.append($favItem);
        });
    }

    function calculateAndRenderStats() {
        const container = $('#stats-container');
        if (!state.users.length) { container.html('<div class="text-muted small p-2">Nessun dato da analizzare.</div>'); return; }
        const total = state.users.length;
        const males = state.users.filter(u => u.gender === 'male').length;
        const females = total - males;
        const avgAge = (state.users.reduce((acc, u) => acc + u.dob.age, 0) / total).toFixed(1);
        const natCounts = state.users.reduce((acc, u) => { acc[u.nat] = (acc[u.nat] || 0) + 1; return acc; }, {});
        const topNat = Object.keys(natCounts).reduce((a, b) => natCounts[a] > natCounts[b] ? a : b, '');

        container.html('').append(
            $('<ul>').addClass('list-unstyled small').append(
                $('<li>').html(`<i class="bi bi-gender-male"></i> ${GENDERS['male']}: <b>${(males/total*100).toFixed(0)}%</b>`),
                $('<li>').html(`<i class="bi bi-gender-female"></i> ${GENDERS['female']}: <b>${(females/total*100).toFixed(0)}%</b>`),
                $('<li>').html(`<i class="bi bi-cake2"></i> Età media: <b>${avgAge}</b>`),
                $('<li>').html(`<i class="bi bi-globe"></i> Top Nazionalità: <b>${NATIONALITIES[topNat] || topNat}</b> (${natCounts[topNat]})`)
            )
        );
    }

    function updatePager() {
        const start = (state.page - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(start + ITEMS_PER_PAGE - 1, state.filtered.length);
        const countText = `Visualizzati ${end > 0 ? start : 0}-${end} di ${state.filtered.length}`;
        $("#page-info").text(`Pag. ${state.page}/${state.totalPages} (${countText})`);
        $("#btn-first, #btn-prev").prop("disabled", state.page === 1);
        $("#btn-last, #btn-next").prop("disabled", state.page === state.totalPages);
    }
    
    function showUserDetails(user) {
        if (!user) return;
        const modal = $('#detailsModal');
        modal.find("#modal-avatar").attr("src", user.picture.large);
        modal.find("#modal-name").text(`${user.name.first} ${user.name.last}`);
        modal.find("#modal-email").text(user.email);
        
        const genderIcon = user.gender === 'male' ? 'bi-gender-male' : 'bi-gender-female';
        modal.find("#modal-natgender").html('').append(
            $('<p>').addClass('mb-0 d-flex align-items-center gap-2').html(`<i class="bi ${genderIcon}"></i> ${GENDERS[user.gender] || user.gender}`),
            $('<p>').addClass('mb-0 d-flex align-items-center gap-2').html(`<i class="bi bi-globe"></i> ${NATIONALITIES[user.nat] || user.nat}`)
        );

        const details = {
            "Anagrafica": {
                "Nome Completo": `${user.name.title} ${user.name.first} ${user.name.last}`,
                "Nazionalità": NATIONALITIES[user.nat] || user.nat,
                "Genere": GENDERS[user.gender] || user.gender,
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
                "Salt": user.login.salt,
                "MD5": user.login.md5,
                "SHA1": user.login.sha1,
                "SHA256": user.login.sha256,
            }
        };

        const body = modal.find("#modal-body-details").empty();
        for (const [section, data] of Object.entries(details)) {
            body.append($('<h5>').text(section));
            const $sectionDiv = $('<div>').addClass('row mb-3');
            for (const [key, value] of Object.entries(data)) {
                $sectionDiv.append(
                    $('<div>').addClass('col-md-6 mb-2').append(
                        $('<p>').addClass('mb-0').append($('<strong>').text(`${key}:`)),
                        $('<p>').addClass('text-muted').css('word-wrap', 'break-word').text(value)
                    )
                );
            }
            body.append($sectionDiv);
        }
        
        modal.find('.btn-extra').remove();
        const $jsonBtn = $('<button>').addClass('btn btn-sm btn-outline-info btn-extra me-2').html('<i class="bi bi-file-code"></i> Vedi JSON').on('click', () => showJsonViewer(user));
        const $saveBtn = $('<button>').addClass('btn btn-sm btn-primary btn-extra').html('<i class="bi bi-download"></i> Salva JSON').on('click', () => saveUserAsJson(user));
        modal.find('button[data-bs-dismiss="modal"]').before($jsonBtn).before($saveBtn);
        
        new bootstrap.Modal(modal[0]).show();
    }

    function initEventHandlers() {
        const debouncedLoad = debounce(() => {
            const filters = {
                results: Number($("#slider-results").val()),
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            };
            loadUsers(filters);
        }, 400);

        $(document).on("input", "#slider-results", function () { 
            $("#slider-value").text($(this).val()); 
            debouncedLoad();
        });
        $(document).on('change', 'input[name=gender]', debouncedLoad);
        $(document).on('change', '.nat', () => {
            const filters = {
                results: Number($("#slider-results").val()),
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            };
            loadUsers(filters);
        });

        $(document).on("click", "#btn-load", () => loadUsers());
        
        $(document).on("click", "#btn-refresh-hero", () => {
            const filters = {
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            };
            loadHero(filters);
        });

        $(document).on("click", "#btn-hero-fav", () => { if(state.hero) { toggleFavorite(state.hero.login.uuid); updateHeroFavButton(); } });
        $(document).on("click", "#btn-hero-details", () => showUserDetails(state.hero));
        
        const debouncedSearch = debounce(() => applyFiltersAndRender(), 350);
        $(document).on('input', '#search', debouncedSearch);
        $(document).on("change", "#sort", () => {
            applyFiltersAndRender();
        });

        $(document).on("click", "#pager button", function () {
            const action = this.id;
            if (action === 'btn-first') state.page = 1;
            if (action === 'btn-last') state.page = state.totalPages;
            if (action === 'btn-prev' && state.page > 1) state.page--;
            if (action === 'btn-next' && state.page < state.totalPages) state.page++;
            renderPage();
        });

        $(document).on("click", "#cards-container .btn-fav", function (e) {
            e.stopPropagation();
            const uuid = $(this).closest(".user-card").data("id");
            toggleFavorite(uuid);
            $(this).toggleClass('btn-danger', isFav(uuid)).toggleClass('btn-outline-danger', !isFav(uuid)).html(isFav(uuid) ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>');
        });

        $(document).on("click", "#cards-container .user-card", function (e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            showUserDetails(state.users.find(u => u.login.uuid === uuid));
        });
        
        $(document).on("click", "#favorites-list .btn-remove-fav", function(e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            toggleFavorite(uuid);
            renderPage();
            updateHeroFavButton();
        });

        $(document).on("click", "#favorites-list .btn-view-json", function(e) {
            e.stopPropagation();
            const uuid = $(this).data("id");
            const user = [...state.users, state.hero].find(u => u && u.login.uuid === uuid);
            if (user) showJsonViewer(user);
        });

        $(document).on("click", "#clear-fav", () => {
            if (confirm("Sei sicuro di voler svuotare i preferiti?")) {
                state.favorites = [];
                saveFavs();
                renderPage();
                updateHeroFavButton();
            }
        });
        
        $(document).on("click", "#btn-clear-filters", () => {
            $(".nat").prop("checked", false);
            $("input[name=gender][value=all]").prop("checked", true);
            $("#search").val(""); 
            $("#sort").val("none");
            $("#slider-results").val(10); 
            $("#slider-value").text(10);
            loadUsers();
        });

        $(document).on('click', '#active-filters-container button', function() {
            const type = $(this).data('filter-type');
            if (type === 'gender') {
                $('input[name=gender][value=all]').prop('checked', true);
            } else if (type === 'nat') {
                const value = $(this).data('filter-value');
                $(`.nat[value=${value}]`).prop('checked', false);
            }
            
            const filters = {
                results: Number($("#slider-results").val()),
                gender: $("input[name=gender]:checked").val(),
                nat: $(".nat:checked").map((_, el) => el.value).get()
            };
            loadUsers(filters);
        });

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
            $('html, body').animate({scrollTop: 0}, '300');
        });
    }
    
    function init() {
        renderNationalities();
        initEventHandlers();
        loadHero();
        loadUsers();
    }

    init();
});
