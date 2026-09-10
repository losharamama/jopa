import { SceneSetup } from './Scene.js';
import { Keyboard } from '../input/Keyboard.js';
import { Player } from '../entities/Player.js';
import { HUD } from '../ui/HUD.js';
import { RaceManager } from './RaceManager.js';
import { TrackBuilder } from './TrackBuilder.js';
import { TrackSelector } from '../ui/TrackSelector.js';
import { AIRacer } from '../entities/AIRacer.js';
import * as THREE from 'three';

export class Game {
    constructor() {
        this.sceneSetup = new SceneSetup();
        this.input = new Keyboard();
        this.hud = new HUD();
        this.race = new RaceManager();
        this.selector = new TrackSelector();
        this.clock = new THREE.Clock();
        this.player = null;
        this.aiRacer = null;
    }

    async init() {
        const { trackType, laps, difficulty } = await this._pickTrack();

        const builder = new TrackBuilder(this.sceneSetup.scene, trackType);
        const trackData = builder.build();

        // Игрок
        this.player = new Player(this.sceneSetup.scene, this.input);
        await this.player.init();
        this.player.setTrackData(trackData);
        this.player.setPosition(trackData.startPos.x, trackData.startPos.y, trackData.startPos.z);
        this.player.setRotation(trackData.startRotation);

        // ИИ-соперник
        const skillMap = { easy: 0.9, medium: 1.1, hard: 1.4 };
        this.aiRacer = new AIRacer(
            this.sceneSetup.scene, 'БОТ', 0x3366ff, skillMap[difficulty] || 1.0
        );
        this.aiRacer.setWaypoints(trackData.aiWaypoints);
        this.aiRacer.setTrackData(trackData);

        const aiX = trackType === 'circular' ? 2 : trackData.startPos.x + 2;
        this.aiRacer.setPosition(aiX, trackData.startPos.y, trackData.startPos.z);
        this.aiRacer.setRotation(trackData.startRotation);

        // НОВОЕ: Передаём бота игроку для коллизий
        this.player.setAIRacer(this.aiRacer);

        this.player.updateCamera(this.sceneSetup.camera);

        const ld = document.getElementById('loading');
        if (ld) ld.style.opacity = '0';

        this.race.init(trackType, trackData, laps);
        this.race.setAIRacer(this.aiRacer);

        this._loop();
    }

    _pickTrack() {
        return new Promise(resolve => {
            this.selector.onSelect = (t, l, d) => resolve({
                trackType: t, laps: l, difficulty: d
            });
        });
    }

    _loop() {
        requestAnimationFrame(() => this._loop());
        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.player) {
            const canMove = this.race.canMove();

            this.player.update(dt, canMove);
            this.player.updateCamera(this.sceneSetup.camera);

            this.race.updatePlayer(dt, this.player.model.position);

            if (this.aiRacer) {
                // НОВОЕ: Передаём скорость игрока боту для расчёта импульса
                this.aiRacer.setPlayerVelocity(this.player.physics.velocity);
                this.aiRacer.update(dt, this.player.model.position, canMove);
                this.race.updateAI(dt);
            }

            this.hud.update(this.player.physics.velocity, this.race);
        }

        this.sceneSetup.renderer.render(this.sceneSetup.scene, this.sceneSetup.camera);
    }
}