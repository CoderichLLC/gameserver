const HTTP = require('http');
const EventEmitter = require('events');
const SocketIO = require('socket.io');

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

    this.#socketServer.on('connection', (socket) => {
      this.#sockets.push(socket);
      this.emit('connect', { socket });

      socket.onAny((eventName, data) => {
        this.emit(eventName, { socket, data });
      });

      socket.on('disconnecting', (reason) => {
        this.emit('disconnecting', { socket, reason });
      });

      socket.on('disconnect', (reason) => {
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
