async function binarySearch(low, high, searchFn, loopCallback) {

  let middle;
  const iterate = () => middle = Math.floor((low + high) / 2);
  iterate();
  
  while (middle < high && middle > low) {
    const searchResult = await searchFn(middle, low, high);
    loopCallback?.(middle, searchResult);
    if (searchResult == 1) {
      low = middle;
    } else if (searchResult == -1) {
      high = middle;
    } else {
      return {
        exact: true,
        location: middle
      };
    }
    iterate();
  }
  return {
    exact: false,
    location: middle
  };
}

module.exports = {
  binarySearch
};
