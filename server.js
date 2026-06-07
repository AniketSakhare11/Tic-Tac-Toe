const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// State
const leaderboard = {};
const rooms = {};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

function checkWinner(board) {
  for (let combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (!board.includes('')) return 'Draw';
  return null;
}

function updateLeaderboard(username) {
  if (!leaderboard[username]) {
    leaderboard[username] = 0;
  }
  leaderboard[username]++;
  io.emit('leaderboard_update', leaderboard);
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('set_username', (username, callback) => {
    socket.username = username;
    if (!leaderboard[username]) leaderboard[username] = 0;
    callback({ success: true });
    socket.emit('leaderboard_update', leaderboard);
  });

  socket.on('create_room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = {
      players: [{ id: socket.id, username: socket.username, symbol: 'X' }],
      board: Array(9).fill(''),
      turn: 'X',
      status: 'waiting'
    };
    socket.join(roomId);
    socket.roomId = roomId;
    callback({ success: true, roomId });
  });

  socket.on('join_room', (roomId, callback) => {
    const room = rooms[roomId];
    if (!room) {
      return callback({ success: false, message: 'Room not found.' });
    }
    if (room.players.length >= 2) {
      return callback({ success: false, message: 'Room is full.' });
    }

    const symbol = room.players[0].symbol === 'X' ? 'O' : 'X';
    room.players.push({ id: socket.id, username: socket.username, symbol });
    room.status = 'playing';
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    callback({ success: true, roomId, symbol });
    
    io.to(roomId).emit('game_start', {
      players: room.players,
      turn: room.turn,
      board: room.board
    });
  });

  socket.on('make_move', (index) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== room.turn || room.board[index] !== '') return;

    room.board[index] = player.symbol;
    
    const winnerSymbol = checkWinner(room.board);
    if (winnerSymbol) {
      room.status = 'finished';
      let winnerUsername = null;
      if (winnerSymbol !== 'Draw') {
        const winner = room.players.find(p => p.symbol === winnerSymbol);
        winnerUsername = winner.username;
        updateLeaderboard(winnerUsername);
      }
      io.to(roomId).emit('update_board', room.board);
      io.to(roomId).emit('game_over', { winner: winnerUsername, winnerSymbol, board: room.board });
    } else {
      room.turn = room.turn === 'X' ? 'O' : 'X';
      io.to(roomId).emit('update_board', { board: room.board, turn: room.turn });
    }
  });

  socket.on('send_chat', (message) => {
    const roomId = socket.roomId;
    if (roomId) {
      io.to(roomId).emit('chat_message', { username: socket.username, message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('chat_message', { username: 'System', message: `${socket.username} has left the game.` });
        io.to(roomId).emit('player_left');
        room.status = 'waiting';
        room.board = Array(9).fill('');
        room.turn = 'X';
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
