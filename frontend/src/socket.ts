import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocketUrl() {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  return undefined;
}

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(getSocketUrl(), {
      auth: { token },
      autoConnect: false,
      path: '/socket.io',
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
