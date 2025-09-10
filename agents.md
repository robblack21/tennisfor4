# Agent Handover: Four-Player Wii Sports Tennis Replica

## Project Overview
This project creates a faithful modern replica of Wii Sports Tennis adapted for a four-player video call experience using MediaPipe hand/pose tracking and Three.js rendering. The goal is to deliver fluidity, authenticity, and fun through deterministic lockstep simulation.

**Live Demo:** https://localhost:8080 (requires HTTPS certificate acceptance)
**Daily Room:** https://vcroom.daily.co/tennisfor4

## Current Implementation Status ✅

### Core Features Completed
- ✅ **HTTPS Server Setup** - Self-signed SSL certificates for WebRTC compatibility
- ✅ **Daily-js Integration** - WebRTC video call and data channel synchronization
- ✅ **Lobby System** - Team-based player arrangement (Team 1/2, Slots 1/2), ready states
- ✅ **Three.js 3D Scene** - Court, ball, rackets, dynamic camera following ball
- ✅ **Physics Engine** - Ball movement, gravity, collisions, racket interactions
- ✅ **Multiplayer Sync** - Lockstep simulation for deterministic gameplay
- ✅ **Game Logic** - Scoring, serving rotation, singles (1v1) and doubles (2v2) modes
- ✅ **UI Framework** - Wii-themed styling with gradients, rounded elements
- ✅ **Audio Feedback** - Sound effects for bounces and swings
- ✅ **MediaPipe Integration** - Pose tracking for swing detection (with fallback)

### Architecture
- **Frontend:** Vanilla JavaScript with ES modules
- **Graphics:** Three.js WebGL rendering
- **Video:** Daily-js WebRTC
- **ML:** MediaPipe tasks-vision for pose detection
- **Physics:** Custom 2D/3D physics simulation
- **Sync:** Lockstep multiplayer with data channels
- **Server:** HTTP-Server with SSL

### File Structure
```
/Users/robblack/tennisfor4/
├── readme.md              # Architecture documentation
├── package.json           # Dependencies and scripts
├── public/
│   ├── index.html         # Main HTML with Wii styling
│   ├── main.js            # Core application logic
│   ├── assets/            # Wii Sports screenshots (visual references)
│   ├── key.pem            # SSL private key
│   └── cert.pem           # SSL certificate
├── src/
│   └── main.js            # Original source (moved to public/)
└── assets/
    └── sampleimages/      # Wii Sports reference images
```

## Known Issues & Limitations
- **MediaPipe Loading:** Occasional failures with CDN loading - has fallback to random inputs
- **Pose Detection:** May require camera permissions and good lighting
- **Browser Compatibility:** Requires modern browser with WebRTC support
- **Performance:** 60Hz simulation may need optimization for lower-end devices
- **Daily.js Connection:** Occasional issues with video feed display and player synchronization

## TODOs for Visual & UX Improvements 🎨

### High Priority
- [ ] **Wii Sports Asset Integration**
  - Replace placeholder 3D models with Wii-style tennis rackets
  - Add Wii Sports character models/avatars
  - Implement authentic Wii Sports sound effects
  - Add particle effects for ball trails and impacts

- [ ] **UI Polish**
  - Create authentic Wii Sports menu styling
  - Add player selection screens with Mii-like avatars
  - Implement Wii Sports scoring display animations
  - ✅ Add game mode selection (Singles/Doubles/Tournament)

- [ ] **Visual Effects**
  - Add court texture and lighting to match Wii Sports
  - Implement camera shake on ball impacts
  - Add crowd/background elements
  - Create smooth transitions between lobby and game

### Medium Priority
- [ ] **Animation Improvements**
  - Add racket swing animations
  - Implement ball spin and bounce effects
  - Create victory/defeat animations
  - Add loading screens with Wii Sports branding

- [ ] **Accessibility**
  - Add keyboard/mouse fallback controls
  - Improve mobile responsiveness
  - Add screen reader support
  - Implement difficulty settings

### Low Priority
- [ ] **Advanced Features**
  - Add power-ups and special shots
  - Implement tournament mode with multiple rounds
  - Add player statistics and leaderboards
  - Create replay system

## How to Run & Test

### Prerequisites
- Node.js installed
- Modern web browser (Chrome recommended)
- Webcam access for pose tracking

### Setup
```bash
npm install
npm run dev  # Runs on http://localhost:8080
```

### Testing
1. Open https://localhost:8080 in multiple browser tabs
2. Accept SSL certificate warning
3. Allow camera/microphone permissions
4. Join the Daily room: https://vcroom.daily.co/tennisfor4
5. Wait for 4 players to join
6. Click "Ready" when all players are present
7. Start playing tennis with pose gestures

### Development
- Server runs on HTTPS with self-signed certificates
- Hot reload available via http-server
- Console logs available for debugging
- MediaPipe fallback prevents crashes if pose detection fails

## Technical Notes
- **Lockstep Sync:** Uses tick-based simulation with input buffering
- **Data Channels:** JSON packets for swing vectors and game state
- **Physics:** Simple gravity + collision detection
- **Rendering:** 60Hz fixed timestep with interpolation
- **Audio:** Web Audio API for procedural sound generation

## Next Steps for Agent
1. Review current implementation at https://localhost:8080
2. Focus on visual authenticity using Wii Sports reference images in assets/
3. Enhance UI/UX with Wii Sports branding and animations
4. Test multiplayer functionality with both singles (1v1) and doubles (2v2) modes
5. Fix remaining Daily.js connection issues and player feed display
6. Optimize performance and add polish features

The core multiplayer tennis gameplay is functional with support for both singles and doubles modes - focus efforts on making it look and feel like authentic Wii Sports!