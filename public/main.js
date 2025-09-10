// Libraries loaded via script tags: THREE, Daily, TasksVision
// Access them as global variables

// Debug logging
console.log("Main.js loaded");
console.log("THREE available:", typeof THREE !== 'undefined');
console.log("Daily available:", typeof Daily !== 'undefined');
console.log("TasksVision available:", typeof TasksVision !== 'undefined');

// Create mock objects if libraries are not loaded
if (typeof THREE === 'undefined') {
  console.warn('THREE.js not loaded, creating mock object');
  window.THREE = {
    Scene: function() {
      return {
        add: function() {},
        remove: function() {},
        background: { set: function() {} },
        children: []
      };
    },
    PerspectiveCamera: function() { return { position: { set: function() {} }, lookAt: function() {} }; },
    WebGLRenderer: function() { return { setSize: function() {}, render: function() {}, domElement: document.createElement('div'), shadowMap: { enabled: false } }; },
    Color: function() { return {}; },
    AmbientLight: function() { return {}; },
    DirectionalLight: function() { return { position: { set: function() {} }, shadow: { mapSize: { width: 0, height: 0 } } }; },
    PlaneGeometry: function() { return {}; },
    BoxGeometry: function() { return {}; }, // Added BoxGeometry constructor
    SphereGeometry: function() { return {}; },
    TorusGeometry: function() { return {}; },
    CircleGeometry: function() { return {}; },
    CylinderGeometry: function() { return {}; },
    BufferGeometry: function() { return { setAttribute: function() {} }; },
    MeshLambertMaterial: function() { return {}; },
    MeshBasicMaterial: function() { return {}; },
    PointsMaterial: function() { return {}; },
    LineBasicMaterial: function() { return {}; },
    Mesh: function() { return { position: { set: function() {}, copy: function() { return {}; } }, rotation: { x: 0, y: 0, z: 0 }, userData: {}, clone: function() { return this; } }; },
    Points: function() { return { geometry: { attributes: { position: { array: [], needsUpdate: false } } }, material: {}, userData: {} }; },
    LineSegments: function() { return {}; },
    Group: function() { return { add: function() {}, position: { set: function() {}, copy: function() { return {}; } }, rotation: { x: 0, y: 0 } }; },
    Vector3: function() {
      return {
        x: 0, y: 0, z: 0,
        set: function(x, y, z) {
          this.x = x || 0;
          this.y = y || 0;
          this.z = z || 0;
          return this;
        },
        add: function(v) {
          if (v) {
            this.x += v.x || 0;
            this.y += v.y || 0;
            this.z += v.z || 0;
          }
          return this;
        },
        sub: function(v) {
          if (v) {
            this.x -= v.x || 0;
            this.y -= v.y || 0;
            this.z -= v.z || 0;
          }
          return this;
        },
        clone: function() {
          const clone = new THREE.Vector3();
          clone.x = this.x;
          clone.y = this.y;
          clone.z = this.z;
          return clone;
        },
        normalize: function() {
          return this;
        },
        multiplyScalar: function(scalar) {
          this.x *= scalar || 0;
          this.y *= scalar || 0;
          this.z *= scalar || 0;
          return this;
        },
        dot: function() {
          return 0;
        },
        length: function() {
          return 0;
        }
      };
    },
    CanvasTexture: function() { return { wrapS: 0, wrapT: 0 }; },
    Float32BufferAttribute: function() { return {}; },
    BufferAttribute: function() { return {}; },
    RepeatWrapping: 0,
    DoubleSide: 0,
    AdditiveBlending: 0
  };
}

// Game constants
const ROOM_URL = 'https://vcroom.daily.co/tennisfor4';
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

// Global variables
let daily;
let poseLandmarker;
let scene, camera, renderer;
let court, ball, rackets = {}, characters = {};
let inputBuffer = {};
let appState = 'lobby';
let characterModels = {}; // Store loaded character models
let cameraShake = {
  intensity: 0,
  decay: 0.9,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0
};
let gameState = {
  score: [0, 0],         // Current point score (0, 15, 30, 40, game)
  games: [0, 0],         // Games won in current set
  sets: [0, 0],          // Sets won in match
  currentSet: 0,         // Current set (0-2 for three sets)
  serving: 0,            // Index of serving player
  players: [],           // Player IDs
  mode: 'doubles',       // Game mode (always doubles)
  gamePoint: false,      // Is this game point?
  setPoint: false,       // Is this set point?
  matchPoint: false,     // Is this match point?
  deuce: false,          // Is the score at deuce?
  advantage: null,       // Which team has advantage (0 or 1, null if not at advantage)
  lastPoint: null,       // Which team scored last point
  lastPointTime: 0,      // When the last point was scored
  inTiebreak: false,     // Whether we're in a tiebreak game
  tiebreakScore: [0, 0], // Score in the tiebreak (first to 7, win by 2)
  servingInTiebreak: 0   // Player serving in tiebreak (changes every 2 points)
};
let myId;
let currentPose = null;
let audioContext = null;
let readyStates = {};
let statusIndicators = [];
let ballTrail;
let impactParticles = [];

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(frequency, duration) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Initialize the app
async function init() {
  initAudio();
  await setupMediaPipe();
  setupThreeJS();
  await loadCharacterModels();
  await setupDaily();
  setupGameLoop();
}

// Load character models
async function loadCharacterModels() {
  try {
    console.log('Loading character models');
    
    // Create default character models if no custom models are provided
    // These will be used as fallbacks
    characterModels = {
      'team1': createDefaultCharacterModel(0), // Team 1 (orange)
      'team2': createDefaultCharacterModel(1)  // Team 2 (blue)
    };
    
    // In a real implementation, we would load GLTF models here
    // For example:
    // const loader = new THREE.GLTFLoader();
    // const model = await loader.loadAsync('path/to/model.glb');
    // characterModels['custom'] = model.scene;
    
    console.log('Character models loaded');
  } catch (error) {
    console.error('Error loading character models:', error);
  }
}

// Create a default character model
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
        head: { position: new THREE.Vector3(head.position.x, head.position.y, head.position.z), rotation: { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z } },
        leftArm: { position: new THREE.Vector3(leftArm.position.x, leftArm.position.y, leftArm.position.z), rotation: { x: leftArm.rotation.x, y: leftArm.rotation.y, z: leftArm.rotation.z } },
        rightArm: { position: new THREE.Vector3(rightArm.position.x, rightArm.position.y, rightArm.position.z), rotation: { x: rightArm.rotation.x, y: rightArm.rotation.y, z: rightArm.rotation.z } },
        leftLeg: { position: new THREE.Vector3(leftLeg.position.x, leftLeg.position.y, leftLeg.position.z), rotation: { x: leftLeg.rotation.x, y: leftLeg.rotation.y, z: leftLeg.rotation.z } },
        rightLeg: { position: new THREE.Vector3(rightLeg.position.x, rightLeg.position.y, rightLeg.position.z), rotation: { x: rightLeg.rotation.x, y: rightLeg.rotation.y, z: rightLeg.rotation.z } }
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

