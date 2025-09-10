// Test Characters for Tennis for 4
// This file provides test functions for character models and animations

// Function to create and test character models
function testCharacterModels() {
  console.log('Testing character models...');
  
  // Create test scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  
  // Create ground
  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Create team 1 character (orange)
  const team1Character = createDefaultCharacterModel(0);
  team1Character.position.set(-3, 0, 0);
  scene.add(team1Character);
  
  // Create team 2 character (blue)
  const team2Character = createDefaultCharacterModel(1);
  team2Character.position.set(3, 0, 0);
  scene.add(team2Character);
  
  // Animation loop
  let animationTime = 0;
  function animate() {
    requestAnimationFrame(animate);
    
    // Rotate characters slightly
    team1Character.rotation.y += 0.01;
    team2Character.rotation.y += 0.01;
    
    // Animate character arms
    animationTime += 0.05;
    
    // Team 1 character arm animation
    if (team1Character.userData && team1Character.userData.rig) {
      const rightArm = team1Character.userData.rig.bones.rightArm;
      if (rightArm) {
        rightArm.rotation.x = Math.sin(animationTime) * 0.5;
        rightArm.rotation.z = Math.cos(animationTime) * 0.3;
      }
    }
    
    // Team 2 character arm animation
    if (team2Character.userData && team2Character.userData.rig) {
      const rightArm = team2Character.userData.rig.bones.rightArm;
      if (rightArm) {
        rightArm.rotation.x = Math.sin(animationTime + Math.PI) * 0.5;
        rightArm.rotation.z = Math.cos(animationTime + Math.PI) * 0.3;
      }
    }
    
    renderer.render(scene, camera);
  }
  
  // Start animation
  animate();
  
  console.log('Character models test running...');
  return { scene, team1Character, team2Character };
}

// Function to create a default character model (copied from main.js)
function createDefaultCharacterModel(teamIndex) {
  // Team colors (alternating for players)
  const teamColors = [0xFF5722, 0x2196F3]; // Orange and Blue like Wii Sports
  const teamColor = teamColors[teamIndex];
  
  // Create a group to hold all character parts
  const characterGroup = new THREE.Group();
  
  // Create head (sphere)
  const headGeometry = new THREE.SphereGeometry(0.25);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFE0BD }); // Skin tone
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.5;
  head.castShadow = true;
  characterGroup.add(head);
  
  // Create eyes
  const eyeGeometry = new THREE.SphereGeometry(0.05);
  const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.1, 1.55, 0.2);
  characterGroup.add(leftEye);
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.1, 1.55, 0.2);
  characterGroup.add(rightEye);
  
  // Create mouth
  const mouthGeometry = new THREE.BoxGeometry(0.15, 0.03, 0.05);
  const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, 1.4, 0.2);
  characterGroup.add(mouth);
  
  // Create body
  const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.6);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: teamColor });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.0;
  body.castShadow = true;
  characterGroup.add(body);
  
  // Create arms - these will be our "bones" for rigging
  const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5);
  const armMaterial = new THREE.MeshLambertMaterial({ color: teamColor });
  
  // Left arm
  const leftArm = new THREE.Group();
  const leftArmMesh = new THREE.Mesh(armGeometry, armMaterial);
  leftArmMesh.rotation.z = Math.PI / 2;
  leftArmMesh.position.x = 0.25;
  leftArm.add(leftArmMesh);
  leftArm.position.set(-0.3, 1.2, 0);
  leftArm.castShadow = true;
  leftArm.name = 'leftArm'; // Name for rigging
  characterGroup.add(leftArm);
  
  // Right arm (racket arm)
  const rightArm = new THREE.Group();
  const rightArmMesh = new THREE.Mesh(armGeometry, armMaterial);
  rightArmMesh.rotation.z = Math.PI / 2;
  rightArmMesh.position.x = 0.25;
  rightArm.add(rightArmMesh);
  rightArm.position.set(0.3, 1.2, 0);
  rightArm.castShadow = true;
  rightArm.name = 'rightArm'; // Name for rigging
  characterGroup.add(rightArm);
  
  // Create legs
  const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.7);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.15, 0.35, 0);
  leftLeg.castShadow = true;
  leftLeg.name = 'leftLeg'; // Name for rigging
  characterGroup.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.15, 0.35, 0);
  rightLeg.castShadow = true;
  rightLeg.name = 'rightLeg'; // Name for rigging
  characterGroup.add(rightLeg);
  
  // Add rig data for animation
  characterGroup.userData = {
    rig: {
      bones: {
        head: head,
        leftArm: leftArm,
        rightArm: rightArm,
        leftLeg: leftLeg,
        rightLeg: rightLeg
      },
      restPose: {
        head: { position: new THREE.Vector3(head.position.x, head.position.y, head.position.z), rotation: new THREE.Euler(head.rotation.x, head.rotation.y, head.rotation.z) },
        leftArm: { position: new THREE.Vector3(leftArm.position.x, leftArm.position.y, leftArm.position.z), rotation: new THREE.Euler(leftArm.rotation.x, leftArm.rotation.y, leftArm.rotation.z) },
        rightArm: { position: new THREE.Vector3(rightArm.position.x, rightArm.position.y, rightArm.position.z), rotation: new THREE.Euler(rightArm.rotation.x, rightArm.rotation.y, rightArm.rotation.z) },
        leftLeg: { position: new THREE.Vector3(leftLeg.position.x, leftLeg.position.y, leftLeg.position.z), rotation: new THREE.Euler(leftLeg.rotation.x, leftLeg.rotation.y, leftLeg.rotation.z) },
        rightLeg: { position: new THREE.Vector3(rightLeg.position.x, rightLeg.position.y, rightLeg.position.z), rotation: new THREE.Euler(rightLeg.rotation.x, rightLeg.rotation.y, rightLeg.rotation.z) }
      },
      animations: {
        swinging: false,
        swingStartTime: 0,
        swingDuration: 300 // ms
      }
    }
  };
  
  return characterGroup;
}

