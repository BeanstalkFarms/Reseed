async function runBatchPromises(promiseGenerators, batchSize, resultCallback) {
  while (promiseGenerators.length > 0) {
    const results = await Promise.all(promiseGenerators.splice(0, Math.min(batchSize, promiseGenerators.length)).map(p => p()));
    resultCallback && results.forEach(resultCallback);
  }
}

module.exports = {
  runBatchPromises
}