async function setupMediaPipe() {
  try {
    const FilesetResolver = window.TasksVision ? window.TasksVision.FilesetResolver : window.FilesetResolver;
    const PoseLandmarker = window.TasksVision ? window.TasksVision.PoseLandmarker : window.PoseLandmarker;

    if (!FilesetResolver || !PoseLandmarker) {
      console.warn('MediaPipe not loaded, using mock pose tracking');
      // Create a mock poseLandmarker that returns random poses
      poseLandmarker = {
        setOptions: function() {},
        detectForVideo: function() {
          return {
            landmarks: [
              // Generate random landmarks for testing
              Array.from({length: 33}, () => ({
                x: Math.random(),
                y: Math.random(),
                z: Math.random(),
                visibility: Math.random()
              }))
            ]
          };
        }
      };
      return;
    }

    console.log('Setting up MediaPipe with real implementation');
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });
    console.log('MediaPipe setup complete');
  } catch (error) {
    console.error('Error setting up MediaPipe:', error);
    // Create fallback mock implementation
    poseLandmarker = {
      setOptions: function() {},
      detectForVideo: function() {
        return {
          landmarks: [
            // Generate random landmarks for testing
            Array.from({length: 33}, () => ({
              x: Math.random(),
              y: Math.random(),
              z: Math.random(),
              visibility: Math.random()
            }))
          ]
        };
      }
    };
  }
}

function setupThreeJS() {
  try {
    console.log('Setting up Three.js scene');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
      console.warn('WebGL renderer creation failed, using fallback renderer');
      renderer = {
        setSize: function() {},
        render: function() {},
        domElement: document.createElement('div'),
        shadowMap: { enabled: false }
      };
    }
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    const gameElement = document.getElementById('game');
    if (gameElement) {
      gameElement.appendChild(renderer.domElement);
    } else {
      console.warn('Game element not found, cannot append renderer');
    }

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
  } catch (error) {
    console.error('Error setting up Three.js:', error);
    
    // Create minimal scene objects for fallback
    scene = { add: function() {}, background: { set: function() {} }, children: [] };
    camera = { position: { set: function() {} }, lookAt: function() {} };
    renderer = {
      setSize: function() {},
      render: function() {},
      domElement: document.createElement('div'),
      shadowMap: { enabled: false }
    };
  }

  // Create court with texture
  const courtGeometry = new THREE.PlaneGeometry(20, 10);
  
  // Create court texture programmatically
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Draw court base color (bright green)
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw court lines (white)
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 10;
  
  // Outer boundary
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  
  // Center line
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 20);
  ctx.lineTo(canvas.width / 2, canvas.height - 20);
  ctx.stroke();
  
  // Service lines
  const serviceLineOffset = canvas.width / 4;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - serviceLineOffset, 20);
  ctx.lineTo(canvas.width / 2 - serviceLineOffset, canvas.height - 20);
  ctx.moveTo(canvas.width / 2 + serviceLineOffset, 20);
  ctx.lineTo(canvas.width / 2 + serviceLineOffset, canvas.height - 20);
  ctx.stroke();
  
  // Create texture from canvas
  const courtTexture = new THREE.CanvasTexture(canvas);
  courtTexture.wrapS = THREE.RepeatWrapping;
  courtTexture.wrapT = THREE.RepeatWrapping;
  
  const courtMaterial = new THREE.MeshLambertMaterial({ map: courtTexture });
  court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  scene.add(court);

  // Create net
  const netGeometry = new THREE.PlaneGeometry(20, 1);
  const netMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const net = new THREE.Mesh(netGeometry, netMaterial);
  net.position.set(0, 0.5, 0);
  net.castShadow = true;
  scene.add(net);

  // Create stadium walls
  createStadium();

  // Create ball
  const ballGeometry = new THREE.SphereGeometry(0.1);
  const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
  ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.position.set(0, 0.5, 0);
  ball.velocity = new THREE.Vector3(0.1, 0, 0.05);
  ball.castShadow = true;
  ball.previousPositions = [];
  scene.add(ball);
  
  // Create ball trail
  createBallTrail();

  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
}

