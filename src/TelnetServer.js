const Crypto = require('crypto');
const EventEmitter = require('events');
const TelnetLib = require('telnetlib');
const Util = require('./Util');

const { GMCP, ECHO } = TelnetLib.options;

class TelnetSocket {
  #config;

  constructor(config) {
    this.id = Crypto.randomBytes(12).toString('hex');
    this.kind = 'telnet';
    this.#config = config;
  }

  gmcp(ns, event, data) {
    if (this.#config.socket.gmcpEnabled) this.#config.gmcp.send(ns, event, data);
  }

  write(line) {
    this.#config.socket.write(line);
  }

  writeln(line) {
    this.#config.socket.write(`${line}\r\n`);
  }

  emit(event, data) {
    this.#config.gmcp.send(this.#config.namespace, event, data);
  }

  prompt(data, ms) {
    return Util.timeoutRace(new Promise((resolve) => {
      this.#config.socket.once('data', buff => resolve(buff.toString().trim()));
      this.writeln(data);
    }), ms);
  }

  query(event, data, ms) {
    const { gmcp, socket, namespace } = this.#config;

    return Util.timeoutRace(new Promise((resolve) => {
      if (socket.gmcpEnabled) {
        gmcp.once(`gmcp/${namespace}.${event}`, resolve);
        this.emit(event, data);
      } else {
        socket.once('data', buff => resolve(buff.toString().trim()));
        this.writeln(data);
      }
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
      Util.defineOnce(sock);
      const gmcp = sock.getOption(GMCP);
      const socket = new TelnetSocket({ socket: sock, gmcp, ...this.#config });
      this.#sockets.push(socket);

      sock.on('enable', (opt, at) => {
        if (opt === GMCP) sock.gmcpEnabled = true;
      });

      sock.on('disable', (opt, at) => {
        if (opt === GMCP) sock.gmcpEnabled = false;
      });

      sock.on('negotiated', () => {
        this.emit('connect', { socket });
      });

      gmcp.on('gmcp', (ns, event, data) => {
        this.emit(`gmcp/${ns}.${event}`, { socket, data });
        if (ns === config.namespace) this.emit(event, { socket, data });
      });

      sock.on('data', (buff) => {
        this.emit('data', { socket, data: buff.toString().trim() });
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
