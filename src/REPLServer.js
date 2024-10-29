const Net = require('net');
const Crypto = require('crypto');
const EventEmitter = require('events');
const Util = require('./Util');

class Socket {
  #config;

  constructor(config) {
    this.id = Crypto.randomBytes(12).toString('hex');
    this.#config = config;
  }

  emit(event, data) {
    this.#config.socket.write(data);
  }

  query(event, data, ms) {
    return Util.timeoutRace(new Promise((resolve) => {
      this.#config.socket.once('data', response => resolve(response.toString().trim()));
      this.emit(event, data);
    }), ms);
  }

  disconnect(reason) {
    const { socket } = this.#config;
    Object.assign(socket, { reason }).end();
  }
}

module.exports = class REPLServer extends EventEmitter {
  #config;
  #server;
  #sockets = [];

  constructor(config = {}) {
    super();
    this.#config = config;
    this.#server = Net.createServer((sock) => {
      const socket = new Socket({ socket: sock });
      this.#sockets.push(socket);
      this.emit('connect', { socket });

      sock.on('data', (data) => {
        this.emit('data', { socket, data: data.toString().trim() });
      });

      sock.on('error', (error) => {
        this.emit('error', { socket, error });
      });

      sock.on('end', () => {
        this.emit('disconnect', { socket, reason: sock.reason });
      });
    });
  }

  start(port = this.#config.port) {
    return new Promise((resolve, reject) => {
      this.#server.once('listening', resolve);
      this.#server.listen(port);
    });
  }

  stop() {
    this.#sockets.forEach(socket => socket.disconnect('server disconnect'));

    return new Promise((resolve, reject) => {
      this.#server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};
