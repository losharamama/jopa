import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Loader {
    constructor() {
        this.gltfLoader = new GLTFLoader();
    }
    loadGLB(url) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(url, resolve, undefined, err => {
                console.warn(`Не удалось загрузить ${url}`, err);
                reject(err);
            });
        });
    }
}