// Function to test character animations
function testCharacterAnimations(character) {
  if (!character || !character.userData || !character.userData.rig) {
    console.error('Character does not have proper rigging');
    return;
  }
  
  console.log('Testing character animations...');
  
  // Test swing animation
  const rig = character.userData.rig;
  const rightArm = rig.bones.rightArm;
  
  if (!rightArm) {
    console.error('Right arm bone not found');
    return;
  }
  
  // Simulate a swing
  rig.animations.swinging = true;
  rig.animations.swingStartTime = Date.now();
  rig.animations.swingVelocity = 5;
  rig.animations.swingAngle = 45;
  
  // Initial swing position - arm goes back
  rightArm.rotation.x = -Math.PI / 4;
  rightArm.rotation.z = Math.PI / 3;
  
  // Animate the swing
  const animateSwing = () => {
    const now = Date.now();
    const elapsed = now - rig.animations.swingStartTime;
    const progress = Math.min(elapsed / rig.animations.swingDuration, 1);
    
    if (progress < 1) {
      // Swing forward animation
      const swingPower = rig.animations.swingVelocity / 10;
      rightArm.rotation.x = -Math.PI / 4 + progress * Math.PI / 2 * swingPower;
      rightArm.rotation.z = Math.PI / 3 - progress * Math.PI / 2;
      
      // Also animate the head to look at the ball
      if (rig.bones.head) {
        rig.bones.head.rotation.x = Math.sin(progress * Math.PI) * 0.2;
      }
      
      requestAnimationFrame(animateSwing);
    } else {
      // Reset to rest pose
      if (rig.restPose.rightArm) {
        rightArm.rotation.copy(rig.restPose.rightArm.rotation);
      } else {
        rightArm.rotation.set(0, 0, 0);
      }
      
      if (rig.bones.head && rig.restPose.head) {
        rig.bones.head.rotation.copy(rig.restPose.head.rotation);
      }
      
      rig.animations.swinging = false;
      console.log('Swing animation complete');
    }
  };
  
  animateSwing();
}

// Export functions for use in the browser console
window.testCharacters = {
  testModels: testCharacterModels,
  testAnimations: testCharacterAnimations
};

console.log('Character test module loaded. Use window.testCharacters.testModels() to run tests.');