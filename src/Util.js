exports.timeout = ms => new Promise((resolve) => { setTimeout(resolve, ms); });

exports.timeoutRace = (promise, ms) => {
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      exports.timeout(ms).then(() => reject(new Error('timeout')));
    }),
  ]);
};

exports.defineOnce = (socket) => {
  return Object.defineProperty(socket, 'once', {
    value: (event, fn) => {
      const onData = (buff) => {
        socket.off(event, onData);
        fn(buff);
      };
      socket.on(event, onData);
    },
  });
};

exports.bufferDataLine = (buffer, data, onLine) => {
  for (const ch of data) {
    if (ch === '\r' || ch === '\n' || ch === '\0') {
      onLine(buffer);
      buffer = '';
    } else if (ch === '\x08' || ch === '\x7f') {
      buffer = buffer.slice(0, -1);
    } else if (ch === '\x1b') {
      // ignore
    } else {
      buffer += ch;
    }
  }

  return buffer;
};
