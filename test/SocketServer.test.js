const SocketClient = require('socket.io-client');
const SocketServer = require('../src/SocketServer');

describe('SocketServer', () => {
  const onData = jest.fn();
  const onConnect = jest.fn();
  const onDisconnect = jest.fn();
  const server = new SocketServer({ port: 3000 });
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
    const client = SocketClient.io('http://localhost:3000');

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

      // Query/Response
      const response = await socket.query('username');
      expect(response).toBe('username');
      await expect(socket.query('password', {}, 100)).rejects.toThrow('timeout');

      socket.emit('data', { goodbye: 'test' });
    });

    client.on('username', () => {
      client.emit('username', 'username');
    });

    client.on('data', (data) => {
      expect(data).toMatchObject({ goodbye: 'test' });
      done();
    });
  });

  test('stop', async () => {
    await server.stop();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(1).toBe(1);
  });
});