function createBallTrail() {
  // Create trail geometry
  const trailGeometry = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(30 * 3); // 30 points, 3 values (x,y,z) each
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  
  // Create trail material
  const trailMaterial = new THREE.PointsMaterial({
    color: 0xffff00,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  // Create trail points
  ballTrail = new THREE.Points(trailGeometry, trailMaterial);
  scene.add(ballTrail);
}

function updateBallTrail() {
  // Store current position
  ball.previousPositions.unshift({
    position: new THREE.Vector3(ball.position.x, ball.position.y, ball.position.z),
    velocity: new THREE.Vector3(ball.velocity.x, ball.velocity.y, ball.velocity.z).length()
  });
  
  // Limit the number of positions stored
  if (ball.previousPositions.length > 30) {
    ball.previousPositions.pop();
  }
  
  // Update trail geometry
  const positions = ballTrail.geometry.attributes.position.array;
  const velocityMax = Math.max(...ball.previousPositions.map(p => p.velocity), 0.1);
  
  for (let i = 0; i < ball.previousPositions.length; i++) {
    const pos = ball.previousPositions[i].position;
    const velocityFactor = ball.previousPositions[i].velocity / velocityMax;
    
    // Position
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    
    // Update size based on velocity
    ballTrail.geometry.attributes.position.needsUpdate = true;
    
    // Update opacity based on index (fade out)
    const opacity = (1 - i / ball.previousPositions.length) * velocityFactor;
    ballTrail.material.opacity = Math.min(0.7, opacity);
    
    // Update size based on velocity
    ballTrail.material.size = 0.05 + velocityFactor * 0.05;
  }
}

function createImpactParticles(position, normal, color = 0xffff00) {
  // Create particle geometry
  const particleCount = 20;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleSizes = new Float32Array(particleCount);
  
  // Initialize positions at impact point
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = position.x;
    particlePositions[i * 3 + 1] = position.y;
    particlePositions[i * 3 + 2] = position.z;
    particleSizes[i] = 0.03 + Math.random() * 0.03;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
  
  // Create particle material
  const particleMaterial = new THREE.PointsMaterial({
    color: color,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  // Create particle system
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  
  // Add velocity to each particle
  const velocities = [];
  for (let i = 0; i < particleCount; i++) {
    // Create random velocity in hemisphere of normal direction
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );
    
    // Ensure particles move away from impact
    const dot = velocity.dot(normal);
    if (dot < 0) {
      velocity.add(normal.clone().multiplyScalar(-2 * dot));
    }
    
    // Normalize and scale
    velocity.normalize().multiplyScalar(0.05 + Math.random() * 0.1);
    velocities.push(velocity);
  }
  
  // Store particle data
  particles.userData = {
    velocities: velocities,
    age: 0,
    maxAge: 30 // frames
  };
  
  scene.add(particles);
  impactParticles.push(particles);
  
  // Play impact sound
  playSound(300 + Math.random() * 200, 0.1);
}

function updateImpactParticles() {
  // Update each particle system
  for (let i = impactParticles.length - 1; i >= 0; i--) {
    const particles = impactParticles[i];
    particles.userData.age++;
    
    // Remove old particle systems
    if (particles.userData.age >= particles.userData.maxAge) {
      try {
        scene.remove(particles);
      } catch (error) {
        // Fallback for when remove method fails
        const index = scene.children.indexOf(particles);
        if (index > -1) {
          scene.children.splice(index, 1);
        }
        console.log("Using fallback scene.remove");
      }
      impactParticles.splice(i, 1);
      continue;
    }
    
    // Update particle positions
    const positions = particles.geometry.attributes.position.array;
    const velocities = particles.userData.velocities;
    
    for (let j = 0; j < velocities.length; j++) {
      positions[j * 3] += velocities[j].x;
      positions[j * 3 + 1] += velocities[j].y;
      positions[j * 3 + 2] += velocities[j].z;
      
      // Add gravity
      velocities[j].y -= 0.002;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    
    // Fade out particles
    const opacity = 1 - particles.userData.age / particles.userData.maxAge;
    particles.material.opacity = opacity;
  }
}

function createStadium() {
  try {
    console.log('Creating stadium');
    
    // Create stadium walls
    const wallHeight = 3;
    const wallColor = 0x228B22; // Green color for stadium
    
    // Back wall (positive Z)
    const backWallGeometry = new THREE.BoxGeometry(22, wallHeight, 0.2);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, wallHeight / 2, 5.1);
    scene.add(backWall);
    
    // Front wall (negative Z)
    const frontWall = backWall.clone();
    frontWall.position.set(0, wallHeight / 2, -5.1);
    scene.add(frontWall);
    
    // Left wall (negative X)
    const sideWallGeometry = new THREE.BoxGeometry(0.2, wallHeight, 10.2);
    const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
    leftWall.position.set(-10.1, wallHeight / 2, 0);
    scene.add(leftWall);
    
    // Right wall (positive X)
    const rightWall = leftWall.clone();
    rightWall.position.set(10.1, wallHeight / 2, 0);
    scene.add(rightWall);
    
    // Create stands with spectators (simplified as colored boxes)
    const standDepth = 3;
    const standGeometry = new THREE.BoxGeometry(22, 0.5, standDepth);
    const standMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    // Back stands
    const backStand = new THREE.Mesh(standGeometry, standMaterial);
    backStand.position.set(0, 0.25, 5.1 + standDepth / 2);
    scene.add(backStand);
    
    // Front stands
    const frontStand = backStand.clone();
    frontStand.position.set(0, 0.25, -5.1 - standDepth / 2);
    scene.add(frontStand);
    
    // Left stands
    const sideStandGeometry = new THREE.BoxGeometry(standDepth, 0.5, 10.2);
    const leftStand = new THREE.Mesh(sideStandGeometry, standMaterial);
    leftStand.position.set(-10.1 - standDepth / 2, 0.25, 0);
    scene.add(leftStand);
    
    // Right stands
    const rightStand = leftStand.clone();
    rightStand.position.set(10.1 + standDepth / 2, 0.25, 0);
    scene.add(rightStand);
    
    // Add simplified spectators as particle system
    createSpectators(standDepth);
    
  } catch (error) {
    console.error('Error creating stadium:', error);
    // No need to create fallback objects as the game can function without the stadium
  }
}

function createSpectators(standDepth) {
  try {
    const spectatorGeometry = new THREE.BufferGeometry();
    const spectatorCount = 200;
    const spectatorPositions = [];
    const spectatorColors = [];
    
    // Colors for spectators
    const colorOptions = [
      new THREE.Color(0xFF0000), // Red
      new THREE.Color(0x0000FF), // Blue
      new THREE.Color(0xFFFF00), // Yellow
      new THREE.Color(0x00FF00), // Green
      new THREE.Color(0xFF00FF), // Purple
      new THREE.Color(0x00FFFF), // Cyan
    ];
    
    // Generate random positions for spectators around the court
    for (let i = 0; i < spectatorCount; i++) {
      // Decide which stand this spectator is on
      const standChoice = Math.floor(Math.random() * 4);
      let x, y, z;
      
      switch (standChoice) {
        case 0: // Back stand
          x = Math.random() * 20 - 10;
          z = 5.1 + Math.random() * standDepth;
          break;
        case 1: // Front stand
          x = Math.random() * 20 - 10;
          z = -5.1 - Math.random() * standDepth;
          break;
        case 2: // Left stand
          x = -10.1 - Math.random() * standDepth;
          z = Math.random() * 10 - 5;
          break;
        case 3: // Right stand
          x = 10.1 + Math.random() * standDepth;
          z = Math.random() * 10 - 5;
          break;
      }
      
      y = 0.5 + Math.random() * 2; // Random height above the stand
      
      spectatorPositions.push(x, y, z);
      
      // Random color for each spectator
      const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      spectatorColors.push(color.r, color.g, color.b);
    }
    
    spectatorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spectatorPositions, 3));
    spectatorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(spectatorColors, 3));
    
    const spectatorMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      sizeAttenuation: true
    });
    
    const spectators = new THREE.Points(spectatorGeometry, spectatorMaterial);
    scene.add(spectators);
  } catch (error) {
    console.error('Error creating spectators:', error);
  }
}
  

async function setupDaily() {
  try {
    console.log('Setting up Daily.js');
    
    if (typeof Daily === 'undefined') {
      console.warn('Daily not loaded, using mock implementation');
      // Create a mock daily object for testing
      daily = {
        join: async function() { return Promise.resolve(); },
        participants: function() { return { local: { sessionId: 'local-user-' + Math.floor(Math.random() * 1000) } }; },
        on: function(event, callback) {
          console.log('Mock registering event handler for:', event);
          // Store the callback for later simulation
          if (event === 'data') {
            this._dataHandler = callback;
          }
        },
        _dataHandler: null,
        startCamera: async function() {
          console.log('Mock startCamera called');
          return Promise.resolve();
        },
        setLocalVideo: function() {
          console.log('Mock setLocalVideo called');
        },
        sendData: function(data) {
          console.log('Mock sending data:', data);
          // Simulate receiving the data back
          setTimeout(() => {
            if (this._dataHandler) {
              this._dataHandler({ data: data });
            }
          }, 500);
        }
      };
    } else {
      console.log('Creating real Daily call object');
      daily = Daily.createCallObject({
        audioSource: true,
        videoSource: true
      });
      
      // Show camera permission dialog
      try {
        console.log('Requesting camera permissions...');
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Camera permissions granted');
      } catch (err) {
        console.warn('Camera permission error:', err);
      }
      
      console.log('Joining Daily room:', ROOM_URL);
      await daily.join({ url: ROOM_URL });
      console.log('Joined Daily room successfully');
    }
    
    myId = daily.participants().local.sessionId;
    console.log('Connected with ID:', myId);

    daily.on('participant-joined', handleParticipantJoined);
    daily.on('participant-left', handleParticipantLeft);
    daily.on('participant-updated', handleParticipantUpdated);
    daily.on('data', handleData);

    // Start camera and get stream for MediaPipe
    await daily.startCamera();
    const localVideo = document.createElement('video');
    localVideo.autoplay = true;
    localVideo.muted = true;
    daily.setLocalVideo(localVideo);

    // Add local player to lobby with video
    console.log('Adding local player to lobby with video');
    try {
      addToLobby(myId, localVideo);
      
      // Make sure the local player is shown as the first player
      if (gameState.players.indexOf(myId) === -1) {
        gameState.players.unshift(myId);
      }
    } catch (error) {
      console.error('Error adding local player to lobby:', error);
    }

    // Pass stream to MediaPipe
    if (poseLandmarker) {
      poseLandmarker.setOptions({ runningMode: "VIDEO" });
      const detectPose = async () => {
        try {
          if (localVideo.readyState >= 2) {
            const result = await poseLandmarker.detectForVideo(localVideo, Date.now());
            currentPose = result.landmarks[0]; // Assuming one pose
          }
        } catch (error) {
          console.error('Error detecting pose:', error);
        }
        requestAnimationFrame(detectPose);
      };
      detectPose();
    }

    // Ready button
    document.getElementById('ready-btn').addEventListener('click', () => {
      readyStates[myId] = true;
      daily.sendData(JSON.stringify({ type: 'ready', id: myId, ready: true }));
      updateLobby();
    });
    
    // For testing: simulate other players joining
    if (typeof Daily === 'undefined') {
      console.log('Simulating other players for testing');
      // Simulate 3 other players joining
      for (let i = 1; i <= 3; i++) {
        const playerId = 'simulated-player-' + i;
        setTimeout(() => {
          handleParticipantJoined({ participant: { sessionId: playerId } });
          
          // Simulate them getting ready after a delay
          setTimeout(() => {
            readyStates[playerId] = true;
            handleData({ data: JSON.stringify({ type: 'ready', id: playerId, ready: true }) });
          }, 2000 * i);
        }, 1000 * i);
      }
    }
    
  } catch (error) {
    console.error('Error setting up Daily:', error);
    // Create a fallback implementation
    daily = {
      join: async function() { return Promise.resolve(); },
      participants: function() { return { local: { sessionId: 'local-user-fallback' } }; },
      on: function(event, callback) {
        console.log('Fallback registering event handler for:', event);
        // Store the callback for later simulation
        if (event === 'data') {
          this._dataHandler = callback;
        }
      },
      _dataHandler: null,
      startCamera: async function() { return Promise.resolve(); },
      setLocalVideo: function() {},
      sendData: function(data) {
        console.log('Fallback sending data:', data);
        // Simulate receiving the data back
        setTimeout(() => {
          if (this._dataHandler) {
            this._dataHandler({ data: data });
          }
        }, 500);
      }
    };
    
    myId = daily.participants().local.sessionId;
    console.log('Connected with fallback ID:', myId);
    
    // Add to lobby
    const dummyVideo = document.createElement('video');
    addToLobby(myId, dummyVideo);
    
    // Ready button
    document.getElementById('ready-btn').addEventListener('click', () => {
      readyStates[myId] = true;
      daily.sendData(JSON.stringify({ type: 'ready', id: myId, ready: true }));
      updateLobby();
    });
    
    // Simulate other players for testing
    console.log('Simulating other players in fallback mode');
    for (let i = 1; i <= 3; i++) {
      const playerId = 'fallback-player-' + i;
      setTimeout(() => {
        handleParticipantJoined({ participant: { sessionId: playerId } });
        
        // Simulate them getting ready after a delay
        setTimeout(() => {
          readyStates[playerId] = true;
          handleData({ data: JSON.stringify({ type: 'ready', id: playerId, ready: true }) });
        }, 2000 * i);
      }, 1000 * i);
    }
  }
}

