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
let gameState = { score: [0, 0], serving: 0, players: [], mode: 'doubles' };
let myId;
let currentPose = null;
let audioContext = null;
let readyStates = {};

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
  const vision = await window.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  poseLandmarker = await window.PoseLandmarker.createFromOptions(vision, {
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
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game').appendChild(renderer.domElement);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 10, 0);
  scene.add(directionalLight);

  // Create court
  const courtGeometry = new THREE.PlaneGeometry(20, 10);
  const courtMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.rotation.x = -Math.PI / 2;
  scene.add(court);

  // Create net
  const netGeometry = new THREE.PlaneGeometry(20, 1);
  const netMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const net = new THREE.Mesh(netGeometry, netMaterial);
  net.position.set(0, 0.5, 0);
  scene.add(net);

  // Create ball
  const ballGeometry = new THREE.SphereGeometry(0.1);
  const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
  ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.position.set(0, 0.5, 0);
  ball.velocity = new THREE.Vector3(0.1, 0, 0.05);
  scene.add(ball);

  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
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
    // Create racket for new player
    const racketGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1);
    const racketMaterial = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
    const racket = new THREE.Mesh(racketGeometry, racketMaterial);

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
    ball.position.y = 0.1;
    ball.velocity.y *= -0.8; // Bounce with damping
    playSound(200, 0.1); // Bounce sound
  }

  // Check side boundaries
  if (Math.abs(ball.position.x) > 10) {
    ball.velocity.x *= -1;
    ball.position.x = Math.sign(ball.position.x) * 10;
  }

  // Check front/back boundaries
  if (Math.abs(ball.position.z) > 5) {
    ball.velocity.z *= -1;
    ball.position.z = Math.sign(ball.position.z) * 5;
  }

  // Check racket collisions
  for (let id in inputs) {
    const racket = rackets[id];
    if (racket && ball.position.distanceTo(racket.position) < 1) {
      // Reflect ball based on swing
      const swing = inputs[id];
      ball.velocity.x += Math.cos(swing.angle * Math.PI / 180) * swing.velocity * 0.1;
      ball.velocity.z += Math.sin(swing.angle * Math.PI / 180) * swing.velocity * 0.1;
      ball.velocity.y += 0.5; // Add some upward force
      playSound(400, 0.2); // Swing sound
    }
  }

  // Scoring
  if (ball.position.z > 5) {
    gameState.score[0]++;
    gameState.serving = (gameState.serving + 1) % gameState.players.length;
    resetBall();
    updateUI();
  } else if (ball.position.z < -5) {
    gameState.score[1]++;
    gameState.serving = (gameState.serving + 1) % gameState.players.length;
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

  renderer.render(scene, camera);
}

function updateUI() {
  document.getElementById('score').textContent = `${gameState.score[0]}-${gameState.score[1]}`;
  document.getElementById('players').textContent = gameState.players.length + 1;
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
  const allReady = Object.values(readyStates).every(ready => ready) && gameState.players.length + 1 >= 4;
  document.getElementById('ready-btn').disabled = !allReady;
  document.getElementById('ready-status').textContent = allReady ? 'All ready! Click to start.' : 'Waiting for all players to be ready...';

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

  setupGameLoop();
}

// Start the app
init();