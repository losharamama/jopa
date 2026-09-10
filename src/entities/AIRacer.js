import * as THREE from 'three';

export class AIRacer {
    constructor(scene, name = 'БОТ', color = 0x3366ff, skill = 1.0) {
        this.scene = scene;
        this.name = name;
        this.skill = skill;
        this.wheels = [];

                this.velocity = 0;
        this.rotation = 0;
        this.maxSpeed = 26 * skill;      // было 22 → подстраиваем под нового игрока
        this.acceleration = 18 * skill;  // было 16
        this.friction = 0.992;           // было 0.99 → такое же, как у игрока
        this.turnSpeed = 3.2;

        this.waypoints = [];
        this.currentWaypoint = 0;
        this.waypointRadius = 4;
        this.finished = false;

        this.baseY = 0.5;
        this.yVelocity = 0;
        this.isGrounded = true;
        this.gravity = -35;
        this.lastPosition = new THREE.Vector3();

        this.boosters = [];
        this.ramps = [];
        this.obstacles = [];
        this.slowdowns = [];
        this.slipperyZones = [];
        this.lastBoosterTime = 0;
        this.lastRampTime = 0;

        this.currentGrip = 1.0;
        this.currentSpeedMul = 1.0;
        this.targetGrip = 1.0;
        this.targetSpeedMul = 1.0;

        // НОВОЕ: Столкновения с игроком
        this.lastCollisionTime = 0;
        this.collisionCooldown = 300;
        this._playerVelocity = 0;

        // Синхронная заглушка
        this.model = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1.5, 2.5),
            new THREE.MeshStandardMaterial({ color })
        );
        this.model.castShadow = true;
        this.scene.add(this.model);
        this._addNameTag();
        this._loadModelAsync(color);
    }

    setTrackData(data) {
        this.boosters = data.boosters || [];
        this.ramps = data.ramps || [];
        this.obstacles = data.obstacles || [];
        this.slowdowns = data.slowdowns || [];
        this.slipperyZones = data.slipperyZones || [];
    }

    // НОВОЕ: Получаем скорость игрока для расчёта импульса
    setPlayerVelocity(v) {
        this._playerVelocity = v;
    }

    async _loadModelAsync(color) {
        try {
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const data = await new Promise((res, rej) => {
                loader.load('assets/models/wheelchair.glb', res, undefined, rej);
            });
            this.scene.remove(this.model);
            this.model = data.scene;
            this.model.traverse(c => {
                if (c.isMesh) {
                    c.material = new THREE.MeshStandardMaterial({ color });
                    c.castShadow = true;
                    if (c.name.startsWith('wheel_')) this.wheels.push(c);
                }
            });
            this.scene.add(this.model);
            this._addNameTag();
        } catch (e) { /* оставляем заглушку */ }
    }

    _addNameTag() {
        if (this.nameTag) this.model.remove(this.nameTag);
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 128, 42);
        this.nameTag = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(c), depthTest: false
        }));
        this.nameTag.scale.set(3, 0.75, 1);
        this.nameTag.position.y = 3;
        this.model.add(this.nameTag);
    }

    setWaypoints(pts) { this.waypoints = pts.map(p => new THREE.Vector3(p.x, 0, p.z)); }
    setPosition(x, y, z) {
        this.model.position.set(x, y, z);
        this.baseY = y;
        this.lastPosition.copy(this.model.position);
    }
    setRotation(rad) { this.rotation = rad; }

    update(dt, playerPosition, canMove = true) {
        this.lastPosition.copy(this.model.position);

        if (!canMove || this.finished) {
            this.velocity *= 0.90;
            if (Math.abs(this.velocity) < 0.1) this.velocity = 0;
        } else {
            this._driveAI(dt);
        }

        const sinR = Math.sin(this.rotation), cosR = Math.cos(this.rotation);
        this.model.position.x += sinR * this.velocity * dt;
        this.model.position.z += cosR * this.velocity * dt;
        this.model.rotation.y = this.rotation;

        if (!this.isGrounded) {
            this.yVelocity += this.gravity * dt;
            this.model.position.y += this.yVelocity * dt;
            if (this.model.position.y <= this.baseY) {
                this.model.position.y = this.baseY;
                this.yVelocity = 0;
                this.isGrounded = true;
            }
        }

        // НОВОЕ: Улучшенная коллизия с игроком
        if (playerPosition) this._checkPlayerCollision(playerPosition);

        if (this.wheels.length > 0) {
            const wr = this.velocity * dt * 3;
            this.wheels.forEach(w => { w.rotation.x += wr; });
        }

        if (canMove) { this._checkPickups(); this._checkZones(); }
        else { this.targetGrip = 1.0; this.targetSpeedMul = 1.0; }
    }

    _driveAI(dt) {
        if (this.waypoints.length === 0) return;
        const t = this.waypoints[this.currentWaypoint];
        const dx = t.x - this.model.position.x, dz = t.z - this.model.position.z;
        const dist = Math.hypot(dx, dz);
        const targetAngle = Math.atan2(dx, dz);
        let angleDiff = targetAngle - this.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const gripMul = 0.4 + this.currentGrip * 0.6;
        this.rotation += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnSpeed * gripMul * dt);

        const effectiveMax = this.maxSpeed * this.currentSpeedMul;
        const absDiff = Math.abs(angleDiff);
        if (absDiff < 1.2) {
            this.velocity += this.acceleration * dt;
        } else if (absDiff < 1.8) {
            this.velocity *= 0.99;
        } else {
            this.velocity *= 0.95;
        }

        this.velocity = Math.min(this.velocity, effectiveMax);
        this.velocity *= this.friction;

        if (dist < this.waypointRadius) {
            this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
        }
    }

    /* ═══════ КОЛЛИЗИЯ С ИГРОКОМ ═══════ */

    _checkPlayerCollision(pp) {
        const dist = Math.hypot(this.model.position.x - pp.x, this.model.position.z - pp.z);
        const collisionRadius = 2.2;

        if (dist < collisionRadius && dist > 0.01) {
            const now = performance.now();
            if (now - this.lastCollisionTime < this.collisionCooldown) return;
            this.lastCollisionTime = now;

            const dx = this.model.position.x - pp.x;
            const dz = this.model.position.z - pp.z;
            const len = dist;
            const nx = dx / len;
            const nz = dz / len;

            // Импульс: кто быстрее — тот сильнее толкает
            const botSpeed = Math.abs(this.velocity);
            const playerSpeed = Math.abs(this._playerVelocity || 0);
            const speedDiff = botSpeed - playerSpeed;

            const basePush = 1.5;
            const speedBonus = Math.max(-1, Math.min(1, speedDiff / 15));
            const pushForce = basePush + speedBonus * 0.8;

            // Отталкиваем бота
            this.model.position.x += nx * pushForce;
            this.model.position.z += nz * pushForce;

            // Боковое скольжение
            const sideX = -nz * 0.3 * Math.sign(speedDiff || 1);
            const sideZ = nx * 0.3 * Math.sign(speedDiff || 1);
            this.model.position.x += sideX;
            this.model.position.z += sideZ;

            // Потеря скорости
            this.velocity *= 0.55 + (speedBonus > 0 ? 0.1 : 0);
        }
    }

    /* ═══════ БУСТЕРЫ / ТРАМПЛИНЫ ═══════ */

    _checkPickups() {
        const px = this.model.position.x, pz = this.model.position.z, now = performance.now();
        for (const b of this.boosters) {
            if (Math.hypot(px - b.x, pz - b.z) < b.radius && now - this.lastBoosterTime > 800) {
                this.velocity = Math.min(this.velocity + b.boost, this.maxSpeed * 1.5);
                this.lastBoosterTime = now;
            }
        }
        for (const r of this.ramps) {
            if (Math.hypot(px - r.x, pz - r.z) < r.radius && this.isGrounded && now - this.lastRampTime > 1500) {
                this.yVelocity = r.force;
                this.isGrounded = false;
                this.lastRampTime = now;
            }
        }
    }

    /* ═══════ ЗОНЫ ТРАССЫ ═══════ */

    _checkZones() {
        const px = this.model.position.x, pz = this.model.position.z;
        let ng = 1.0, ns = 1.0;
        for (const s of this.slowdowns) {
            if (Math.hypot(px - s.x, pz - s.z) < s.radius) ns = Math.min(ns, s.factor);
        }
        for (const s of this.slipperyZones) {
            if (Math.hypot(px - s.x, pz - s.z) < s.radius) ng = Math.min(ng, 0.3);
        }
        this.targetGrip = ng;
        this.targetSpeedMul = ns;
        this.currentGrip = THREE.MathUtils.lerp(this.currentGrip, this.targetGrip, 0.1);
        this.currentSpeedMul = THREE.MathUtils.lerp(this.currentSpeedMul, this.targetSpeedMul, 0.1);

        for (const o of this.obstacles) {
            const dist = Math.hypot(px - o.x, pz - o.z);
            if (dist < o.radius + 0.8) {
                this.model.position.copy(this.lastPosition);
                this.velocity *= 0.4;
                const dx = px - o.x, dz = pz - o.z, len = Math.hypot(dx, dz) || 1;
                this.model.position.x += (dx / len) * 0.5;
                this.model.position.z += (dz / len) * 0.5;
            }
        }
    }

    /* ═══════ API ДЛЯ RACEMANAGER ═══════ */

    getPosition() { return this.model.position; }
    checkCheckpoint(cp) {
        return Math.hypot(this.model.position.x - cp.x, this.model.position.z - cp.z) <= cp.radius;
    }
    checkFinish(fp, r) {
        return Math.hypot(this.model.position.x - fp.x, this.model.position.z - fp.z) <= r;
    }
    markFinished(t) { this.finished = true; }
}