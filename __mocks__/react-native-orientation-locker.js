module.exports = {
  lockToPortrait: jest.fn(),
  lockToLandscape: jest.fn(),
  lockToLandscapeLeft: jest.fn(),
  lockToLandscapeRight: jest.fn(),
  unlockAllOrientations: jest.fn(),
  getOrientation: jest.fn(callback => callback && callback('PORTRAIT')),
  addOrientationListener: jest.fn(),
  removeOrientationListener: jest.fn(),
};
