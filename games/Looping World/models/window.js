import * as THREE from 'three';

export function createWindow(parentGroup, x, y, z, rotationY = 0) {
    const winGeo = new THREE.BoxGeometry(2.5, 3.5, 0.2);
    const winMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ccff, 
        transparent: true, 
        opacity: 0.5, 
        metalness: 0.6,
        roughness: 0.1
    });
    
    const window = new THREE.Mesh(winGeo, winMat);
    window.position.set(x, y, z);
    window.rotation.y = rotationY;
    parentGroup.add(window);

    // Simple black frame
    const frameGeo = new THREE.BoxGeometry(2.7, 3.7, 0.1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(x, y, z - 0.05);
    frame.rotation.y = rotationY;
    parentGroup.add(frame);
}