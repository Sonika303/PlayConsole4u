import * as THREE from 'three';
import { createWindow } from './window.js';

export function createSkyscraper(scene, x, z, height) {
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(25, height, 25),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    body.position.set(x, height / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    // Windows on all sides
    for (let y = 10; y < height - 10; y += 10) {
        createWindow(body, 0, y - height/2, 12.6, 0); 
        createWindow(body, 0, y - height/2, -12.6, 0);
        createWindow(body, 12.6, y - height/2, 0, Math.PI/2);
        createWindow(body, -12.6, y - height/2, 0, Math.PI/2);
    }
}