var Scope = require('../src/scope');

describe('Scope', function() {
  it('can be constructor and used as an object', function() {
    var scope = new Scope();
  });
});

describe('digest', function() {
  var scope;
  beforeEach(function() {
    scope = new Scope();
  });

  it('call the listener function of a watch on the first $digest', function() {
    var watchFn = function() {return 'wat';};
    var listenerFn = jasmine.createSpy();
    
    scope.$watch(watchFn, listenerFn);
    // expect(listenerFn).toHaveBeenCalled();
  });

  it('calls the watch function with the scope as the argument', function(){
    var watchFn = jasmine.createSpy();
    var listenerFn = function(){};
    scope.$watch(watchFn, listenerFn);
    scope.$digest();
    expect(watchFn).toHaveBeenCalledWith(scope);
  });

  it('calls the listener function when the watched value changes', () => {
    scope.someValue = 'a';
    scope.counter = 0;
     
    scope.$watch(
      (scope) => scope.someValue,
      (newValue, oldValue, scope) => scope.counter++
    );

    expect(scope.counter).toBe(0);

  });
});
