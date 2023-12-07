const Crypto = require('crypto');
const EventEmitter = require('events');
const TelnetLib = require('telnetlib');
const Util = require('./Util');

const { GMCP, ECHO } = TelnetLib.options;

class TelnetSocket {
  #config;

  constructor(config) {
    this.id = Crypto.randomBytes(12).toString('hex');
    this.#config = config;
  }

  emit(event, data) {
    this.#config.gmcp.send(this.#config.namespace, event, data);
  }

  query(event, data, ms) {
    return Util.timeoutRace(new Promise((resolve) => {
      this.#config.gmcp.once(`gmcp/${this.#config.namespace}.${event}`, resolve);
      this.#config.gmcp.send(this.#config.namespace, event, data);
    }), ms);
  }

  disconnect(reason) {
    const { socket } = this.#config;
    Object.assign(socket, { reason }).end();
  }
}

module.exports = class TelnetServer extends EventEmitter {
  #config;
  #server;
  #sockets = [];

  constructor(config) {
    super();
    this.#config = config;

    this.#server = TelnetLib.createServer({
      localOptions: [GMCP, ECHO],
      remoteOptions: [GMCP, ECHO],
    }, (sock) => {
      const gmcp = sock.getOption(GMCP);
      const socket = new TelnetSocket({ socket: sock, gmcp, ...this.#config });
      this.#sockets.push(socket);

      sock.on('negotiated', () => {
        this.emit('connect', { socket });
      });

      gmcp.on('gmcp', (ns, event, data) => {
        if (ns === config.namespace) this.emit(event, { socket, data });
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
