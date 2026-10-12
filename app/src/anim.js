// Animations page d'accueil — script INDÉPENDANT (aucun import, aucun dépendance).
// Les éléments sont visibles par défaut ; ils ne sont masqués que si ce script
// s'exécute (classe js-anim). Si ce script échoue, la page reste entièrement lisible.
(function () {
    document.documentElement.classList.add('js-anim');
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
        document.querySelectorAll('.stat-num[data-count]').forEach(function (el) {
            el.textContent = el.dataset.count + (el.dataset.suffix || '');
        });
        return;
    }
    var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) { io.observe(el); });
    function fmCountUp(el) {
        var target = parseInt(el.dataset.count || '0', 10), suffix = el.dataset.suffix || '';
        var dur = 1500, t0 = performance.now();
        (function tick(t) {
            var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * e) + suffix;
            if (p < 1) requestAnimationFrame(tick);
        })(t0);
    }
    var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { fmCountUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    document.querySelectorAll('.stat-num[data-count]').forEach(function (el) { cio.observe(el); });
})();
