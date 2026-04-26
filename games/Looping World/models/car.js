import * as THREE from 'three';
import { createSkyscraper } from './models/skyscraper.js';
import { createRoad } from './models/road.js';
import { createCar, updateCarsRect, carObjects } from './models/car.js';

export function initMap(scene) {
    // 1. Two Top Roads
    createRoad(scene, -15, 30, 0); 
    createRoad(scene, 15, 30, 0);
    
    // 2. Two Bottom Roads
    createRoad(scene, -15, -30, 0);
    createRoad(scene, 15, -30, 0);

    // 3. Side Connecting Roads (To make the loop functional)
    createRoad(scene, -30, 0, Math.PI/2);
    createRoad(scene, 30, 0, Math.PI/2);

    // 4. THE CENTER SKYSCRAPER
    createSkyscraper(scene, 0, 0, 100);

    // 5. Spawn Cars in the Rectangular Circuit
    for(let i = 0; i < 4; i++) {
        createCar(scene, i); 
    }
}

export function checkCarCollisions(playerPos) {
    for (let car of carObjects) {
        if (playerPos.distanceTo(car.position) < 4.5) return true;
    }
    return false;
}

export function updateMap() {
    updateCarsRect();
}