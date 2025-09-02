const TelnetLib = require('telnetlib');
const TelnetServer = require('../src/TelnetServer');

const port = 2233;
const { GMCP, ECHO, SGA } = TelnetServer.options;

describe('TelnetServer', () => {
  const onData = jest.fn();
  const onConnect = jest.fn();
  const onDisconnect = jest.fn();
  const server = new TelnetServer({
    port,
    namespace: 'telnet',
    localOptions: [GMCP, ECHO, SGA],
    remoteOptions: [GMCP, ECHO, SGA],
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

  test('client', (done) => {
    let gmcp;

    server.once('connect', () => {
      expect(onData).not.toHaveBeenCalled();
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();
      gmcp.send('telnet', 'data', { hello: 'world' });
    });

    server.once('data', async ({ socket, data }) => {
      expect(data).toMatchObject({ hello: 'world' });
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onDisconnect).not.toHaveBeenCalled();

      // Query/Response
      const response = await socket.query('username');
      expect(response).toBe('username');
      await expect(socket.query('password', {}, 100)).rejects.toThrow('timeout');

      socket.emit('data', { goodbye: 'test' });
    });

    const client = TelnetLib.createConnection({ port, remoteOptions: [GMCP], localOptions: [GMCP] }, async () => {
      gmcp = client.getOption(GMCP);

      gmcp.on('gmcp/telnet.username', (data) => {
        gmcp.send('telnet', 'username', 'username');
      });

      gmcp.on('gmcp/telnet.data', (data) => {
        expect(data).toMatchObject({ goodbye: 'test' });
        done();
      });
    });
  });

  test('stop', async () => {
    await server.stop();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(1).toBe(1);
  });
});
