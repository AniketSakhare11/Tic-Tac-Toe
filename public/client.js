const socket = io();

// DOM Elements
const loginSection = document.getElementById('login-section');
const lobbySection = document.getElementById('lobby-section');
const gameSection = document.getElementById('game-section');

// Login
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

// Lobby
const playerGreeting = document.getElementById('player-greeting');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// Game
const roomIdDisplay = document.getElementById('room-id-display');
const turnIndicator = document.getElementById('turn-indicator');
const boardDiv = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const gameOverMessage = document.getElementById('game-over-message');
const winnerText = document.getElementById('winner-text');
const playAgainBtn = document.getElementById('play-again-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

// Chat
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// State
let myUsername = '';
let mySymbol = '';
let currentTurn = '';
let isMyTurn = false;
let isPlaying = false;

// Sections Utility
function showSection(sectionId) {
  document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
}

// --- LOGIN ---
loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    socket.emit('set_username', username, (response) => {
      if (response.success) {
        myUsername = username;
        playerGreeting.innerText = `Hello, ${username}!`;
        showSection('lobby-section');
      }
    });
  }
});

// --- LOBBY ---
createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room', (response) => {
    if (response.success) {
      mySymbol = 'X';
      roomIdDisplay.innerText = response.roomId;
      turnIndicator.innerText = "Waiting for opponent...";
      turnIndicator.className = '';
      resetBoard();
      showSection('game-section');
      addSystemMessage("Room created. Waiting for someone to join...");
    }
  });
});

joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code) {
    socket.emit('join_room', code, (response) => {
      if (response.success) {
        mySymbol = response.symbol;
        roomIdDisplay.innerText = response.roomId;
        resetBoard();
        showSection('game-section');
      } else {
        alert(response.message);
      }
    });
  }
});

socket.on('leaderboard_update', (data) => {
  // data is { username: wins }
  leaderboardList.innerHTML = '';
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  sorted.forEach(([user, wins]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${user}</span> <strong>${wins} W</strong>`;
    leaderboardList.appendChild(li);
  });
});

// --- GAME ---
socket.on('game_start', (data) => {
  isPlaying = true;
  currentTurn = data.turn;
  updateTurnIndicator();
  addSystemMessage("Game started!");
});

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (!isPlaying) return;
    const index = cell.getAttribute('data-index');
    if (isMyTurn && cell.innerText === '') {
      socket.emit('make_move', index);
    }
  });
});

socket.on('update_board', (data) => {
  // data can be an array (board) or object {board, turn}
  const board = data.board || data;
  board.forEach((val, i) => {
    const cell = cells[i];
    if (val !== '' && cell.innerText === '') {
      cell.innerText = val;
      cell.classList.add(val.toLowerCase());
    } else if (val === '') {
      cell.innerText = '';
      cell.className = 'cell';
    }
  });

  if (data.turn) {
    currentTurn = data.turn;
    updateTurnIndicator();
  }
});

socket.on('game_over', (data) => {
  isPlaying = false;
  if (data.winnerSymbol === 'Draw') {
    winnerText.innerText = "It's a Draw!";
    winnerText.className = '';
    addSystemMessage("Game ended in a draw.");
  } else {
    winnerText.innerText = `${data.winner} (${data.winnerSymbol}) Wins!`;
    winnerText.className = `turn-${data.winnerSymbol.toLowerCase()}`;
    addSystemMessage(`${data.winner} won the game!`);
  }
  gameOverMessage.classList.remove('hidden');
  turnIndicator.innerText = "Game Over";
  turnIndicator.className = '';
  
  // Reset for the next match handled by leaving room for simplicity, 
  // or we could add a play again button logic.
});

socket.on('player_left', () => {
  isPlaying = false;
  turnIndicator.innerText = "Opponent left. Waiting...";
  turnIndicator.className = '';
  resetBoard();
});

leaveRoomBtn.addEventListener('click', () => {
  // Simplest way to leave is to reload or we can emit a leave event
  window.location.reload();
});

function updateTurnIndicator() {
  isMyTurn = (currentTurn === mySymbol);
  if (isMyTurn) {
    turnIndicator.innerText = "Your Turn!";
  } else {
    turnIndicator.innerText = "Opponent's Turn";
  }
  turnIndicator.className = `turn-${currentTurn.toLowerCase()}`;
}

function resetBoard() {
  cells.forEach(cell => {
    cell.innerText = '';
    cell.className = 'cell';
  });
  gameOverMessage.classList.add('hidden');
  chatMessages.innerHTML = '';
}

// --- CHAT ---
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit('send_chat', msg);
    chatInput.value = '';
  }
}

socket.on('chat_message', (data) => {
  const div = document.createElement('div');
  div.classList.add('chat-msg');
  if (data.username === 'System') {
    div.classList.add('system');
    div.innerText = data.message;
  } else {
    if (data.username === myUsername) div.classList.add('self');
    div.innerHTML = `<strong>${data.username}</strong>${data.message}`;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function addSystemMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('chat-msg', 'system');
  div.innerText = msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