function handleParticipantJoined(event) {
  const participant = event.participant;
  console.log('Participant joined:', participant.sessionId);
  
  gameState.players.push(participant.sessionId);
  readyStates[participant.sessionId] = false;
  
  // Create video element for the participant
  const videoElement = document.createElement('video');
  videoElement.id = `lobby-video-${participant.sessionId}`;
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.className = 'lobby-video';
  
  try {
    console.log('Setting participant video:', participant.sessionId);
    daily.setParticipantVideo(participant.sessionId, videoElement);
    addToLobby(participant.sessionId, videoElement);
  } catch (error) {
    console.error('Error setting participant video:', error);
  }
  
  updateLobby();

  if (appState === 'game') {
    // Create Wii-style racket for new player
    const racket = createWiiRacket();
    
    // Position racket based on player index
    const playerIndex = gameState.players.length - 1;
    const positions = [
      { x: -8, z: 3 }, // Top-left
      { x: 8, z: 3 },  // Top-right
      { x: -8, z: -3 }, // Bottom-left
      { x: 8, z: -3 }  // Bottom-right
    ];
    if (positions[playerIndex]) {
      racket.position.set(positions[playerIndex].x, 0.5, positions[playerIndex].z);
    }

    rackets[participant.sessionId] = racket;
    scene.add(racket);
    
    // Create character for the player
    const teamIndex = playerIndex % 2;
    const teamKey = teamIndex === 0 ? 'team1' : 'team2';
    
    // Clone the character model for this player
    const character = characterModels[teamKey].clone();
    character.position.set(
      racket.position.x,
      0, // Place on ground
      racket.position.z + ((positions[playerIndex].z > 0) ? -0.5 : 0.5) // Offset from racket
    );
    
    // Rotate character to face the net
    if (positions[playerIndex].z > 0) {
      character.rotation.y = Math.PI; // Face forward (toward negative Z)
    }
    
    characters[participant.sessionId] = character;
    scene.add(character);
  }
}

function createWiiRacket() {
  // Create a group to hold all racket parts
  const racketGroup = new THREE.Group();
  
  // Team colors (alternating for players)
  const teamColors = [0xFF5722, 0x2196F3]; // Orange and Blue like Wii Sports
  const teamIndex = Object.keys(rackets).length % 2;
  
  // Create racket head (oval shape)
  const headGeometry = new THREE.TorusGeometry(0.3, 0.03, 16, 32);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Dark gray/black
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.rotation.x = Math.PI / 2;
  head.castShadow = true;
  racketGroup.add(head);
  
  // Create racket strings
  const stringsGeometry = new THREE.CircleGeometry(0.28, 32);
  const stringsMaterial = new THREE.MeshLambertMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  const strings = new THREE.Mesh(stringsGeometry, stringsMaterial);
  strings.rotation.x = Math.PI / 2;
  strings.position.z = 0.01; // Slight offset to avoid z-fighting
  racketGroup.add(strings);
  
  // Create string pattern (simplified)
  const stringLinesGeometry = new THREE.BufferGeometry();
  const stringPositions = [];
  
  // Horizontal strings
  for (let i = -0.25; i <= 0.25; i += 0.1) {
    stringPositions.push(-0.25, i, 0.02);
    stringPositions.push(0.25, i, 0.02);
  }
  
  // Vertical strings
  for (let i = -0.25; i <= 0.25; i += 0.1) {
    stringPositions.push(i, -0.25, 0.02);
    stringPositions.push(i, 0.25, 0.02);
  }
  
  stringLinesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stringPositions, 3));
  const stringLinesMaterial = new THREE.LineBasicMaterial({ color: 0xCCCCCC });
  const stringLines = new THREE.LineSegments(stringLinesGeometry, stringLinesMaterial);
  racketGroup.add(stringLines);
  
  // Create racket handle
  const handleGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.5);
  const handleMaterial = new THREE.MeshLambertMaterial({ color: teamColors[teamIndex] });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.y = -0.4;
  handle.castShadow = true;
  racketGroup.add(handle);
  
  // Create grip at bottom of handle
  const gripGeometry = new THREE.CylinderGeometry(0.04, 0.03, 0.1);
  const gripMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.y = -0.7;
  grip.castShadow = true;
  racketGroup.add(grip);
  
  return racketGroup;
}

