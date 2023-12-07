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
