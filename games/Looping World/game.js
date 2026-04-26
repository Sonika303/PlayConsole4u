import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { initMap, updateMap, checkCarCollisions } from './map.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // The Blue you are seeing

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
const spawnPos = new THREE.Vector3(0, 5, 60); // Start way back so you can see the building
camera.position.copy(spawnPos);
camera.lookAt(0, 5, 0); // Force the camera to look at the center building

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

initMap(scene);

const controls = new PointerLockControls(camera, document.body);
document.addEventListener('click', () => controls.lock());

let move = { f: false, b: false, l: false, r: false };
const velocity = new THREE.Vector3();

// Input listeners (same as before)
window.onkeydown = (e) => { if(e.code==='KeyW') move.f=true; if(e.code==='KeyS') move.b=true; if(e.code==='KeyA') move.l=true; if(e.code==='KeyD') move.r=true; };
window.onkeyup = (e) => { if(e.code==='KeyW') move.f=false; if(e.code==='KeyS') move.b=false; if(e.code==='KeyA') move.l=false; if(e.code==='KeyD') move.r=false; };

function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const delta = 0.016;
        velocity.multiplyScalar(0.9);
        if (move.f) velocity.z -= 400 * delta;
        if (move.b) velocity.z += 400 * delta;
        if (move.l) velocity.x -= 400 * delta;
        if (move.r) velocity.x += 400 * delta;

        controls.moveRight(velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        
        if (checkCarCollisions(camera.position)) {
            camera.position.copy(spawnPos);
        }
        updateMap();
    }
    renderer.render(scene, camera);
}
animate();