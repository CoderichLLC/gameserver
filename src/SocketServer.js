const HTTP = require('http');
const Crypto = require('crypto');
const EventEmitter = require('events');
const SocketIO = require('socket.io');
const Util = require('./Util');

class WebSocket {
  constructor(config) {
    this.id = Crypto.randomBytes(12).toString('hex');
    this.kind = 'socket';
    this.socket = config.socket;
  }

  emit(...args) {
    this.socket.emit(...args);
  }

  write(line) {
    this.socket.emit('write', line);
  }

  writeln(line) {
    this.socket.emit('writeln', line);
  }

  prompt(data, ms) {
    return this.query('prompt', data, ms);
  }

  query(event, data, ms) {
    return Util.timeoutRace(new Promise((resolve, reject) => {
      this.socket.once(event, resolve);
      this.emit(event, data);
    }), ms);
  }

  disconnect(...args) {
    this.socket.disconnect(...args);
  }
}

module.exports = class SocketServer extends EventEmitter {
  #config;
  #sockets = [];
  #httpServer;
  #socketServer;

  constructor(config = {}) {
    super();
    this.#config = config;
    this.#httpServer = HTTP.createServer();
    this.#socketServer = SocketIO(this.#httpServer);

    this.#socketServer.on('connection', (sock) => {
      const socket = new WebSocket({ socket: sock });
      this.#sockets.push(socket);
      this.emit('connect', { socket });

      sock.onAny((eventName, data) => {
        this.emit(eventName, { socket, data });
      });

      sock.on('disconnecting', (reason) => {
        this.emit('disconnecting', { socket, reason });
      });

      sock.on('disconnect', (reason) => {
        this.emit('disconnect', { socket, reason });
      });
    });
  }

  start(port = this.#config.port) {
    return new Promise((resolve, reject) => {
      this.#httpServer.once('listening', resolve);
      this.#httpServer.listen(port);
    });
  }

  stop() {
    this.#sockets.forEach(socket => socket.disconnect(true));

    return new Promise((resolve, reject) => {
      this.#socketServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};
