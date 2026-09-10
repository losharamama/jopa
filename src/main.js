import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
    new Game().init().catch(err => {
        console.error('Fatal:', err);
        document.body.innerHTML = `<h1 style="color:red;text-align:center;margin-top:60px">
            Ошибка! Открой консоль (F12)</h1>`;
    });
});