const TelnetLib = require('telnetlib');
const SocketClient = require('socket.io-client');
const Server = require('../src/Server');

const { GMCP } = TelnetLib.options;

describe('Server', () => {
  const onData = jest.fn();
  const onConnect = jest.fn();
  const onDisconnect = jest.fn();
  const server = new Server({
    socket: { port: 3001 },
    telnet: { port: 22, namespace: 'telnet' },
  });
  server.on('data', onData);
  server.on('connect', onConnect);
  server.on('disconnect', onDisconnect);

  beforeEach(() => {
    onData.mockClear();
    onConnect.mockClear();
    onDisconnect.mockClear();
  });

  test('start', async () => {
    await server.start();
    expect(1).toBe(1);
  });

  test('socket client', (done) => {
    const client = SocketClient.io('http://localhost:3001');

    server.once('connect', () => {
      expect(onData).not.toHaveBeenCalled();
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();
      client.emit('data', { hello: 'world' });
    });

    server.once('data', async ({ socket, data }) => {
      expect(data).toMatchObject({ hello: 'world' });
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();
      socket.emit('data', { goodbye: 'test' });
      done();
    });
  });

  test('telnet client', (done) => {
    let gmcp;

    server.once('connect', () => {
      expect(onData).not.toHaveBeenCalled();
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();
      gmcp.send('telnet', 'data', { hello: 'world' });
    });

    server.once('data', ({ socket, data }) => {
      expect(data).toMatchObject({ hello: 'world' });
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();
      socket.emit('data', { goodbye: 'test' });
    });

    const client = TelnetLib.createConnection({ port: 22, remoteOptions: [GMCP] }, async () => {
      gmcp = client.getOption(GMCP);

      gmcp.on('gmcp/telnet.data', (data) => {
        expect(data).toMatchObject({ goodbye: 'test' });
        done();
      });
    });
  });

  test('stop', async () => {
    await server.stop();
    expect(onDisconnect).toHaveBeenCalledTimes(2);
    expect(1).toBe(1);
  });
});
