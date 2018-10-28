var Scope = require('../src/scope')

describe('Scope', () => {
  it('can be constructor and used as an object', () => {
    var scope = new Scope();
    scope.aProperty = 1;
    expect(scope.aProperty).toBe(1);
  });
});

