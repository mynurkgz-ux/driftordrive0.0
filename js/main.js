'use strict';
// Точка входа
(function boot() {
  SAVE.load();
  NET.init();
  INPUT.init();
  GAME.init();
  UI.init();

  // Звук можно включить только после первого действия пользователя
  const unlock = () => { AUDIO.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  // Вход по ссылке-приглашению ?room=КОД
  const m = location.search.match(/[?&]room=([A-Za-z0-9]+)/);
  if (m) {
    const code = m[1];
    const tryJoin = (n) => {
      if (NET.ok && NET.ready) { UI.joinRoom(code); return; }
      if (!NET.ok && n > 0 && !window.firebase) { UI.toast('Мультиплеер недоступен: нет связи с Firebase', 'bad'); return; }
      if (n > 40) { UI.joinRoom(code); return; }
      setTimeout(() => tryJoin(n + 1), 150);
    };
    tryJoin(0);
  }

  // Предупреждение для открытия как файла
  if (location.protocol === 'file:') {
    setTimeout(() => UI.toast('Совет: запусти через start.bat (локальный сервер) — тогда заработают аккаунты и мультиплеер'), 1200);
  }
})();