function handleParticipantUpdated(event) {
  const participant = event.participant;
  console.log('Participant updated:', participant.sessionId, participant);
  
  // Check if this participant has video
  if (participant.video) {
    const existingVideo = document.getElementById(`lobby-video-${participant.sessionId}`);
    
    if (!existingVideo) {
      console.log('Creating new video element for participant:', participant.sessionId);
      const videoElement = document.createElement('video');
      videoElement.id = `lobby-video-${participant.sessionId}`;
      videoElement.autoplay = true;
      videoElement.muted = participant.sessionId !== myId; // Only mute other participants
      videoElement.className = 'lobby-video';
      
      try {
        daily.setParticipantVideo(participant.sessionId, videoElement);
        
        // Find existing container or create new one
        const container = document.getElementById(`video-container-${participant.sessionId}`);
        if (container) {
          // Replace placeholder if it exists
          const placeholder = container.querySelector('.video-placeholder');
          if (placeholder) {
            container.replaceChild(videoElement, placeholder);
          } else {
            // Add as first child
            container.insertBefore(videoElement, container.firstChild);
          }
        } else {
          // Add to lobby if no container exists
          addToLobby(participant.sessionId, videoElement);
        }
        
        console.log('Video element added for participant:', participant.sessionId);
      } catch (error) {
        console.error('Error setting participant video:', error);
      }
    } else {
      console.log('Video element already exists for participant:', participant.sessionId);
    }
  }
  
  // Update ready state if changed
  if (participant.userData && participant.userData.ready !== undefined) {
    readyStates[participant.sessionId] = participant.userData.ready;
    updateLobby();
  }
}

function handleParticipantLeft(event) {
  const index = gameState.players.indexOf(event.participant.sessionId);
  if (index > -1) {
    gameState.players.splice(index, 1);
  }
  
  // Remove racket
  try {
    scene.remove(rackets[event.participant.sessionId]);
  } catch (error) {
    // Fallback for when remove method fails
    const index = scene.children.indexOf(rackets[event.participant.sessionId]);
    if (index > -1) {
      scene.children.splice(index, 1);
    }
    console.log("Using fallback scene.remove for racket");
  }
  delete rackets[event.participant.sessionId];
  
  // Remove character
  try {
    scene.remove(characters[event.participant.sessionId]);
  } catch (error) {
    // Fallback for when remove method fails
    const index = scene.children.indexOf(characters[event.participant.sessionId]);
    if (index > -1) {
      scene.children.splice(index, 1);
    }
    console.log("Using fallback scene.remove for character");
  }
  delete characters[event.participant.sessionId];

  // Remove video container
  const container = document.getElementById(`video-${event.participant.sessionId}`)?.parentElement;
  if (container) {
    container.remove();
  }

  updateUI();
}

function handleData(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'ready') {
    readyStates[data.id] = data.ready;
    updateLobby();
  } else if (data.type === 'start') {
    startGame();
  } else {
    if (!inputBuffer[data.t]) inputBuffer[data.t] = {};
    inputBuffer[data.t][data.id] = data.swing;
  }
}

function setupGameLoop() {
  setInterval(() => {
    const tick = Date.now();
    // Capture pose and send swing
    if (poseLandmarker) {
      const swing = getSwingVector();
      inputBuffer[tick] = inputBuffer[tick] || {};
      inputBuffer[tick][myId] = swing;
      daily.sendData(JSON.stringify({ t: tick, id: myId, swing }));
    }

    // Simulate if all inputs received
    if (Object.keys(inputBuffer[tick] || {}).length === gameState.players.length + 1) {
      simulateFrame(inputBuffer[tick]);
      render();
      delete inputBuffer[tick - MS_PER_TICK];
    }
  }, MS_PER_TICK);
}

let prevSwing = { angle: 0, velocity: 0 };

function getSwingVector() {
  if (!currentPose) return prevSwing;

  const wrist = currentPose[16]; // Right wrist
  const elbow = currentPose[14]; // Right elbow
  const shoulder = currentPose[12]; // Right shoulder

  if (!wrist || !elbow || !shoulder) return prevSwing;

  // Calculate angle from shoulder to wrist
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Calculate velocity (simplified)
  const velocity = Math.sqrt(dx * dx + dy * dy) * 10;

  // EMA smoothing
  const alpha = 0.3;
  const smoothedAngle = alpha * angle + (1 - alpha) * prevSwing.angle;
  const smoothedVelocity = alpha * velocity + (1 - alpha) * prevSwing.velocity;

  prevSwing = { angle: smoothedAngle, velocity: smoothedVelocity, ts: Date.now() };
  return prevSwing;
}

function simulateFrame(inputs) {
  const dt = MS_PER_TICK / 1000;

  // Apply gravity
  ball.velocity.y -= 9.8 * dt;

  // Update position
  try {
    ball.position.add(ball.velocity.clone().multiplyScalar(dt));
  } catch (error) {
    // Fallback for when add method fails
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.position.z += ball.velocity.z * dt;
    console.log("Using fallback position update");
  }

  // Check court boundaries
  if (ball.position.y <= 0.1) {
    // Store previous position for impact effect
    const impactPosition = ball.position.clone();
    
    // Bounce ball
    ball.position.y = 0.1;
    ball.velocity.y *= -0.8; // Bounce with damping
    
    // Create impact particles
    createImpactParticles(
      impactPosition,
      new THREE.Vector3(0, 1, 0), // Normal pointing up
      0xffffff // White particles for court bounce
    );
    
    // Add camera shake - medium intensity for court bounce
    shakeCamera(0.05);
    
    playSound(200, 0.1); // Bounce sound
  }

  // Check side boundaries
  if (Math.abs(ball.position.x) > 10) {
    // Store previous position for impact effect
    const impactPosition = ball.position.clone();
    const normal = new THREE.Vector3(-Math.sign(ball.position.x), 0, 0);
    
    // Bounce ball
    ball.velocity.x *= -1;
    ball.position.x = Math.sign(ball.position.x) * 10;
    
    // Create impact particles
    createImpactParticles(impactPosition, normal, 0x00ff00); // Green particles for wall bounce
    
    // Add camera shake - low intensity for wall bounce
    shakeCamera(0.03);
  }

  // Check front/back boundaries
  if (Math.abs(ball.position.z) > 5) {
    // Store previous position for impact effect
    const impactPosition = ball.position.clone();
    const normal = new THREE.Vector3(0, 0, -Math.sign(ball.position.z));
    
    // Bounce ball
    ball.velocity.z *= -1;
    ball.position.z = Math.sign(ball.position.z) * 5;
    
    // Create impact particles
    createImpactParticles(impactPosition, normal, 0x00ff00); // Green particles for wall bounce
    
    // Add camera shake - low intensity for wall bounce
    shakeCamera(0.03);
  }

  // Check racket collisions
  for (let id in inputs) {
    const racket = rackets[id];
    if (racket && ball.position.distanceTo(racket.position) < 1) {
      // Calculate normal from racket to ball
      const normal = ball.position.clone().sub(racket.position).normalize();
      
      // Reflect ball based on swing
      const swing = inputs[id];
      ball.velocity.x += Math.cos(swing.angle * Math.PI / 180) * swing.velocity * 0.1;
      ball.velocity.z += Math.sin(swing.angle * Math.PI / 180) * swing.velocity * 0.1;
      ball.velocity.y += 0.5; // Add some upward force
      
      // Create impact particles
      createImpactParticles(
        ball.position.clone(),
        normal,
        0xffff00 // Yellow particles for racket hit
      );
      
      // Add camera shake - high intensity for racket hit
      shakeCamera(0.08);
      
      // Animate character swing
      if (characters[id]) {
        animateCharacterSwing(characters[id], swing);
      }
      
      playSound(400, 0.2); // Swing sound
    }
  }

  // Scoring
  if (ball.position.z > 5) {
    // Team 1 scores a point
    scorePoint(0);
  } else if (ball.position.z < -5) {
    // Team 2 scores a point
    scorePoint(1);
  }
}

