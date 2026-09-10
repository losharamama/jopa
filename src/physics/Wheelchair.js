import * as THREE from 'three';

export class WheelchairPhysics {
    constructor() {
        this.velocity     = 0;
        this.acceleration = 22;      // было 15 → увеличено
        this.friction     = 0.992;   // было 0.98 → уменьшено трение
        this.maxSpeed     = 28;      // было 20 → увеличено
        this.turnSpeed    = 2.8;     // было 2.5 → отзывчивее поворот
        this.rotation     = 0;

        // Зоны трассы
        this.grip = 1.0;
        this.speedMultiplier = 1.0;
        this.targetGrip = 1.0;
        this.targetSpeedMultiplier = 1.0;

        // Дрифт
        this.isDrifting = false;
        this.driftDirection = 0;
        this.driftFriction = 0.997;   // было 0.995
        this.driftTurnMultiplier = 1.8;
        this.driftBoostAmount = 8;    // было 6 → сильнее бонус
        this.minSpeedToDrift = 4;
        this.driftDuration = 0;
        this.driftBoostCooldown = 0;
    }

    update(dt, input) {
        const wantsLeft  = input.isPressed('KeyA');
        const wantsRight = input.isPressed('KeyD');
        const wantsDrift = input.isPressed('ShiftLeft') || input.isPressed('ShiftRight');
        const speed = Math.abs(this.velocity);

        // Плавная интерполяция параметров зон
        this.grip = THREE.MathUtils.lerp(this.grip, this.targetGrip, 0.1);
        this.speedMultiplier = THREE.MathUtils.lerp(this.speedMultiplier, this.targetSpeedMultiplier, 0.1);

        // Дрифт
        const wasDrifting = this.isDrifting;
        const driftThreshold = this.grip < 0.7 ? 2 : this.minSpeedToDrift;
        this.isDrifting = wantsDrift && (wantsLeft || wantsRight) && speed > driftThreshold;

        if (this.isDrifting) {
            this.driftDirection = wantsLeft ? 1 : -1;
            this.driftDuration += dt;
        } else {
            this.driftDuration = 0;
        }

        if (wasDrifting && !this.isDrifting && this.driftDuration > 0.3) {
            const dir = this.velocity > 0 ? 1 : -1;
            this.velocity += this.driftBoostAmount * dir;
            this.driftBoostCooldown = 0.3;
        }
        this.driftBoostCooldown = Math.max(0, this.driftBoostCooldown - dt);

        // Ускорение / торможение
        if (input.isPressed('KeyW'))      this.velocity += this.acceleration * dt;
        else if (input.isPressed('KeyS')) this.velocity -= this.acceleration * dt * 1.2; // торможение чуть сильнее
        else {
            const f = this.isDrifting ? this.driftFriction : this.friction;
            this.velocity *= f;
        }

        const effectiveMax = this.maxSpeed * this.speedMultiplier;
        this.velocity = Math.max(-effectiveMax / 2, Math.min(effectiveMax * 1.5, this.velocity));
        if (Math.abs(this.velocity) < 0.1) this.velocity = 0;

        // Поворот (зависит от grip)
        if (Math.abs(this.velocity) > 0.5) {
            const dir = this.velocity > 0 ? 1 : -1;
            const turnMul = this.isDrifting ? this.driftTurnMultiplier : 1;
            const gripMul = 0.4 + this.grip * 0.6;
            if (wantsLeft)  this.rotation += this.turnSpeed * turnMul * gripMul * dir * dt;
            if (wantsRight) this.rotation -= this.turnSpeed * turnMul * gripMul * dir * dt;
        }
    }
}