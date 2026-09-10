import * as THREE from 'three';

export class TrackBuilder {
    constructor(scene, trackType = 'l-shape') {
        this.scene = scene;
        this.trackType = trackType;
        this.trackWidth = 10;
        this.segLen = 100;

        this.checkpoints = [];
        this.boosters = [];
        this.ramps = [];
        this.bounds = [];
        this.aiWaypoints = [];
        this.obstacles = [];
        this.slowdowns = [];
        this.slipperyZones = [];
        this.startPos = { x: 0, y: 0.5, z: 5 };
        this.startRotation = Math.PI;
    }

    build() {
        this.buildGround();
        switch (this.trackType) {
            case 'straight':  this._buildStraight();  break;
            case 'l-shape':   this._buildLShape();    break;
            case 'complex':   this._buildComplex();   break;
            case 'circular':  this._buildCircular();  break;
        }
        this.buildDecorations();
        return {
            checkpoints: this.checkpoints,
            boosters: this.boosters,
            ramps: this.ramps,
            bounds: this.bounds,
            aiWaypoints: this.aiWaypoints,
            obstacles: this.obstacles,
            slowdowns: this.slowdowns,
            slipperyZones: this.slipperyZones,
            startPos: this.startPos,
            startRotation: this.startRotation
        };
    }

    /* ═══════ ТРАССЫ ═══════ */

    _buildStraight() {
        this._straight(0, 0, 0, this.segLen);
        this._startLine(0, 0);
        this._finishLine(0, -this.segLen);
        this._barriersStraight(0, 0, -this.segLen, 0);
        this.bounds.push({ type: 'straight', x1: 0, z1: 5, x2: 0, z2: -this.segLen - 5, width: this.trackWidth });
        for (let z = 0; z >= -this.segLen; z -= 15) this.aiWaypoints.push({ x: 0, z });

                this.boosters.push({ x: 0, z: -50, radius: 4, boost: 15 });   // было 12
        this.ramps.push({ x: 0, z: -75, radius: 3, force: 16 });      // было 14
        this.obstacles.push({ x: -2.5, z: -30, radius: 1.2 }, { x: 2.5, z: -65, radius: 1.2 });
        this.slowdowns.push({ x: 0, z: -85, radius: 4, factor: 0.65 }); // было 0.5
        this.slipperyZones.push({ x: 0, z: -20, radius: 3.5 });

        this._boosterMesh(0, -50, Math.PI);
        this._rampMesh(0, -75, 0);
        this._renderObstacles();
        this._renderSlowdowns();
        this._renderSlippery();
    }

    _buildLShape() {
        this._straight(0, 0, 0, this.segLen);
        this._turn(0, -this.segLen, Math.PI / 2);
        this._straight(0, -this.segLen, Math.PI / 2, this.segLen);
        this._startLine(0, 0);
        this._finishLine(50, -this.segLen, Math.PI / 2);
        this._barriersStraight(0, 0, -this.segLen, 0);
        this._barriersStraight(0, -this.segLen, 100, Math.PI / 2);

        // ИСПРАВЛЕНО: outerRadius увеличен с +2 до +4
        this.bounds.push(
            { type: 'straight', x1: 0, z1: 5, x2: 0, z2: -this.segLen, width: this.trackWidth },
            { type: 'straight', x1: 0, z1: -this.segLen, x2: 100, z2: -this.segLen, width: this.trackWidth },
            { type: 'circle', cx: 0, cz: -this.segLen, innerRadius: 0, outerRadius: this.trackWidth / 2 + 4 }
        );

        this.checkpoints.push({ x: 0, z: -100, radius: 10 });
        for (let z = 0; z >= -this.segLen; z -= 15) this.aiWaypoints.push({ x: 0, z });
        this.aiWaypoints.push({ x: 0, z: -this.segLen });
        for (let x = 15; x <= 100; x += 15) this.aiWaypoints.push({ x, z: -this.segLen });

                this.boosters.push({ x: 0, z: -40, radius: 4, boost: 15 }, { x: 40, z: -100, radius: 4, boost: 15 }); // было 12
        this.ramps.push({ x: 0, z: -80, radius: 3, force: 16 }); // было 14
        this.obstacles.push({ x: 2, z: -50, radius: 1.2 }, { x: 60, z: -102, radius: 1.2 });
        this.slowdowns.push({ x: 0, z: -100, radius: 5, factor: 0.7 }, { x: 80, z: -100, radius: 4, factor: 0.65 }); // было 0.55 и 0.5
        this.slipperyZones.push({ x: 30, z: -100, radius: 4 });

        this._boosterMesh(0, -40, Math.PI);
        this._boosterMesh(40, -100, Math.PI / 2);
        this._rampMesh(0, -80, 0);
        this._renderObstacles();
        this._renderSlowdowns();
        this._renderSlippery();
    }

