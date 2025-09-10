// Libraries loaded via script tags: THREE, Daily, PoseLandmarker, FilesetResolver

// Game constants
const ROOM_URL = 'https://vcroom.daily.co/tennisfor4';
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

// Global variables
let daily;
let poseLandmarker;
let scene, camera, renderer;
let court, ball, rackets = {};
let inputBuffer = {};
let appState = 'lobby';
let gameState = {
  score: [0, 0],
  serving: 0,
  players: [],
  mode: 'doubles',
  gamePoint: false,
  deuce: false,
  lastPoint: null,
  lastPointTime: 0
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
  await setupDaily();
  setupGameLoop();
}

async function setupMediaPipe() {
  const FilesetResolver = window.TasksVision ? window.TasksVision.FilesetResolver : window.FilesetResolver;
  const PoseLandmarker = window.TasksVision ? window.TasksVision.PoseLandmarker : window.PoseLandmarker;

  if (!FilesetResolver || !PoseLandmarker) {
    console.warn('MediaPipe not loaded, skipping pose tracking');
    return;
  }

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
}

function setupThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game').appendChild(renderer.domElement);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);

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
    position: ball.position.clone(),
    velocity: ball.velocity.clone().length()
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
      scene.remove(particles);
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
}

async function setupDaily() {
  daily = Daily.createCallObject();
  await daily.join({ url: ROOM_URL });
  myId = daily.participants().local.sessionId;

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

  // Add to lobby
  addToLobby(myId, localVideo);

  // Pass stream to MediaPipe
  if (poseLandmarker) {
    poseLandmarker.setOptions({ runningMode: "VIDEO" });
    const detectPose = async () => {
      if (localVideo.readyState >= 2) {
        const result = await poseLandmarker.detectForVideo(localVideo, Date.now());
        currentPose = result.landmarks[0]; // Assuming one pose
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
}

function handleParticipantJoined(event) {
  const participant = event.participant;
  gameState.players.push(participant.sessionId);
  readyStates[participant.sessionId] = false;
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
  if (participant.video && !document.getElementById(`lobby-video-${participant.sessionId}`)) {
    const videoElement = document.createElement('video');
    videoElement.id = `lobby-video-${participant.sessionId}`;
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.className = 'lobby-video';
    daily.setParticipantVideo(participant.sessionId, videoElement);
    addToLobby(participant.sessionId, videoElement);
  }
}

function handleParticipantLeft(event) {
  const index = gameState.players.indexOf(event.participant.sessionId);
  if (index > -1) {
    gameState.players.splice(index, 1);
  }
  scene.remove(rackets[event.participant.sessionId]);
  delete rackets[event.participant.sessionId];

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
  ball.position.add(ball.velocity.clone().multiplyScalar(dt));

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
      
      playSound(400, 0.2); // Swing sound
    }
  }

  // Scoring
  if (ball.position.z > 5) {
    gameState.score[0]++;
    gameState.serving = (gameState.serving + 1) % gameState.players.length;
    animatePointScored(0);
    resetBall();
    updateUI();
  } else if (ball.position.z < -5) {
    gameState.score[1]++;
    gameState.serving = (gameState.serving + 1) % gameState.players.length;
    animatePointScored(1);
    resetBall();
    updateUI();
  }
}

function resetBall() {
  ball.position.set(0, 0.5, 0);
  const servingPlayer = gameState.players[gameState.serving];
  const racket = rackets[servingPlayer];
  if (racket) {
    const direction = racket.position.z > 0 ? -1 : 1;
    ball.velocity.set(0.1, 0, 0.05 * direction);
  } else {
    ball.velocity.set(0.1, 0, 0.05);
  }
}

function render() {
  // Dynamic camera following the ball
  const targetX = ball.position.x * 0.1;
  const targetZ = ball.position.z * 0.1 + 10;
  camera.position.x += (targetX - camera.position.x) * 0.05;
  camera.position.z += (targetZ - camera.position.z) * 0.05;
  camera.lookAt(ball.position);
  
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

  renderer.render(scene, camera);
}

function updateUI() {
  document.getElementById('score').textContent = `${gameState.score[0]}-${gameState.score[1]}`;
  document.getElementById('players').textContent = gameState.players.length + 1;
  
  // Update server indicator
  updateServerIndicator();
  
  // Check for game point
  checkGamePoint();
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

function checkGamePoint() {
  // Tennis scoring: 0, 15, 30, 40, game
  const scoreValues = [0, 15, 30, 40];
  const team1Score = scoreValues[Math.min(gameState.score[0], 3)];
  const team2Score = scoreValues[Math.min(gameState.score[1], 3)];
  
  // Check for deuce (40-40)
  if (team1Score === 40 && team2Score === 40) {
    if (!gameState.deuce) {
      gameState.deuce = true;
      showStatusIndicator("Deuce", 0xffffff);
    }
    return;
  }
  
  gameState.deuce = false;
  
  // Check for advantage
  if (team1Score === 40 && gameState.score[0] > 3) {
    showStatusIndicator("Advantage Team 1", 0xff5722);
    return;
  }
  
  if (team2Score === 40 && gameState.score[1] > 3) {
    showStatusIndicator("Advantage Team 2", 0x2196f3);
    return;
  }
  
  // Check for game point
  if ((team1Score === 40 && team2Score < 40) ||
      (team1Score === 30 && team2Score === 0)) {
    if (!gameState.gamePoint) {
      gameState.gamePoint = true;
      showStatusIndicator("Game Point Team 1", 0xff5722);
    }
    return;
  }
  
  if ((team2Score === 40 && team1Score < 40) ||
      (team2Score === 30 && team1Score === 0)) {
    if (!gameState.gamePoint) {
      gameState.gamePoint = true;
      showStatusIndicator("Game Point Team 2", 0x2196f3);
    }
    return;
  }
  
  gameState.gamePoint = false;
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
        scene.remove(indicator);
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
        scene.remove(flash);
      }
    };
    fadeOut();
  }, 500);
}