// Handle scoring a point, updating games and sets as needed
function scorePoint(team) {
  // Store last point info
  gameState.lastPoint = team;
  gameState.lastPointTime = Date.now();
  
  const otherTeam = 1 - team;
  
  // Handle tiebreak scoring differently
  if (gameState.inTiebreak) {
    // Increment tiebreak score
    gameState.tiebreakScore[team]++;
    
    // Check if this point wins the tiebreak
    if (gameState.tiebreakScore[team] >= 7 &&
        gameState.tiebreakScore[team] - gameState.tiebreakScore[otherTeam] >= 2) {
      // Team won the tiebreak and the set
      gameState.games[team]++;
      gameState.sets[team]++;
      
      // Reset for next set
      gameState.games = [0, 0];
      gameState.score = [0, 0];
      gameState.tiebreakScore = [0, 0];
      gameState.inTiebreak = false;
      
      showStatusIndicator(`Tiebreak and Set to Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
      
      // Check if this set wins the match (best of 3 sets)
      if (gameState.sets[team] >= 2) {
        // Team won the match
        showStatusIndicator(`Match to Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
        // Could add match end logic here
      }
    } else {
      // Update serving in tiebreak (changes every 2 points)
      const totalPoints = gameState.tiebreakScore[0] + gameState.tiebreakScore[1];
      if (totalPoints % 2 === 1) {
        gameState.servingInTiebreak = (gameState.servingInTiebreak + 1) % gameState.players.length;
      }
      
      showStatusIndicator(`Tiebreak Point for Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
    }
  } else {
    // Regular scoring
    // Increment point score
    gameState.score[team]++;
    
    // Check if this point wins the game
    const scoreValues = [0, 15, 30, 40];
    const teamScore = scoreValues[Math.min(gameState.score[team], 3)];
    const otherTeamScore = scoreValues[Math.min(gameState.score[otherTeam], 3)];
    
    let gameWon = false;
    
    // Check for game win conditions
    if (gameState.deuce) {
      // In deuce, team needs to be up by 2 points
      if (gameState.score[team] >= 4 && gameState.score[team] - gameState.score[otherTeam] >= 2) {
        gameWon = true;
      } else if (gameState.score[team] > gameState.score[otherTeam]) {
        // Team now has advantage
        gameState.advantage = team;
        gameState.deuce = false;
        showStatusIndicator(`Advantage Team ${team + 1}`, team === 0 ? 0xff5722 : 0x2196f3);
      } else {
        // Back to deuce
        showStatusIndicator("Deuce", 0xffffff);
      }
    } else if (gameState.advantage === team) {
      // Team had advantage and scored again
      gameWon = true;
    } else if (gameState.advantage === otherTeam) {
      // Other team had advantage, now back to deuce
      gameState.advantage = null;
      gameState.deuce = true;
      showStatusIndicator("Deuce", 0xffffff);
    } else if (teamScore === 40 && otherTeamScore < 40) {
      // Regular win at 40
      gameWon = true;
    } else if (teamScore === 40 && otherTeamScore === 40) {
      // Deuce
      gameState.deuce = true;
      showStatusIndicator("Deuce", 0xffffff);
    }
    
    if (gameWon) {
      // Team won the game
      gameState.games[team]++;
      gameState.score = [0, 0]; // Reset points
      gameState.advantage = null;
      gameState.deuce = false;
      
      showStatusIndicator(`Game to Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
      
      // Check for tiebreak at 6-6
      if (gameState.games[0] === 6 && gameState.games[1] === 6) {
        gameState.inTiebreak = true;
        gameState.tiebreakScore = [0, 0];
        showStatusIndicator("Tiebreak Game!", 0xffffff);
      }
      // Check if this game wins the set (6 games, or 7 in case of 7-5)
      else if (gameState.games[team] >= 6 && gameState.games[team] - gameState.games[otherTeam] >= 2) {
        // Team won the set
        gameState.sets[team]++;
        gameState.games = [0, 0]; // Reset games
        showStatusIndicator(`Set to Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
        
        // Check if this set wins the match (best of 3 sets)
        if (gameState.sets[team] >= 2) {
          // Team won the match
          showStatusIndicator(`Match to Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
          // Could add match end logic here
        }
      }
    }
  }
  
  // Update serving player for regular games
  if (!gameState.inTiebreak) {
    gameState.serving = (gameState.serving + 1) % gameState.players.length;
  }
  
  // Show point animation
  animatePointScored(team);
  
  // Reset ball position
  resetBall();
  
  // Update UI
  updateUI();
}

function resetBall() {
  ball.position.set(0, 0.5, 0);
  
  // Get the current server's racket
  let servingPlayer;
  if (gameState.inTiebreak) {
    servingPlayer = gameState.players[gameState.servingInTiebreak];
  } else {
    servingPlayer = gameState.players[gameState.serving];
  }
  
  const racket = rackets[servingPlayer];
  if (racket) {
    const direction = racket.position.z > 0 ? -1 : 1;
    ball.velocity.set(0.1, 0, 0.05 * direction);
  } else {
    ball.velocity.set(0.1, 0, 0.05);
  }
  
  // Add a slight upward velocity for serve
  ball.velocity.y = 0.2;
  
  // Add a slight shake for serve
  shakeCamera(0.02);
}

function render() {
  // Dynamic camera following the ball
  const targetX = ball.position.x * 0.1;
  const targetZ = ball.position.z * 0.1 + 10;
  
  // Apply camera shake if active
  if (cameraShake.intensity > 0.01) {
    // Calculate random offsets based on intensity
    cameraShake.offsetX = (Math.random() * 2 - 1) * cameraShake.intensity;
    cameraShake.offsetY = (Math.random() * 2 - 1) * cameraShake.intensity;
    cameraShake.offsetZ = (Math.random() * 2 - 1) * cameraShake.intensity;
    
    // Decay the shake effect
    cameraShake.intensity *= cameraShake.decay;
  } else {
    cameraShake.intensity = 0;
    cameraShake.offsetX = 0;
    cameraShake.offsetY = 0;
    cameraShake.offsetZ = 0;
  }
  
  // Apply camera position with shake
  camera.position.x += (targetX - camera.position.x) * 0.05 + cameraShake.offsetX;
  camera.position.z += (targetZ - camera.position.z) * 0.05 + cameraShake.offsetZ;
  camera.position.y = 5 + cameraShake.offsetY;
  
  // Look at ball with slight shake offset
  camera.lookAt(
    ball.position.x + cameraShake.offsetX * 0.5,
    ball.position.y + cameraShake.offsetY * 0.5,
    ball.position.z + cameraShake.offsetZ * 0.5
  );
  
  // Animate server indicator
  scene.children.forEach(child => {
    if (child.userData && child.userData.type === 'serverIndicator') {
      child.userData.animationTime += 0.02;
      child.position.y = child.userData.initialY + Math.sin(child.userData.animationTime) * 0.1;
      child.rotation.y += 0.02;
    }
  });
  
  // Animate status indicators
  statusIndicators.forEach(indicator => {
    // Make indicators face the camera
    indicator.lookAt(camera.position);
  });
  
  // Update ball trail
  updateBallTrail();
  
  // Update impact particles
  updateImpactParticles();
  
  // Update character animations
  updateCharacterAnimations();

  renderer.render(scene, camera);
}

function updateUI() {
  // Format the score display to show points, games, and sets
  const pointsDisplay = formatPointsDisplay();
  const gamesDisplay = `${gameState.games[0]}-${gameState.games[1]}`;
  const setsDisplay = `${gameState.sets[0]}-${gameState.sets[1]}`;
  
  document.getElementById('score').textContent = `${pointsDisplay} | Games: ${gamesDisplay} | Sets: ${setsDisplay}`;
  document.getElementById('players').textContent = gameState.players.length + 1;
  
  // Update server indicator
  updateServerIndicator();
  
  // Check for game point, set point, match point
  checkGameStatus();
}

// Format the points display according to tennis scoring (0, 15, 30, 40, Adv)
function formatPointsDisplay() {
  const pointValues = ['0', '15', '30', '40'];
  
  // Handle advantage scoring
  if (gameState.deuce) {
    return 'Deuce';
  } else if (gameState.advantage !== null) {
    return `Adv ${gameState.advantage === 0 ? 'Team 1' : 'Team 2'}`;
  }
  
  // Regular scoring
  const team1Points = pointValues[Math.min(gameState.score[0], 3)];
  const team2Points = pointValues[Math.min(gameState.score[1], 3)];
  return `${team1Points}-${team2Points}`;
}

function updateServerIndicator() {
  // Remove any existing server indicators
  scene.children.forEach(child => {
    if (child.userData && child.userData.type === 'serverIndicator') {
      scene.remove(child);
    }
  });
  
  // Get the current server's racket
  const servingPlayer = gameState.players[gameState.serving];
  const racket = rackets[servingPlayer];
  
  if (!racket) return;
  
  // Create a server indicator (floating tennis ball above racket)
  const indicatorGeometry = new THREE.SphereGeometry(0.08);
  const indicatorMaterial = new THREE.MeshLambertMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.3
  });
  const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  
  // Position above the racket
  indicator.position.copy(racket.position);
  indicator.position.y += 1.2;
  
  // Add animation
  indicator.userData = {
    type: 'serverIndicator',
    initialY: indicator.position.y,
    animationTime: 0
  };
  
  scene.add(indicator);
}

