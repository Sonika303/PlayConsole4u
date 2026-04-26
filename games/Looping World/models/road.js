import * as THREE from 'three';

export function createRoad(scene, x, z) {
    const roadGroup = new THREE.Group();

    // Asphalt
    const roadGeo = new THREE.PlaneGeometry(20, 60);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01; // Tiny bit above 0 to prevent flickering
    roadGroup.add(road);

    // Yellow Lines
    const lineGeo = new THREE.PlaneGeometry(0.5, 5);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
    
    for(let i = 0; i < 6; i++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, -25 + (i * 10));
        roadGroup.add(line);
    }

    // Sidewalks
    const curbGeo = new THREE.BoxGeometry(5, 0.5, 60);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-12.5, 0.25, 0);
    roadGroup.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(12.5, 0.25, 0);
    roadGroup.add(rightCurb);

    roadGroup.position.set(x, 0, z);
    scene.add(roadGroup);
}