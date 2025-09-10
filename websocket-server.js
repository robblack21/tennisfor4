#!/usr/bin/env node

/**
 * Simple WebSocket Server for Tennis Gesture Sharing
 * Handles real-time pose data synchronization between players
 */

const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected players
const connectedPlayers = new Map();
let playerIdCounter = 0;

console.log('🎾 Tennis WebSocket Server Starting...');

wss.on('connection', function connection(ws, request) {
  const playerId = playerIdCounter++;
  const clientInfo = {
    id: playerId,
    ws: ws,
    joinTime: Date.now(),
    lastPing: Date.now()
  };
  
  connectedPlayers.set(playerId, clientInfo);
  console.log(`✅ Player ${playerId} connected (${connectedPlayers.size} total players)`);
  
  // Send welcome message with assigned player ID
  ws.send(JSON.stringify({
    type: 'welcome',
    playerId: playerId,
    totalPlayers: connectedPlayers.size,
    message: `Welcome Player ${playerId + 1}!`
  }));
  
  // Broadcast player join to all other players
  broadcastToOthers(playerId, {
    type: 'playerJoin',
    playerId: playerId,
    totalPlayers: connectedPlayers.size,
    timestamp: Date.now()
  });
  
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      clientInfo.lastPing = Date.now();
      
      // Handle different message types
      switch (data.type) {
        case 'pose':
          // Broadcast pose data to all other players
          broadcastToOthers(playerId, {
            type: 'pose',
            pose: data.pose,
            playerId: playerId,
            timestamp: data.timestamp || Date.now()
          });
          break;
          
        case 'ballHit':
          // Broadcast ball hit to all players for synchronization
          broadcastToAll({
            type: 'ballHit',
            ballVelocity: data.ballVelocity,
            ballPosition: data.ballPosition,
            playerId: playerId,
            timestamp: data.timestamp || Date.now()
          });
          console.log(`🎾 Player ${playerId} hit the ball!`);
          break;
          
        case 'ping':
          // Respond to ping
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        default:
          console.log(`Received unknown message type: ${data.type} from Player ${playerId}`);
      }
      
    } catch (error) {
      console.error(`Error parsing message from Player ${playerId}:`, error);
    }
  });
  
  ws.on('close', function close() {
    connectedPlayers.delete(playerId);
    console.log(`❌ Player ${playerId} disconnected (${connectedPlayers.size} remaining)`);
    
    // Broadcast player leave to remaining players
    broadcastToAll({
      type: 'playerLeave',
      playerId: playerId,
      totalPlayers: connectedPlayers.size,
      timestamp: Date.now()
    });
  });
  
  ws.on('error', function error(err) {
    console.error(`WebSocket error for Player ${playerId}:`, err);
  });
});

// Broadcast message to all players except sender
function broadcastToOthers(senderId, message) {
  connectedPlayers.forEach((client, id) => {
    if (id !== senderId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending to Player ${id}:`, error);
      }
    }
  });
}

// Broadcast message to all connected players
function broadcastToAll(message) {
  connectedPlayers.forEach((client, id) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error broadcasting to Player ${id}:`, error);
      }
    }
  });
}

// Cleanup disconnected clients periodically
setInterval(() => {
  const now = Date.now();
  const staleClients = [];
  
  connectedPlayers.forEach((client, id) => {
    if (now - client.lastPing > 30000) { // 30 seconds timeout
      staleClients.push(id);
    }
  });
  
  staleClients.forEach(id => {
    console.log(`🧹 Cleaning up stale Player ${id}`);
    const client = connectedPlayers.get(id);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.close();
    }
    connectedPlayers.delete(id);
  });
}, 10000); // Check every 10 seconds

// Start the server
const PORT = 8082;
server.listen(PORT, () => {
  console.log(`🎾 Tennis WebSocket Server running on ws://localhost:${PORT}`);
  console.log('📡 Ready for 4-player gesture synchronization!');
  console.log('🚀 Players can now share tennis swings in real-time');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Tennis WebSocket Server...');
  
  // Close all connections
  connectedPlayers.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close();
    }
  });
  
  server.close(() => {
    console.log('✅ Tennis WebSocket Server shut down cleanly');
    process.exit(0);
  });
});