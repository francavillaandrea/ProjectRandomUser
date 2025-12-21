$(function () {
    function setTheme(mode = 'auto') {
        const userMode = localStorage.getItem('bs-theme');
        const sysModeIsLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        const useSystem = mode === 'system' || (!userMode && mode === 'auto');
        
        let modeChosen;
        if (useSystem) {
            modeChosen = 'system';
        } else if (mode === 'dark' || mode === 'light') {
            modeChosen = mode;
        } else {
            modeChosen = userMode;
        }

        if (useSystem) {
            localStorage.removeItem('bs-theme');
        } else {
            localStorage.setItem('bs-theme', modeChosen);
        }

        const theme = useSystem ? (sysModeIsLight ? 'light' : 'dark') : modeChosen;
        
        const $overlay = $('<div>').css({
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0)',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'none'
        }).appendTo('body');
        
        $overlay.css('backgroundColor', 'rgba(0,0,0,0.8)').fadeIn(200, function() {
            $('html').attr('data-bs-theme', theme);
            
            $(this).fadeOut(300, function() {
                $(this).remove();
            });
        });

        $('.mode-switch .btn').removeClass('active');
        $(`#${modeChosen}`).addClass('active');
    }

    setTheme();

    $(document).on('click', '.mode-switch .btn', function() {
        setTheme(this.id);
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        const userMode = localStorage.getItem('bs-theme');
        if (!userMode) {
            setTheme();
        }
    });
});