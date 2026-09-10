export class TrackSelector {
    constructor() {
        this.trackContainer = document.getElementById('track-selector');
        this.lapsContainer = document.getElementById('laps-selector');
        this.difficultyContainer = document.getElementById('difficulty-selector');

        this.trackButtons = document.querySelectorAll('.track-btn');
        this.lapsButtons = document.querySelectorAll('.laps-btn');
        this.difficultyButtons = document.querySelectorAll('.diff-btn');
        this.backButton = document.getElementById('back-to-tracks');

        this.selectedTrack = null;
        this.selectedLaps = 1;
        this.selectedDifficulty = 'medium';
        this.onSelect = null;

        this.trackButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const track = btn.dataset.track;
                if (track === 'circular') {
                    this.trackContainer.style.display = 'none';
                    this.lapsContainer.style.display = 'flex';
                } else {
                    this.selectedTrack = track;
                    this.selectedLaps = 1;
                    this.trackContainer.style.display = 'none';
                    this.difficultyContainer.style.display = 'flex';
                }
            });
        });

        this.lapsButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedTrack = 'circular';
                this.selectedLaps = parseInt(btn.dataset.laps);
                this.lapsContainer.style.display = 'none';
                this.difficultyContainer.style.display = 'flex';
            });
        });

        this.backButton.addEventListener('click', () => {
            this.lapsContainer.style.display = 'none';
            this.trackContainer.style.display = 'flex';
        });

        this.difficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedDifficulty = btn.dataset.diff;
                this.difficultyContainer.style.display = 'none';
                if (this.onSelect) {
                    this.onSelect(this.selectedTrack, this.selectedLaps, this.selectedDifficulty);
                }
            });
        });
    }
}