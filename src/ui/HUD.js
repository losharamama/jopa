export class HUD {
    constructor() {
        this.speedEl    = document.getElementById('speed');
        this.timerEl    = document.getElementById('timer');
        this.bestTimeEl = document.getElementById('best-time');
        this.lapEl      = document.getElementById('lap-counter');
    }

    update(v, race) {
        this.speedEl.textContent    = `${Math.abs(Math.round(v * 3.6))} км/ч`;
        this.timerEl.textContent    = race.displayTime();
        this.bestTimeEl.textContent = `Лучшее: ${race.displayBest()}`;

        const lapInfo = race.getLapInfo();
        if (lapInfo) {
            this.lapEl.textContent = `Круг ${lapInfo.current} / ${lapInfo.total}`;
            this.lapEl.style.display = 'block';
        } else {
            this.lapEl.style.display = 'none';
        }
    }
}