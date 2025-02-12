const timeoutPromise = (timeLimitMs, resolveTrigger) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Promise exceeded time limit')), timeLimitMs);
    resolveTrigger.timer = timeout;
  });
// Must provide a function such that a fresh thenable can be created upon invocation
function retryable(asyncFunction, timeLimitMs = 10000, retryCount = 2) {
  if (retryCount < 0) {
    return Promise.reject(new Error('Exceeded retry count'));
  }
  const resolveTrigger = {};
  return new Promise((resolve, reject) => {
    Promise.race([asyncFunction(), timeoutPromise(timeLimitMs, resolveTrigger)])
      // asyncFunction was successful
      .then((v) => {
        clearTimeout(resolveTrigger.timer);
        resolve(v);
      })
      // asyncFunction failed or timed out, retry
      .catch((e) => {
        clearTimeout(resolveTrigger.timer);
        // console.log('[retryable] Error encountered, retrying: ', retryCount - 1, e);
        retryable(asyncFunction, timeLimitMs, retryCount - 1)
          .then(resolve)
          .catch(reject);
      });
  });
}

module.exports = retryable;
