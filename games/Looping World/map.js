import * as THREE from 'three';
import { createSkyscraper } from './models/skyscraper.js';
import { createRoad } from './models/road.js';
import { createCar, updateCarsRect, carObjects } from './models/car.js';

export function initMap(scene) {
    // 1. Create a massive floor so you never see the "Blue Void" under your feet
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1; // Just below the road
    scene.add(ground);

    // 2. The 2-over-2 Road Layout
    // Top Roads
    createRoad(scene, -30, 30, 0); 
    createRoad(scene, 30, 30, 0);
    
    // Bottom Roads
    createRoad(scene, -30, -30, 0);
    createRoad(scene, 30, -30, 0);

    // 3. Side connectors
    createRoad(scene, -40, 0, Math.PI/2);
    createRoad(scene, 40, 0, Math.PI/2);

    // 4. THE CENTER SKYSCRAPER (Big and Grey)
    createSkyscraper(scene, 0, 0, 120);

    // 5. Cars
    for(let i = 0; i < 4; i++) {
        createCar(scene, i); 
    }
}

export function updateMap() {
    updateCarsRect();
}

export function checkCarCollisions(playerPos) {
    for (let car of carObjects) {
        if (playerPos.distanceTo(car.position) < 5) return true;
    }
    return false;
}