function checkGameStatus() {
  // Reset status flags
  gameState.gamePoint = false;
  gameState.setPoint = false;
  gameState.matchPoint = false;
  gameState.deuce = false;
  gameState.advantage = null;
  
  // Tennis scoring: 0, 15, 30, 40, game
  const scoreValues = [0, 15, 30, 40];
  const team1Score = scoreValues[Math.min(gameState.score[0], 3)];
  const team2Score = scoreValues[Math.min(gameState.score[1], 3)];
  
  // Check for deuce (40-40)
  if (team1Score === 40 && team2Score === 40) {
    gameState.deuce = true;
    showStatusIndicator("Deuce", 0xffffff);
    return;
  }
  
  // Check for advantage
  if (team1Score === 40 && gameState.score[0] > 3) {
    gameState.advantage = 0;
    showStatusIndicator("Advantage Team 1", 0xff5722);
    return;
  }
  
  if (team2Score === 40 && gameState.score[1] > 3) {
    gameState.advantage = 1;
    showStatusIndicator("Advantage Team 2", 0x2196f3);
    return;
  }
  
  // Check for game point
  const isTeam1GamePoint = (team1Score === 40 && team2Score < 40) || (team1Score === 30 && team2Score === 0);
  const isTeam2GamePoint = (team2Score === 40 && team1Score < 40) || (team2Score === 30 && team1Score === 0);
  
  // Check for set point (team needs to win 3 games to win a set)
  const isTeam1SetPoint = isTeam1GamePoint && gameState.games[0] === 2;
  const isTeam2SetPoint = isTeam2GamePoint && gameState.games[1] === 2;
  
  // Check for match point (team needs to win 2 sets to win the match)
  const isTeam1MatchPoint = isTeam1SetPoint && gameState.sets[0] === 1;
  const isTeam2MatchPoint = isTeam2SetPoint && gameState.sets[1] === 1;
  
  // Show appropriate indicator
  if (isTeam1MatchPoint) {
    gameState.matchPoint = true;
    showStatusIndicator("Match Point Team 1", 0xff5722);
  } else if (isTeam2MatchPoint) {
    gameState.matchPoint = true;
    showStatusIndicator("Match Point Team 2", 0x2196f3);
  } else if (isTeam1SetPoint) {
    gameState.setPoint = true;
    showStatusIndicator("Set Point Team 1", 0xff5722);
  } else if (isTeam2SetPoint) {
    gameState.setPoint = true;
    showStatusIndicator("Set Point Team 2", 0x2196f3);
  } else if (isTeam1GamePoint) {
    gameState.gamePoint = true;
    showStatusIndicator("Game Point Team 1", 0xff5722);
  } else if (isTeam2GamePoint) {
    gameState.gamePoint = true;
    showStatusIndicator("Game Point Team 2", 0x2196f3);
  }
}

function showStatusIndicator(text, color = 0xffffff) {
  // Create a canvas for the text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw border
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  
  // Draw text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  
  // Create a plane with the texture
  const geometry = new THREE.PlaneGeometry(4, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false
  });
  
  const indicator = new THREE.Mesh(geometry, material);
  indicator.position.set(0, 3, 0);
  indicator.rotation.x = -Math.PI / 8; // Tilt slightly for better visibility
  
  // Add to scene
  scene.add(indicator);
  
  // Add to status indicators array for animation
  indicator.userData = {
    type: 'statusIndicator',
    createdAt: Date.now(),
    duration: 3000 // Show for 3 seconds
  };
  
  statusIndicators.push(indicator);
  
  // Play sound
  playSound(600, 0.2);
  
  // Animate in
  const fadeIn = () => {
    if (material.opacity < 1) {
      material.opacity += 0.05;
      requestAnimationFrame(fadeIn);
    }
  };
  fadeIn();
  
  // Remove after duration
  setTimeout(() => {
    const fadeOut = () => {
      if (material.opacity > 0) {
        material.opacity -= 0.05;
        requestAnimationFrame(fadeOut);
      } else {
        try {
          scene.remove(indicator);
        } catch (error) {
          // Fallback for when remove method fails
          const index = scene.children.indexOf(indicator);
          if (index > -1) {
            scene.children.splice(index, 1);
          }
          console.log("Using fallback scene.remove for indicator");
        }
        const index = statusIndicators.indexOf(indicator);
        if (index > -1) {
          statusIndicators.splice(index, 1);
        }
      }
    };
    fadeOut();
  }, indicator.userData.duration);
}

function animatePointScored(team) {
  // Store last point info
  gameState.lastPoint = team;
  gameState.lastPointTime = Date.now();
  
  // Show point indicator
  showStatusIndicator(`Point for Team ${team + 1}!`, team === 0 ? 0xff5722 : 0x2196f3);
  
  // Play sound
  playSound(800, 0.3);
  
  // Flash the court with team color
  const flashGeometry = new THREE.PlaneGeometry(20, 10);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: team === 0 ? 0xff5722 : 0x2196f3,
    transparent: true,
    opacity: 0.3,
    depthTest: false
  });
  
  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.rotation.x = -Math.PI / 2;
  flash.position.y = 0.01; // Slightly above court
  scene.add(flash);
  
  // Fade out flash
  setTimeout(() => {
    const fadeOut = () => {
      if (flashMaterial.opacity > 0) {
        flashMaterial.opacity -= 0.01;
        requestAnimationFrame(fadeOut);
      } else {
        try {
          scene.remove(flash);
        } catch (error) {
          // Fallback for when remove method fails
          const index = scene.children.indexOf(flash);
          if (index > -1) {
            scene.children.splice(index, 1);
          }
          console.log("Using fallback scene.remove for flash");
        }
      }
    };
    fadeOut();
  }, 500);
}

