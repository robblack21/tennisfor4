🍳 Wii-over-VideoCall Demo Recipe

## Project Overview
This project creates a faithful modern replica of Wii Sports Tennis, adapted for a four-player video call experience using MediaPipe hand/pose tracking and Three.js rendering. The goal is to deliver fluidity, authenticity, and fun through deterministic lockstep simulation, ensuring a responsive and engaging multiplayer game.

### Key Principles
- **Fluidity**: 60Hz fixed-step simulation with smooth interpolation for rendering.
- **Authenticity**: Mimic Wii Sports mechanics (swing detection, ball physics, scoring).
- **Fun**: Focus on intuitive controls, visual feedback, and multiplayer interaction.
- **Scalability**: Designed for 4 players via Daily-js data channels and video overlays.

1. Environment

Frontend: Browser (React or vanilla JS for simplicity and performance).

Graphics: Three.js (WebGL-based 3D rendering for court, ball, rackets).

Video + Data: Daily-js (WebRTC video + data channels for real-time sync). Use room: https://vcroom.daily.co/tennisfor4

ML Input: MediaPipe tasks-vision (Pose Landmarker for hand/pose tracking, detecting swings via wrist/elbow positions).

Physics: Fixed-step 2D/3D physics loop (simple ball bounce, racket collision, gravity simulation for realism).

2. Data Flow

Client tick loop (e.g. 60Hz, fixed-step):

Capture pose via Mediapipe → derive swingVector = {angle, velocity, ts}.

Append swingVector to local input buffer.

Broadcast swingVector via DataChannel to all peers.

Wait until swingVectors from all peers for tick t are received.

Advance game simulation (ball + rackets) deterministically.

Render updated state in Three.js.

3. Data Schema

Use tiny packets. JSON first, optimize to binary later.

{
  "t": 123,              // tick number
  "id": "player-2",      // peer ID
  "swing": {
    "angle": 45.2,       // degrees or radians
    "velocity": 3.4,     // normalized speed
    "ts": 1694353456     // timestamp (optional sanity check)
  }
}


Ball state is never sent — derived by sim. Only inputs are exchanged.

4. Core Modules
A. Input
function getSwingVector(poseLandmarks) {
  // Use wrist + elbow positions to derive angle/velocity
  // Smooth with EMA or Kalman filter
  return { angle, velocity, ts: Date.now() };
}

B. Net Sync
// Pseudocode
const inputBuffer = {};

daily.on("data", (msg) => {
  const { t, id, swing } = JSON.parse(msg.data);
  inputBuffer[t][id] = swing;
});

function broadcastSwing(swing, tick) {
  daily.sendData({ t: tick, id: myId, swing });
}

C. Lockstep Loop
const TICK_RATE = 60; // Hz
const MS_PER_TICK = 1000 / TICK_RATE;

setInterval(() => {
  const tick = getCurrentTick();

  // Gather local input
  const swing = getSwingVector(poseLandmarks);
  inputBuffer[tick][myId] = swing;
  broadcastSwing(swing, tick);

  // Wait until all peers' inputs for tick are present
  if (Object.keys(inputBuffer[tick]).length === numPlayers) {
    simulateFrame(inputBuffer[tick]);
    renderFrame();
    delete inputBuffer[tick - 1]; // cleanup
  }
}, MS_PER_TICK);

D. Physics (simplified)
function simulateFrame(inputs) {
  // Update ball based on previous velocity
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Check racket-ball collisions
  for (let id in inputs) {
    if (collision(ball, rackets[id], inputs[id])) {
      reflectBall(ball, inputs[id]);
    }
  }
}

5. Rendering

Three.js scene:

Court (flat plane with net, textures for authenticity).

Ball (sphere with physics-based movement).

Rackets (cylinders or planes, positioned based on player poses).

Camera: Dynamic camera following the ball, with smooth transitions.

Overlay Daily video tiles: Arrange 4 video feeds in a grid or around the court for visibility.

6. Four-Player Extensions

- **Player Positions**: Assign court positions (e.g., top-left, top-right, bottom-left, bottom-right) for doubles-style play.
- **Serving Order**: Rotate serving based on score, with visual indicators.
- **Input Handling**: Each player broadcasts their swing vector; aggregate for simulation.
- **UI Layout**: Responsive video tiles that don't obstruct gameplay; show player names/IDs.
- **Game Modes**: Singles (1v1), Doubles (2v2), with adjustable difficulty.
- **Scoring**: Track points, sets, matches; display on HUD.

7. Fluidity and Authenticity Tips

- **Smoothing**: Use exponential moving averages (EMA) for pose data to reduce jitter.
- **Interpolation**: Render at higher frame rate (e.g., 120Hz) with interpolation between ticks.
- **Audio Feedback**: Add sound effects for swings, bounces, scores (using Web Audio API).
- **Visual Polish**: Particle effects for ball trails, racket impacts; lighting for realism.
- **Latency Compensation**: Predict inputs for smoother experience.

8. MVP Goal

Four peers on a call.

MediaPipe tracks arms → swing vectors for each player.

Swings move 3D rackets in Three.js.

Ball bounces deterministically (lockstep sim) across all players.

Rallies feel fluid, authentic, and fun.

This is the recipe:

Inputs → MediaPipe.

Sync → Daily DataChannel.

State → lockstep deterministic sim.

Render → Three.js.

Once the first rally works, expand to full scoring, doubles mode, and polish.