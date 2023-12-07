const HTTP = require('http');
const EventEmitter = require('events');
const SocketIO = require('socket.io');
const Util = require('./Util');

class WebSocket {
  #config;

  constructor(config) {
    this.#config = config;
  }

  emit(...args) {
    this.#config.socket.emit(...args);
  }

  query(event, data, ms) {
    return Util.timeoutRace(new Promise((resolve, reject) => {
      this.#config.socket.once(event, resolve);
      this.#config.socket.emit(event, data);
    }), ms);
  }

  disconnect(...args) {
    this.#config.socket.disconnect(...args);
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