    _buildComplex() {
        this._straight(0, 0, 0, this.segLen);
        this._turn(0, -this.segLen, Math.PI / 2);
        this._straight(0, -this.segLen, Math.PI / 2, 50);
        this._turn(50, -this.segLen, Math.PI / 2);
        this._straight(50, -this.segLen, 0, this.segLen);
        this._startLine(0, 0);
        this._finishLine(50, -200);
        this._barriersStraight(0, 0, -this.segLen, 0);
        this._barriersStraight(0, -this.segLen, 50, Math.PI / 2);
        this._barriersStraight(50, -this.segLen, -this.segLen, 0);

        // ИСПРАВЛЕНО: outerRadius увеличен с +2 до +4 на обоих поворотах
        this.bounds.push(
            { type: 'straight', x1: 0, z1: 5, x2: 0, z2: -this.segLen, width: this.trackWidth },
            { type: 'straight', x1: 0, z1: -this.segLen, x2: 50, z2: -this.segLen, width: this.trackWidth },
            { type: 'straight', x1: 50, z1: -this.segLen, x2: 50, z2: -200, width: this.trackWidth },
            { type: 'circle', cx: 0, cz: -this.segLen, innerRadius: 0, outerRadius: this.trackWidth / 2 + 4 },
            { type: 'circle', cx: 50, cz: -this.segLen, innerRadius: 0, outerRadius: this.trackWidth / 2 + 4 }
        );

        this.checkpoints.push({ x: 0, z: -100, radius: 10 }, { x: 50, z: -100, radius: 10 });
        for (let z = 0; z >= -this.segLen; z -= 15) this.aiWaypoints.push({ x: 0, z });
        this.aiWaypoints.push({ x: 0, z: -this.segLen });
        for (let x = 15; x <= 50; x += 15) this.aiWaypoints.push({ x, z: -this.segLen });
        this.aiWaypoints.push({ x: 50, z: -this.segLen });
        for (let z = -this.segLen - 15; z >= -200; z -= 15) this.aiWaypoints.push({ x: 50, z });

        this.boosters.push({ x: 0, z: -40, radius: 4, boost: 15 }, { x: 25, z: -100, radius: 4, boost: 15 }, { x: 50, z: -150, radius: 4, boost: 15 }); // было 12
        this.ramps.push({ x: 0, z: -80, radius: 3, force: 16 }, { x: 50, z: -180, radius: 3, force: 16 }); // было 14
        this.obstacles.push({ x: -2, z: -60, radius: 1.2 }, { x: 25, z: -98, radius: 1.2 }, { x: 52, z: -170, radius: 1.2 });
        this.slowdowns.push({ x: 0, z: -100, radius: 5, factor: 0.7 }, { x: 50, z: -100, radius: 5, factor: 0.7 }); // было 0.55
        this.slipperyZones.push({ x: 0, z: -30, radius: 3 }, { x: 50, z: -130, radius: 3.5 });

        this._boosterMesh(0, -40, Math.PI);
        this._boosterMesh(25, -100, Math.PI / 2);
        this._boosterMesh(50, -150, Math.PI);
        this._rampMesh(0, -80, 0);
        this._rampMesh(50, -180, 0);
        this._renderObstacles();
        this._renderSlowdowns();
        this._renderSlippery();
    }