function addToLobby(id, videoElement) {
  console.log('Adding player to lobby:', id);
  
  const lobbyVideos = document.getElementById('lobby-videos');
  if (!lobbyVideos) {
    console.error('Lobby videos container not found');
    return;
  }
  
  // Create team containers if they don't exist
  const team1 = document.getElementById('team1') || document.createElement('div');
  team1.id = 'team1';
  team1.className = 'team';
  if (!team1.querySelector('h2')) {
    team1.innerHTML = '<h2>Team 1 (0/2)</h2>';
  }
  
  const team2 = document.getElementById('team2') || document.createElement('div');
  team2.id = 'team2';
  team2.className = 'team';
  if (!team2.querySelector('h2')) {
    team2.innerHTML = '<h2>Team 2 (0/2)</h2>';
  }

  if (!document.getElementById('team1')) lobbyVideos.appendChild(team1);
  if (!document.getElementById('team2')) lobbyVideos.appendChild(team2);

  // Check if this player is already in the lobby
  if (document.getElementById(`video-container-${id}`)) {
    console.log('Player already in lobby:', id);
    return;
  }

  // Create video container
  const container = document.createElement('div');
  container.className = 'video-container';
  container.id = `video-container-${id}`;
  
  // Add player slot number
  const slotNumber = gameState.players.indexOf(id) + 1;
  const isLocal = id === myId;
  
  // Add video element
  if (videoElement) {
    container.appendChild(videoElement);
  } else {
    console.warn('No video element provided for player:', id);
    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'Camera loading...';
    container.appendChild(placeholder);
  }

  // Add player name
  const nameElement = document.createElement('div');
  nameElement.className = 'player-name';
  nameElement.textContent = `${isLocal ? 'You' : 'Player'} (${id.slice(-4)})`;
  container.appendChild(nameElement);

  // Add ready indicator
  const readyIndicator = document.createElement('div');
  readyIndicator.className = 'ready-indicator';
  readyIndicator.id = `ready-${id}`;
  readyIndicator.textContent = 'Not Ready';
  container.appendChild(readyIndicator);

  // Assign to teams alternately
  const playerIndex = gameState.players.indexOf(id);
  if (playerIndex === -1) {
    // Local player
    team1.appendChild(container);
  } else if (playerIndex % 2 === 0) {
    team1.appendChild(container);
  } else {
    team2.appendChild(container);
  }
  
  console.log('Player added to lobby:', id);
}

function updateLobby() {
  const totalPlayers = gameState.players.length + 1; // +1 for local
  const allJoined = totalPlayers >= 4;
  const allReady = allJoined && Object.values(readyStates).every(ready => ready);
  
  // Update player count display
  document.getElementById('ready-btn').disabled = !allJoined;
  document.getElementById('ready-status').textContent = allJoined ?
    (allReady ? 'All ready! Starting game...' : 'All players joined! Click ready.') :
    `Waiting for players... (${totalPlayers}/4)`;
  
  // Update player slots
  const team1 = document.getElementById('team1');
  const team2 = document.getElementById('team2');
  
  if (team1) {
    team1.querySelector('h2').textContent = `Team 1 (${Math.ceil(totalPlayers/2) >= 2 ? '2' : Math.ceil(totalPlayers/2)}/2)`;
  }
  
  if (team2) {
    team2.querySelector('h2').textContent = `Team 2 (${Math.floor(totalPlayers/2) >= 2 ? '2' : Math.floor(totalPlayers/2)}/2)`;
  }
  
  // Update ready indicators
  for (const id in readyStates) {
    const indicator = document.getElementById(`ready-${id}`);
    if (indicator) {
      indicator.textContent = readyStates[id] ? 'Ready' : 'Not Ready';
      indicator.style.color = readyStates[id] ? 'green' : 'red';
      indicator.style.backgroundColor = readyStates[id] ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    }
  }

  // Start game if all players are ready
  if (allReady) {
    daily.sendData(JSON.stringify({ type: 'start' }));
    startGame();
  }
  
  console.log('Lobby updated. Total players:', totalPlayers);
}

function startGame() {
  appState = 'game';
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('ui').style.display = 'block';
  document.getElementById('videos').style.display = 'block';

  // Move videos to game UI
  const lobbyVideos = document.querySelectorAll('.lobby-video');
  lobbyVideos.forEach(video => {
    document.getElementById('videos').appendChild(video);
  });
  
  // Show game start indicator
  showStatusIndicator("Game Start!", 0xffffff);
  
  // Initialize server indicator
  updateServerIndicator();
  
  // Start game loop
  setupGameLoop();
  
  // Play game start sound
  playSound(700, 0.5);
}

// Function to trigger camera shake with specified intensity
function shakeCamera(intensity) {
  // Set shake intensity, clamped to reasonable values
  cameraShake.intensity = Math.min(Math.max(intensity, 0), 0.2);
}

// Animate character swing based on input
function animateCharacterSwing(character, swing) {
  if (!character || !character.userData || !character.userData.rig) return;
  
  const rig = character.userData.rig;
  
  // Set animation state
  rig.animations.swinging = true;
  rig.animations.swingStartTime = Date.now();
  rig.animations.swingVelocity = swing.velocity;
  rig.animations.swingAngle = swing.angle;
  
  // Get the right arm bone
  const rightArm = rig.bones.rightArm;
  if (!rightArm) return;
  
  // Initial swing position - arm goes back
  rightArm.rotation.x = -Math.PI / 4;
  rightArm.rotation.z = Math.PI / 3;
}

// Update character animations in render loop
function updateCharacterAnimations() {
  const now = Date.now();
  
  // Update each character
  Object.values(characters).forEach(character => {
    if (!character || !character.userData || !character.userData.rig) return;
    
    const rig = character.userData.rig;
    
    if (rig.animations.swinging) {
      const rightArm = rig.bones.rightArm;
      if (!rightArm) return;
      
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
      } else {
        // Reset to rest pose
        if (rig.restPose.rightArm) {
          rightArm.rotation.x = rig.restPose.rightArm.rotation.x || 0;
          rightArm.rotation.y = rig.restPose.rightArm.rotation.y || 0;
          rightArm.rotation.z = rig.restPose.rightArm.rotation.z || 0;
        } else {
          rightArm.rotation.set(0, 0, 0);
        }
        
        if (rig.bones.head && rig.restPose.head) {
          rig.bones.head.rotation.x = rig.restPose.head.rotation.x || 0;
          rig.bones.head.rotation.y = rig.restPose.head.rotation.y || 0;
          rig.bones.head.rotation.z = rig.restPose.head.rotation.z || 0;
        }
        
        rig.animations.swinging = false;
      }
    }
  });
}

// Function to load a custom character model
// This would be called when a user provides their own model
function loadCustomCharacterModel(url, teamIndex) {
  return new Promise((resolve, reject) => {
    // In a real implementation, we would use THREE.GLTFLoader
    // For now, we'll just create a default model
    console.log(`Loading custom character model from ${url} for team ${teamIndex + 1}`);
    
    const model = createDefaultCharacterModel(teamIndex);
    const teamKey = teamIndex === 0 ? 'team1' : 'team2';
    characterModels[teamKey] = model;
    
    resolve(model);
  });
}

// Start the app
init();