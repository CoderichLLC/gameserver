const SocketServer = require('./SocketServer');
const TelnetServer = require('./TelnetServer');

const serverMap = { socket: SocketServer, telnet: TelnetServer };

class Server {
  constructor(config = {}) {
    const servers = Object.entries(config).map(([key, value]) => new serverMap[key](value));

    return new Proxy(this, {
      get(target, method, rec) {
        switch (method) {
          case 'start': return () => Promise.all(servers.map(server => server.start()));
          case 'stop': return () => Promise.all(servers.map(server => server.stop()));
          case 'once': return (name, listener) => {
            let done = false;
            servers.map(server => server.once(name, function proxy(...args) {
              if (!done) {
                done = true;
                servers.map(s => s.off(name, proxy));
                listener(...args);
              }
            }));
          };
          case 'then': return Reflect.get(target, method, rec);
          default: return (...args) => {
            return servers.map(server => server[method].call(server, ...args)).shift();
          };
        }
      },
    });
  }
}

(async () => {
  if (require.main === module) {
    new Server({
      telnet: { port: 23, namespace: 'telnet' },
      socket: { port: 3000 },
    }).start();
  }
})();

module.exports = Server;