    _buildCircular() {
        const cx = -60, cz = -60, R = 60, W = this.trackWidth;
        const road = new THREE.Mesh(
            new THREE.RingGeometry(R - W / 2, R + W / 2, 96),
            new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide })
        );
        road.rotation.x = -Math.PI / 2;
        road.position.set(cx, 0.005, cz);
        road.receiveShadow = true;
        this.scene.add(road);

        this._circleLine(cx, cz, R - W / 2 + 0.5, 0xffffff);
        this._circleLine(cx, cz, R + W / 2 - 0.5, 0xffffff);
        this._circleDashed(cx, cz, R, 0xffff00);

        this.startPos = { x: 0, y: 0.5, z: -50 };
        this.startRotation = Math.PI;
        this._startLine(0, -50);
        this._finishLine(0, -60);

        this.checkpoints.push(
            { x: cx, z: cz - R, radius: 12 },
            { x: cx - R, z: cz, radius: 12 },
            { x: cx, z: cz + R, radius: 12 }
        );
        this.bounds.push({ type: 'circular', cx, cz, innerRadius: R - W / 2, outerRadius: R + W / 2 });

        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            for (const r of [R - W / 2 - 0.8, R + W / 2 + 0.8]) {
                const b = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 1, 2.5),
                    new THREE.MeshStandardMaterial({ color: 0xff0000 })
                );
                b.position.set(cx + Math.cos(a) * r, 0.5, cz - Math.sin(a) * r);
                b.rotation.y = a; b.castShadow = true;
                this.scene.add(b);
            }
        }

        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            this.aiWaypoints.push({ x: cx + Math.cos(a) * R, z: cz - Math.sin(a) * R });
        }

               [Math.PI / 4, Math.PI, Math.PI * 7 / 4].forEach(a => {
            const bx = cx + Math.cos(a) * R, bz = cz - Math.sin(a) * R;
            this.boosters.push({ x: bx, z: bz, radius: 4, boost: 16 }); // было 14
            this._boosterMesh(bx, bz, Math.PI - a);
        });
        [Math.PI / 2, Math.PI * 3 / 2].forEach(a => {
            const rx = cx + Math.cos(a) * R, rz = cz - Math.sin(a) * R;
            this.ramps.push({ x: rx, z: rz, radius: 4, force: 17 }); // было 15
            this._rampMesh(rx, rz, Math.PI - a);
        });

        [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 4 / 3].forEach(a => {
            this.obstacles.push({ x: cx + Math.cos(a) * (R + 2), z: cz - Math.sin(a) * (R + 2), radius: 1.3 });
        });
        [Math.PI / 3, Math.PI * 7 / 6].forEach(a => {
            this.slowdowns.push({ x: cx + Math.cos(a) * R, z: cz - Math.sin(a) * R, radius: 4, factor: 0.65 }); // было 0.5
        });
        [Math.PI * 2 / 3, Math.PI * 5 / 3].forEach(a => {
            this.slipperyZones.push({ x: cx + Math.cos(a) * R, z: cz - Math.sin(a) * R, radius: 4 });
        });

        this._renderObstacles();
        this._renderSlowdowns();
        this._renderSlippery();
    }

    /* ═══════ ПРИМИТИВЫ ═══════ */

    buildGround() {
        const g = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: 0x3a5f0b })
        );
        g.rotation.x = -Math.PI / 2; g.position.y = -0.02; g.receiveShadow = true;
        this.scene.add(g);
    }

    _straight(sx, sz, rot, len) {
        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(this.trackWidth, len),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        road.rotation.x = -Math.PI / 2; road.rotation.z = rot;
        if (rot === 0) road.position.set(sx, 0.005, sz - len / 2);
        else road.position.set(sx + len / 2, 0.005, sz);
        road.receiveShadow = true; this.scene.add(road);
        this._laneMarkings(sx, sz, rot, len);
    }

    _laneMarkings(sx, sz, rot, len) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        for (const s of [-1, 1]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, len), mat);
            m.rotation.x = -Math.PI / 2;
            if (rot === 0) m.position.set(sx + s * (this.trackWidth / 2 - 0.5), 0.015, sz - len / 2);
            else { m.rotation.z = Math.PI / 2; m.position.set(sx + len / 2, 0.015, sz + s * (this.trackWidth / 2 - 0.5)); }
            this.scene.add(m);
        }
        const dLen = 2, gap = 2, n = Math.floor(len / (dLen + gap));
        for (let i = 0; i < n; i++) {
            const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, dLen), mat);
            d.rotation.x = -Math.PI / 2;
            const off = i * (dLen + gap) + dLen / 2;
            if (rot === 0) d.position.set(sx, 0.015, sz - off);
            else { d.rotation.z = Math.PI / 2; d.position.set(sx + off, 0.015, sz); }
            this.scene.add(d);
        }
    }

    _turn(cx, cz, angle) {
        const r = this.trackWidth / 2;
        const t = new THREE.Mesh(
            new THREE.RingGeometry(r - 0.5, r + 0.5, 32, 1, 0, angle),
            new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide })
        );
        t.rotation.x = -Math.PI / 2; t.rotation.z = -angle;
        t.position.set(cx, 0.005, cz); t.receiveShadow = true;
        this.scene.add(t);
    }

    _circleLine(cx, cz, r, color) {
        const pts = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0.015, cz - Math.sin(a) * r));
        }
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })));
    }

    _circleDashed(cx, cz, r, color) {
        const mat = new THREE.LineBasicMaterial({ color });
        for (let a = 0; a < Math.PI * 2; a += 0.16) {
            const pts = [];
            for (let t = 0; t <= 0.08; t += 0.02) {
                const ang = a + t;
                pts.push(new THREE.Vector3(cx + Math.cos(ang) * r, 0.015, cz - Math.sin(ang) * r));
            }
            this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        }
    }

    _startLine(x, z, rot = 0) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.025, z);
        this.scene.add(m);
    }

    _finishLine(x, z, rot = 0) {
        const m = this._checkerMesh(this.trackWidth, 2);
        m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.025, z);
        this.scene.add(m);
    }

    _checkerMesh(w, h) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 64;
        const ctx = c.getContext('2d'); const s = 32;
        for (let y = 0; y < 64; y += s)
            for (let x = 0; x < 256; x += s) {
                ctx.fillStyle = ((x / s + y / s) % 2 === 0) ? '#000' : '#fff';
                ctx.fillRect(x, y, s, s);
            }
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) }));
    }

    _barriersStraight(sx, sz, endVal, rot) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const geo = new THREE.BoxGeometry(0.5, 1, 2);
        const start = rot === 0 ? sz : sx;
        const step = start < endVal ? 4 : -4;
        for (let v = start; step > 0 ? v > endVal : v < endVal; v += step) {
            for (const s of [-1, 1]) {
                const b = new THREE.Mesh(geo, mat);
                if (rot === 0) b.position.set(sx + s * (this.trackWidth / 2 + 0.5), 0.5, v);
                else { b.rotation.y = Math.PI / 2; b.position.set(v, 0.5, sz + s * (this.trackWidth / 2 + 0.5)); }
                b.castShadow = true; this.scene.add(b);
            }
        }
    }

    /* ═══════ БУСТЕРЫ / ТРАМПЛИНЫ ═══════ */

    _boosterMesh(x, z, rotY = 0) {
        const g = new THREE.Group();

        const pad = new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.1, 3),
            new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.5 })
        );
        pad.position.set(0, 0.06, 0);
        g.add(pad);

        const shape = new THREE.Shape();
        shape.moveTo(0, 1.2); shape.lineTo(0.8, 0); shape.lineTo(0.3, 0);
        shape.lineTo(0.3, -1.2); shape.lineTo(-0.3, -1.2); shape.lineTo(-0.3, 0);
        shape.lineTo(-0.8, 0); shape.closePath();
        const arrow = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
        );
        arrow.rotation.x = -Math.PI / 2;
        arrow.rotation.z = Math.PI;
        arrow.position.set(0, 0.12, 0);
        g.add(arrow);

        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        this.scene.add(g);
    }

    _rampMesh(x, z, rotY = 0) {
        const g = new THREE.Group();
        const ramp = new THREE.Mesh(
            new THREE.BoxGeometry(5, 0.4, 6),
            new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.2 })
        );
        ramp.rotation.x = -0.18; ramp.position.y = 0.5; ramp.castShadow = true; g.add(ramp);
        for (let i = -2; i <= 2; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xffff00 }));
            s.position.set(0, 0.75, i * 1.2); s.rotation.x = -0.18; g.add(s);
        }
        g.position.set(x, 0, z); g.rotation.y = rotY;
        this.scene.add(g);
    }

    /* ═══════ ЗОНЫ ═══════ */

    _renderObstacles() {
        const geo = new THREE.CylinderGeometry(0.8, 0.8, 1.6, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x440000, emissiveIntensity: 0.2 });
        const sMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        for (const o of this.obstacles) {
            const g = new THREE.Group();
            const barrel = new THREE.Mesh(geo, mat); barrel.position.y = 0.8; barrel.castShadow = true; g.add(barrel);
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.2, 16), sMat);
            stripe.position.y = 0.8; g.add(stripe);
            g.position.set(o.x, 0, o.z); this.scene.add(g);
        }
    }

    _renderSlowdowns() {
        for (const s of this.slowdowns) {
            const mesh = new THREE.Mesh(
                new THREE.CircleGeometry(s.radius, 32),
                new THREE.MeshStandardMaterial({ color: 0xc2a060, transparent: true, opacity: 0.85 })
            );
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(s.x, 0.03, s.z);
            this.scene.add(mesh);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a });
            for (let i = 0; i < 15; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * s.radius * 0.9;
                const dot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 6), dotMat);
                dot.rotation.x = -Math.PI / 2;
                dot.position.set(s.x + Math.cos(a) * r, 0.035, s.z + Math.sin(a) * r);
                this.scene.add(dot);
            }
        }
    }

    _renderSlippery() {
        for (const s of this.slipperyZones) {
            const mesh = new THREE.Mesh(
                new THREE.CircleGeometry(s.radius, 32),
                new THREE.MeshStandardMaterial({ color: 0x4488cc, transparent: true, opacity: 0.5, emissive: 0x224466, emissiveIntensity: 0.3 })
            );
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(s.x, 0.032, s.z);
            this.scene.add(mesh);
            const star = new THREE.Mesh(
                new THREE.CircleGeometry(0.3, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
            );
            star.rotation.x = -Math.PI / 2; star.rotation.z = Math.PI / 4;
            star.position.set(s.x, 0.04, s.z); this.scene.add(star);
        }
    }

    /* ═══════ ДЕКОР ═══════ */

    buildDecorations() {
        if (this.trackType === 'l-shape' || this.trackType === 'complex') this._coneCluster(0, -this.segLen);
        if (this.trackType === 'complex') this._coneCluster(50, -this.segLen);
        if (this.trackType !== 'circular') {
            const pMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const fMat = new THREE.MeshStandardMaterial({ color: 0x00cc44, side: THREE.DoubleSide });
            const pGeo = new THREE.CylinderGeometry(0.05, 0.05, 3);
            const fGeo = new THREE.PlaneGeometry(1, 0.5);
            for (let z = -10; z > -this.segLen; z -= 25) {
                for (const s of [-1, 1]) {
                    const px = s * (this.trackWidth / 2 + 2);
                    const pole = new THREE.Mesh(pGeo, pMat); pole.position.set(px, 1.5, z); pole.castShadow = true; this.scene.add(pole);
                    const flag = new THREE.Mesh(fGeo, fMat); flag.position.set(px + 0.5, 2.75, z); this.scene.add(flag);
                }
            }
        }
    }

    _coneCluster(cx, cz) {
        const geo = new THREE.ConeGeometry(0.3, 1, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * (Math.PI / 2), r = this.trackWidth / 2 + 1.5;
            const c = new THREE.Mesh(geo, mat);
            c.position.set(cx + Math.cos(a) * r, 0.5, cz - Math.sin(a) * r);
            c.castShadow = true; this.scene.add(c);
        }
    }
}