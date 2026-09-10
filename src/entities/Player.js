import * as THREE from 'three';
import { WheelchairPhysics } from '../physics/Wheelchair.js';
import { Loader } from '../core/Loader.js';

export class Player {
    constructor(scene, input) {
        this.scene = scene;
        this.input = input;
        this.physics = new WheelchairPhysics();
        this.model = null;
        this.wheels = [];
        this.loader = new Loader();
        this.isPlaceholder = true;

        this.baseY = 0.5;
        this.yVelocity = 0;
        this.isGrounded = true;
        this.gravity = -35;

        this.boosters = [];
        this.ramps = [];
        this.obstacles = [];
        this.slowdowns = [];
        this.slipperyZones = [];
        this.lastBoosterTime = 0;
        this.lastRampTime = 0;
        this.boostCooldown = 800;
        this.rampCooldown = 1500;

        this.tiltX = 0;
        this.trackBounds = null;
        this.lastPosition = new THREE.Vector3();

        this.aiRacer = null;
        this.lastCollisionTime = 0;
        this.collisionCooldown = 300;

        this.driftTrails = [];
        this.trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333, transparent: true, opacity: 0.6
        });
    }

    async init() {
        try {
            const data = await this.loader.loadGLB('assets/models/wheelchair.glb');
            this.model = data.scene;
            this.isPlaceholder = false;
            this.model.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    if (c.name.startsWith('wheel_')) this.wheels.push(c);
                }
            });
            this.scene.add(this.model);
        } catch {
            this.model = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 1.5, 2.5),
                new THREE.MeshStandardMaterial({ color: 0xff3333 })
            );
            this.model.castShadow = true;
            this.scene.add(this.model);
        }
    }

    setTrackData(data) {
        this.boosters = data.boosters || [];
        this.ramps = data.ramps || [];
        this.trackBounds = data.bounds || null;
        this.obstacles = data.obstacles || [];
        this.slowdowns = data.slowdowns || [];
        this.slipperyZones = data.slipperyZones || [];
    }

    setAIRacer(ai) {
        this.aiRacer = ai;
    }

    setPosition(x, y, z) {
        this.model.position.set(x, y, z);
        this.baseY = y;
        this.lastPosition.copy(this.model.position);
    }

    setRotation(rad) { this.physics.rotation = rad; }

    update(dt, canMove = true) {
        this.lastPosition.copy(this.model.position);

        if (!canMove) {
            this.physics.velocity *= 0.90;
            if (Math.abs(this.physics.velocity) < 0.1) this.physics.velocity = 0;
        } else {
            this.physics.update(dt, this.input);
        }

        const sinR = Math.sin(this.physics.rotation);
        const cosR = Math.cos(this.physics.rotation);
        this.model.position.x += sinR * this.physics.velocity * dt;
        this.model.position.z += cosR * this.physics.velocity * dt;
        this.model.rotation.y = this.physics.rotation;

        if (this.trackBounds && canMove) this._checkBounds();

        if (canMove && this.aiRacer) this._checkBotCollision();

        const targetRoll = this.physics.isDrifting ? this.physics.driftDirection * 0.3 : 0;
        this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, targetRoll, 0.15);

        if (this.physics.isDrifting && this.isGrounded) this._addDriftTrail();

        if (!this.isGrounded) {
            this.yVelocity += this.gravity * dt;
            this.model.position.y += this.yVelocity * dt;
            this.tiltX = THREE.MathUtils.lerp(this.tiltX, this.yVelocity * 0.015, 0.1);
            this.model.rotation.x = this.tiltX;
            if (this.model.position.y <= this.baseY) {
                this.model.position.y = this.baseY;
                this.yVelocity = 0;
                this.isGrounded = true;
                this.tiltX = 0;
                this.model.rotation.x = 0;
            }
        }

        if (!this.isPlaceholder && this.wheels.length > 0) {
            const wr = this.physics.velocity * dt * 3;
            this.wheels.forEach(w => { w.rotation.x += wr; });
        }

        if (canMove) {
            this._checkPickups();
            this._checkZones();
        } else {
            this.physics.targetGrip = 1.0;
            this.physics.targetSpeedMultiplier = 1.0;
        }
    }

    /* ═══════ ГРАНИЦЫ ТРАССЫ (ИСПРАВЛЕНО) ═══════ */

    _checkBounds() {
        const pos = this.model.position;
        const buffer = 1.5; // Буферная зона (допуск)

        for (const b of this.trackBounds) {
            let outOfBounds = false;

            if (b.type === 'straight') {
                const dx = b.x2 - b.x1, dz = b.z2 - b.z1;
                const len = Math.hypot(dx, dz);
                if (len === 0) continue;

                const tx = dx / len, tz = dz / len;
                const nx = -tz, nz = tx;

                const px = pos.x - b.x1, pz = pos.z - b.z1;
                const along = px * tx + pz * tz;
                const across = px * nx + pz * nz;

                // Проверяем только если игрок в зоне прямого участка (с буфером)
                if (along >= -buffer && along <= len + buffer) {
                    if (Math.abs(across) > b.width / 2 + buffer) {
                        outOfBounds = true;
                    }
                }
            } else if (b.type === 'circular') {
                // Кольцевая трасса
                const dist = Math.hypot(pos.x - b.cx, pos.z - b.cz);
                if (dist < b.innerRadius - buffer || dist > b.outerRadius + buffer) {
                    outOfBounds = true;
                }
            } else if (b.type === 'circle') {
                // Зона поворота — проверяем только если игрок рядом
                const dist = Math.hypot(pos.x - b.cx, pos.z - b.cz);
                if (dist < b.outerRadius * 2 && dist > b.outerRadius + buffer) {
                    outOfBounds = true;
                }
            }

            if (outOfBounds) {
                // Мягкий откат: не полностью блокируем, а замедляем
                const pushBack = 0.3;
                const dx = pos.x - this.lastPosition.x;
                const dz = pos.z - this.lastPosition.z;
                pos.x -= dx * pushBack;
                pos.z -= dz * pushBack;
                this.physics.velocity *= 0.7; // Мягкое замедление
                return;
            }
        }
    }

    /* ═══════ КОЛЛИЗИЯ С БОТОМ ═══════ */

    _checkBotCollision() {
        if (!this.aiRacer) return;
        const botPos = this.aiRacer.getPosition();
        const px = this.model.position.x;
        const pz = this.model.position.z;
        const dx = px - botPos.x;
        const dz = pz - botPos.z;
        const dist = Math.hypot(dx, dz);
        const collisionRadius = 2.2;

        if (dist < collisionRadius && dist > 0.01) {
            const now = performance.now();
            if (now - this.lastCollisionTime < this.collisionCooldown) return;
            this.lastCollisionTime = now;

            const nx = dx / dist;
            const nz = dz / dist;

            const playerSpeed = Math.abs(this.physics.velocity);
            const botSpeed = Math.abs(this.aiRacer.velocity);
            const speedDiff = playerSpeed - botSpeed;

            const basePush = 1.5;
            const speedBonus = Math.max(-1, Math.min(1, speedDiff / 15));
            const pushForce = basePush + speedBonus * 0.8;

            this.model.position.x += nx * pushForce;
            this.model.position.z += nz * pushForce;

            this.aiRacer.model.position.x -= nx * pushForce;
            this.aiRacer.model.position.z -= nz * pushForce;

            const playerLoss = 0.55 + (speedBonus > 0 ? 0.1 : 0);
            const botLoss = 0.55 + (speedBonus < 0 ? 0.1 : 0);
            this.physics.velocity *= playerLoss;
            this.aiRacer.velocity *= botLoss;

            const sideX = -nz * 0.3 * Math.sign(speedDiff || 1);
            const sideZ = nx * 0.3 * Math.sign(speedDiff || 1);
            this.model.position.x += sideX;
            this.model.position.z += sideZ;

            this._showCollisionEffect(
                (px + botPos.x) / 2,
                (pz + botPos.z) / 2
            );
        }
    }

    _showCollisionEffect(x, z) {
        const flash = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 2.5, 16),
            new THREE.MeshBasicMaterial({
                color: 0xff4444,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            })
        );
        flash.rotation.x = -Math.PI / 2;
        flash.position.set(x, 0.15, z);
        this.scene.add(flash);

        let scale = 1;
        const animate = () => {
            scale += 0.15;
            flash.scale.set(scale, scale, 1);
            flash.material.opacity -= 0.06;
            if (flash.material.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }
        };
        animate();
    }

    /* ═══════ ЗОНЫ ТРАССЫ ═══════ */

    _checkZones() {
        const px = this.model.position.x, pz = this.model.position.z;
        let newGrip = 1.0, newSpeedMul = 1.0;

        for (const s of this.slowdowns) {
            if (Math.hypot(px - s.x, pz - s.z) < s.radius) newSpeedMul = Math.min(newSpeedMul, s.factor);
        }
        for (const s of this.slipperyZones) {
            if (Math.hypot(px - s.x, pz - s.z) < s.radius) newGrip = Math.min(newGrip, 0.3);
        }
        this.physics.targetGrip = newGrip;
        this.physics.targetSpeedMultiplier = newSpeedMul;

        for (const o of this.obstacles) {
            const dist = Math.hypot(px - o.x, pz - o.z);
            if (dist < o.radius + 0.8) {
                this.model.position.copy(this.lastPosition);
                this.physics.velocity *= 0.4;
                const dx = px - o.x, dz = pz - o.z, len = Math.hypot(dx, dz) || 1;
                this.model.position.x += (dx / len) * 0.5;
                this.model.position.z += (dz / len) * 0.5;
            }
        }
    }

    /* ═══════ БУСТЕРЫ / ТРАМПЛИНЫ ═══════ */

    _checkPickups() {
        const px = this.model.position.x, pz = this.model.position.z, now = performance.now();
        for (const b of this.boosters) {
            if (Math.hypot(px - b.x, pz - b.z) < b.radius && now - this.lastBoosterTime > this.boostCooldown) {
                if (this.physics.velocity >= 0)
                    this.physics.velocity = Math.min(this.physics.velocity + b.boost, this.physics.maxSpeed * 1.5);
                else
                    this.physics.velocity = Math.max(this.physics.velocity - b.boost, -this.physics.maxSpeed);
                this.lastBoosterTime = now;
                this._showBoostEffect(b.x, b.z);
            }
        }
        for (const r of this.ramps) {
            if (Math.hypot(px - r.x, pz - r.z) < r.radius && this.isGrounded && now - this.lastRampTime > this.rampCooldown) {
                this.yVelocity = r.force;
                this.isGrounded = false;
                this.lastRampTime = now;
            }
        }
    }

    _showBoostEffect(x, z) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 4, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.1, z);
        this.scene.add(ring);
        let scale = 1;
        const anim = () => {
            scale += 0.1;
            ring.scale.set(scale, scale, 1);
            ring.material.opacity -= 0.05;
            if (ring.material.opacity > 0) requestAnimationFrame(anim);
            else { this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }
        };
        anim();
    }

    /* ═══════ ДРИФТ ═══════ */

    _addDriftTrail() {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), this.trailMaterial);
        t.rotation.x = -Math.PI / 2;
        t.position.copy(this.model.position);
        t.position.y = 0.02;
        this.scene.add(t);
        this.driftTrails.push(t);
        if (this.driftTrails.length > 50) {
            const old = this.driftTrails.shift();
            this.scene.remove(old);
            old.geometry.dispose();
        }
    }

    /* ═══════ КАМЕРА ═══════ */

    updateCamera(camera) {
        const sinR = Math.sin(this.physics.rotation), cosR = Math.cos(this.physics.rotation);
        const sf = Math.abs(this.physics.velocity) / this.physics.maxSpeed;
        const dist = 8 + sf * 4;
        const target = this.model.position.clone().add(new THREE.Vector3(-sinR * dist, 4 + sf * 1.5, -cosR * dist));
        camera.position.lerp(target, 0.08);
        const la = 3 + sf * 2;
        camera.lookAt(this.model.position.clone().add(new THREE.Vector3(sinR * la, 1.5, cosR * la)));
    }
}