function addToLobby(id, videoElement) {
  const lobbyVideos = document.getElementById('lobby-videos');
  const team1 = document.getElementById('team1') || document.createElement('div');
  team1.id = 'team1';
  team1.className = 'team';
  team1.innerHTML = '<h2>Team 1</h2>';
  const team2 = document.getElementById('team2') || document.createElement('div');
  team2.id = 'team2';
  team2.className = 'team';
  team2.innerHTML = '<h2>Team 2</h2>';

  if (!document.getElementById('team1')) lobbyVideos.appendChild(team1);
  if (!document.getElementById('team2')) lobbyVideos.appendChild(team2);

  const container = document.createElement('div');
  container.className = 'video-container';
  container.appendChild(videoElement);

  const nameElement = document.createElement('div');
  nameElement.className = 'player-name';
  nameElement.textContent = id.slice(-4);
  container.appendChild(nameElement);

  const readyIndicator = document.createElement('div');
  readyIndicator.className = 'ready-indicator';
  readyIndicator.id = `ready-${id}`;
  readyIndicator.textContent = 'Not Ready';
  container.appendChild(readyIndicator);

  // Assign to teams alternately
  const playerIndex = gameState.players.indexOf(id);
  if (playerIndex % 2 === 0) {
    team1.appendChild(container);
  } else {
    team2.appendChild(container);
  }
}

function updateLobby() {
  const totalPlayers = gameState.players.length + 1; // +1 for local
  const allJoined = totalPlayers >= 4;
  const allReady = allJoined && Object.values(readyStates).every(ready => ready);
  document.getElementById('ready-btn').disabled = !allJoined;
  document.getElementById('ready-status').textContent = allJoined ? (allReady ? 'All ready! Starting game...' : 'All players joined! Click ready.') : `Waiting for players... (${totalPlayers}/4)`;

  for (const id in readyStates) {
    const indicator = document.getElementById(`ready-${id}`);
    if (indicator) {
      indicator.textContent = readyStates[id] ? 'Ready' : 'Not Ready';
      indicator.style.color = readyStates[id] ? 'green' : 'red';
    }
  }

  if (allReady) {
    daily.sendData(JSON.stringify({ type: 'start' }));
    startGame();
  }
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

// Start the app
init();