const Crypto = require('crypto');
const EventEmitter = require('events');
const TelnetLib = require('telnetlib');
const Util = require('./Util');

const dataSymbol = Symbol('data');
const { GMCP, ECHO, SGA } = TelnetLib.options;

class TelnetSocket {
  constructor(config) {
    this.id = Crypto.randomBytes(12).toString('hex');
    this.kind = 'telnet';
    this.buffer = '';
    this.socket = config.socket;
    this.namespace = config.namespace;
  }

  getOption(kind) {
    return this.socket.getOption(kind);
  }

  gmcp(ns, event, data) {
    const gmcp = this.socket.getOption(GMCP);
    if (gmcp.enabledRemote) gmcp.send(ns, event, data);
  }

  write(line) {
    this.socket.write(line);
  }

  writeln(line) {
    this.socket.write(`${line}\r\n`);
  }

  emit(event, data) {
    const gmcp = this.socket.getOption(GMCP);
    if (gmcp.enabledRemote) gmcp.send(this.namespace, event, data);
  }

  prompt(data, ms) {
    return Util.timeoutRace(new Promise((resolve) => {
      this.socket.once(dataSymbol, resolve);
      this.write(data);
    }), ms);
  }

  query(event, data, ms) {
    const gmcp = this.socket.getOption(GMCP);

    return Util.timeoutRace(new Promise((resolve) => {
      if (gmcp.enabledRemote) {
        gmcp.once(`gmcp/${this.namespace}.${event}`, resolve);
        this.emit(event, data);
      } else {
        this.socket.once(dataSymbol, resolve);
        this.writeln(data);
      }
    }), ms);
  }

  disconnect(reason) {
    Object.assign(this.socket, { reason }).end();
  }
}

module.exports = class TelnetServer extends EventEmitter {
  #config;
  #server;
  #sockets = [];

  constructor(config) {
    super();
    this.#config = config;
    const { namespace, localOptions, remoteOptions } = this.#config;

    this.#server = TelnetLib.createServer({ localOptions, remoteOptions }, (sock) => {
      Util.defineOnce(sock);
      const gmcp = sock.getOption(GMCP);
      const socket = new TelnetSocket({ socket: sock, namespace });
      this.#sockets.push(socket);

      sock.on('negotiated', () => {
        this.emit('connect', { socket });
      });

      sock.on('data', (buff) => {
        const data = buff.toString('utf8');
        if (sock.getOption(ECHO).enabledLocal) this.emit('echo', { socket, data });
        if (sock.getOption(SGA).enabledRemote) socket.buffer = Util.bufferDataLine(socket.buffer, data, line => this.emit('data', { socket, data: line }));
        else this.emit('data', { socket, data: data.trim() });
      });

      sock.on('error', (error) => {
        this.emit('error', { socket, error });
      });

      sock.on('end', () => {
        this.emit('disconnect', { socket, reason: sock.reason });
      });

      gmcp.on('gmcp', (ns, event, data) => {
        this.emit(`gmcp/${ns}.${event}`, { socket, data });
        if (ns === namespace) this.emit(event, { socket, data });
      });
    });

    this.on('data', ({ socket, data }) => {
      socket.socket.emit(dataSymbol, data);
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

  static options = TelnetLib.options;
};
