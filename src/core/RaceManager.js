export class RaceManager {
    constructor() {
        this.state = 'COUNTDOWN';
        this.startTime = 0;
        this.currentTime = 0;
        this.finalTime = 0;

        const saved = localStorage.getItem('wheelchair_best_time');
        this.bestTime = saved ? parseFloat(saved) : null;

        this.checkpoints = [];
        this.currentCheckpoint = 0;
        this.checkpointsComplete = false;

        this.finishPos = { x: 0, z: -100 };
        this.finishRadius = 5;

        this.targetLaps = 1;
        this.currentLap = 1;
        this.trackType = 'straight';
        this.passedLaunchZone = false;
        this.launchZoneZ = -40;

        this.aiRacer = null;
        this.aiCheckpointsPassed = 0;
        this.aiCheckpointsComplete = false;
        this.aiCurrentLap = 1;
        this.aiPassedLaunchZone = false;
        this.winner = null;

        this.countdownValue = 3;
        this.countdownTimer = null;
    }

    init(trackType, trackData, laps = 1) {
        this.trackType = trackType;
        this.checkpoints = trackData.checkpoints;
        this.currentCheckpoint = 0;
        this.checkpointsComplete = false;
        this.targetLaps = trackType === 'circular' ? laps : 1;
        this.currentLap = 1;
        this.passedLaunchZone = false;
        this.state = 'COUNTDOWN';
        this.winner = null;

        this.aiCheckpointsPassed = 0;
        this.aiCheckpointsComplete = false;
        this.aiCurrentLap = 1;
        this.aiPassedLaunchZone = false;

        switch (trackType) {
            case 'straight':  this.finishPos = { x: 0, z: -100 }; break;
            case 'l-shape':   this.finishPos = { x: 50, z: -100 }; break;
            case 'complex':   this.finishPos = { x: 50, z: -200 }; break;
            case 'circular':  this.finishPos = { x: 0, z: -60 }; break;
        }

        this._startCountdown();
    }

    setAIRacer(ai) { this.aiRacer = ai; }

    _startCountdown() {
        this.countdownValue = 3;
        this._showCountdown();
        this.countdownTimer = setInterval(() => {
            this.countdownValue--;
            if (this.countdownValue > 0) this._showCountdown();
            else if (this.countdownValue === 0) this._showCountdown('ПОЕХАЛИ!');
            else {
                clearInterval(this.countdownTimer);
                this._hideCountdown();
                this._beginRace();
            }
        }, 1000);
    }

    _showCountdown(text) {
        const el = document.getElementById('countdown-overlay');
        if (!el) return;
        el.textContent = text || this.countdownValue;
        el.style.color = text ? '#00ff88' : (this.countdownValue === 1 ? '#ff4444' : '#ffffff');
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1.2)';
        requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) scale(1)'; });
        setTimeout(() => { el.style.opacity = '0'; }, 800);
    }

    _hideCountdown() {
        const el = document.getElementById('countdown-overlay');
        if (el) el.style.opacity = '0';
    }

    _beginRace() {
        this.state = 'RACING';
        this.startTime = Date.now();
    }

    updatePlayer(dt, pos) {
        if (this.state !== 'RACING' || this.winner) return;
        const { x, z } = pos;

        if (this.trackType === 'circular') {
            if (!this.passedLaunchZone) {
                if (z < this.launchZoneZ) this.passedLaunchZone = true;
                this.currentTime = Date.now() - this.startTime;
                return;
            }
            if (!this.checkpointsComplete && this.currentCheckpoint < this.checkpoints.length) {
                const cp = this.checkpoints[this.currentCheckpoint];
                if (Math.hypot(x - cp.x, z - cp.z) <= cp.radius) {
                    this.currentCheckpoint++;
                    if (this.currentCheckpoint >= this.checkpoints.length) this.checkpointsComplete = true;
                }
            }
            if (this.checkpointsComplete) {
                if (Math.hypot(x - this.finishPos.x, z - this.finishPos.z) <= this.finishRadius) {
                    if (this.currentLap >= this.targetLaps) { this._finish('player'); return; }
                    else { this.currentLap++; this.currentCheckpoint = 0; this.checkpointsComplete = false; }
                }
            }
        } else {
            if (this.currentCheckpoint < this.checkpoints.length) {
                const cp = this.checkpoints[this.currentCheckpoint];
                if (Math.hypot(x - cp.x, z - cp.z) <= cp.radius) this.currentCheckpoint++;
            }
            if (this.currentCheckpoint >= this.checkpoints.length) {
                if (Math.hypot(x - this.finishPos.x, z - this.finishPos.z) <= this.finishRadius) {
                    this._finish('player'); return;
                }
            }
        }
        this.currentTime = Date.now() - this.startTime;
    }

    updateAI(dt) {
        if (this.state !== 'RACING' || !this.aiRacer || this.winner) return;
        const pos = this.aiRacer.getPosition();
        const { x, z } = pos;

        if (this.trackType === 'circular') {
            if (!this.aiPassedLaunchZone) {
                if (z < this.launchZoneZ) this.aiPassedLaunchZone = true;
                return;
            }
            if (!this.aiCheckpointsComplete && this.aiCheckpointsPassed < this.checkpoints.length) {
                const cp = this.checkpoints[this.aiCheckpointsPassed];
                if (this.aiRacer.checkCheckpoint(cp)) {
                    this.aiCheckpointsPassed++;
                    if (this.aiCheckpointsPassed >= this.checkpoints.length) this.aiCheckpointsComplete = true;
                }
            }
            if (this.aiCheckpointsComplete) {
                if (this.aiRacer.checkFinish(this.finishPos, this.finishRadius)) {
                    if (this.aiCurrentLap >= this.targetLaps) { this._finish('ai'); return; }
                    else { this.aiCurrentLap++; this.aiCheckpointsPassed = 0; this.aiCheckpointsComplete = false; }
                }
            }
        } else {
            if (this.aiCheckpointsPassed < this.checkpoints.length) {
                const cp = this.checkpoints[this.aiCheckpointsPassed];
                if (this.aiRacer.checkCheckpoint(cp)) this.aiCheckpointsPassed++;
            }
            if (this.aiCheckpointsPassed >= this.checkpoints.length) {
                if (this.aiRacer.checkFinish(this.finishPos, this.finishRadius)) {
                    this._finish('ai'); return;
                }
            }
        }
    }

    _finish(who) {
        this.winner = who;
        this.state = 'FINISHED';
        const time = Date.now() - this.startTime;

        if (who === 'player') {
            this.finalTime = time;
            if (this.aiRacer) this.aiRacer.markFinished(time + 1000);
            if (this.bestTime === null || this.finalTime < this.bestTime) {
                this.bestTime = this.finalTime;
                localStorage.setItem('wheelchair_best_time', this.bestTime.toString());
                this._setStatus(`🏆 ПОБЕДА!\nРекорд: ${this.fmt(this.bestTime)}`, '#00ffff');
            } else {
                this._setStatus(`🏆 ПОБЕДА!\nВремя: ${this.fmt(this.finalTime)}`, '#ffeb3b');
            }
        } else {
            this._setStatus(`💀 ${this.aiRacer.name} ПОБЕДИЛ!\nПопробуй ещё!`, '#ff4444');
        }
    }

    canMove() { return this.state === 'RACING' && !this.winner; }

    fmt(ms) {
        if (ms == null) return '--:--.--';
        const m  = String(Math.floor(ms / 60000)).padStart(2, '0');
        const s  = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
        const cs = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
        return `${m}:${s}.${cs}`;
    }

    displayTime() {
        if (this.state === 'COUNTDOWN') return '00:00.00';
        if (this.state === 'FINISHED') return this.fmt(this.finalTime);
        return this.fmt(this.currentTime);
    }

    displayBest() { return this.bestTime != null ? this.fmt(this.bestTime) : '--:--.--'; }

    getLapInfo() {
        if (this.trackType !== 'circular') return null;
        return { current: this.currentLap, total: this.targetLaps };
    }

    _setStatus(text, color) {
        const el = document.getElementById('status-overlay');
        if (!el) return;
        el.textContent = text;
        el.style.color = color;
        el.style.opacity = '1';
    }
}