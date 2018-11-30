var _ = require('lodash');
var Scope = require('../src/scope');

describe('Scope', function() {
  /* 
              ============================================
                                Chapter 1 
                        dirty-check $watch $digest
              ============================================
  */

  describe('digest', function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    // 第一次调用 $digest 的时候 需要调用一下 listenerFn
    it('call the listener function of a watch on the first $digest', function() {
      var watchFn = function() {return 'wat';};
      var listenerFn = jasmine.createSpy();
      
      scope.$watch(watchFn, listenerFn);
      scope.$digest();
      expect(listenerFn).toHaveBeenCalled();
    });

    // 调用 watchFn 的时候要把 scope作为参数传入
    it('calls the watch function with the scope as the argument', function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = function(){};
      scope.$watch(watchFn, listenerFn);
      scope.$digest();
      expect(watchFn).toHaveBeenCalledWith(scope);
    });

    // 当watched value 改变的时候 调用listenerFn
    it('calls the listener function when the watched value changes', function() {
      scope.someValue = 'a';
      scope.counter = 0;
      
      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { return scope.counter++; }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(2);

    });

    // 当 watch value 第一次传入undefined的时候  调用listenerFn
    it('calls listener when watch value is first undefined', function () {
      scope.counter = 0;

      scope.$watch(
        function() { return scope.someValue; },
        function(newValue, oldValue, scope) { return scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // 第一次调用listenerFn的时候 把 newValue作为 oldValue
    it('calls listener with new value as old value the first time', function () {
      scope.someValue = 123;
      var oldValueGiven;

      scope.$watch(
        function() { return scope.someValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );
      
      scope.$digest();
      expect(oldValueGiven).toBe(123);
    });

    // 没有传入listenerFn 的情况处理
    it('may have watchers that omit the listener function', function() {
      var watchFn = jasmine.createSpy().and.returnValue('something');
      scope.$watch(watchFn);

      scope.$digest();
      expect(watchFn).toHaveBeenCalled();
    });

    // Title : 在同一个digest里面链式的触发watchers 
    // detail: watch的value是在另一个listener里面发生变化
    // 并且是 后面的watcher 影响前面的watcher
    it('triggers chained watchers in the same digest', function() {
      scope.name= 'jane';

      scope.$watch(
        function() { return scope.nameUpper; },
        function(newValue, oldValue, scope) {
          if (newValue) {
            scope.initial = newValue.substring(0,1) + '.';
          }
        }
      );

      scope.$watch(
        function() { return scope.name; },
        function(newValue, oldValue, scope) {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');
    });

    // TTL : time to live
    // 多次iterate watchers时，要停止iterate
    it('gives up on the watches after 10 iteration', function() {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function(scope) { return scope.counterA; },
        function(newValue, oldValue, scope) {
          scope.counterB++;
        }
      );
      scope.$watch(
        function(scope) { return scope.counterB; },
        function(newValue, oldValue, scope) {
          scope.counterA++;
        }
      );
      
      expect(function() { scope.$digest(); }).toThrow();

    });

    // Title: 当 watch clean的时候 要停止 digest
    // performance: iterate encounter lastDirtyWatcher. stop iterate!
    it('ends the digest when the last watch is clean', function() {
      scope.array = _.range(100);
      var watchExecution = 0;

      _.times(100, function(i){
        scope.$watch(
          function(scope) {
            watchExecution ++;
            return scope.array[i];
          },
          function(newValue, oldValue, scope) {}
        );
      });

      scope.$digest();
      expect(watchExecution).toBe(200);

      scope.array[0] = 420;
      scope.$digest();
      expect(watchExecution).toBe(301);
    });

    // Title: 当有watcher 没有执行的时候，不要停止digest
    // detail: 在一个 watch 的 watcherFn 内部 添加一个 watch,
    // 由于我们在 listenerFn 里加了 $$lastDirtyWatch,
    // 所以在一个 $watch initialize的时候 也要 initializs $$lastDirtyWatch
    it('does not end digest so that new watcher are not run', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
              scope.counter++;
            }
          );
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    //（a === a） = false 的情况, 引用数据类型的 deep compare
    it('compares based on value if enable', function() {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    // NaN === NaN 要注意处理
    it('correctly handles NaNs', function() {
      scope.number = 0/0;
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.number; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // 任何function报错 也要继续
    it('catches exceptions in watch functions and continues', function() {
      scope.aValue = 'abc';
      scope.counter = 0;
      
      scope.$watch(
        function(scope) { throw 'Error'; },
        function(newValue, oldValue, scope){}
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // listenerFn 抛错的情况
    it('catches exceptions in listener functions and continues', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          throw 'Error';
        }
      );
      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // detroy 一个 watch
    it('allows destroying a $watch with a removal function', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      var destroyWatch = scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.aValue = 'ghi';
      destroyWatch();
      scope.$digest();
      expect(scope.counter).toBe(2);
    });
    
    // Title: 在$digest过程中 destroy一个$watch
    // detail: 在watchFn 里面去 destroy 这个 watch (splice 会改变iterating Array)
    // fix: unshift 配合 forEachRight 遍历
    it('allows destroying a $watch during digest', function() {
      scope.aValue = 'abc';

      var watchCalls = [];

      scope.$watch(
        function(scope) {
          watchCalls.push('first');
          return scope.aValue;
        }
      );

      var destroyWatch = scope.$watch(
        function(scope) {
          watchCalls.push('second');
          destroyWatch();
        }
      );

      scope.$watch(
        function() {
          watchCalls.push('third');
          return scope.aValue;
        }
      );

      scope.$digest();
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
    });

    // 在digest 过程中 一个 watcher 去 destroy 另一个 watcher
    // 在 watch retrun function 中 也要 initialize lastDirtyWatcher
    it('allows a $watch to destroy another during digest', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          destroyWatch();
        }
      );

      var destroyWatch = scope.$watch(
        function(scope) {},
        function(newValue, oldValue, scope) {}
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });
  });

  /* 
                ============================================
                                Chapter 2
                              Scope Method
                ============================================
  */

  // $eval 接受一个function作为参数
  // 把scope作为这个函数的第一个参数
  // $eval 的第二个参数 作为这个函数的第一个参数
  describe('$eval', function(){
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    // 调用 $eval 测试返回值
    it('excutes $evaled function and returns result', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    })

    // $eval 的第二个参数 作为传入 function 的第二个参数
    it('passes the second $eval argument straight through', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope, arg) {
        return scope.aValue + arg
      }, 2);

      expect(result).toBe(44);
    })
  })

  // $apply: integrate 第三方库 的标准方法
  describe('$apply', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('executes the given function and starts the digest', function() {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );
      
      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(function(scope) {
        scope.aValue = 'someOtherVale';
      });
      expect(scope.counter).toBe(2);
    })
  })

  // $evalAsync 创建一个 asyncQueue 在$digest的时候会遍历调用eval
  // 并且会异步调用$digest
  // 避免脏检查
  describe('$evalAsync', function() {
    var scope;
    beforeEach(function(){
      scope = new Scope();
    });

    it('executes given function later in the same cycle', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvaluated = true;
          })
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    });

    it('executes $evalAsynced functions add by watch functions', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;

      scope.$watch(
        function(scope) {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluated = true;
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
    });

    it('execute $evalAsynced functions even when not dirty', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluatedTimes = 0;

      scope.$watch(
        function(scope) {
          if (scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluatedTimes++;
            })
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      )
      scope.$digest();
      expect(scope.asyncEvaluatedTimes).toBe(2)
    })

    it('eventually halts $evalAsyncs added by watches', function() {
      scope.aValue = [1, 2, 3];

      scope.$watch(
        function(scope) {
          scope.$evalAsync(function(scope) {});
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      expect(function() { scope.$digest(); }).toThrow();
    })

    it('has a $$phase field whose value is the current digest phase', function() {
      scope.aValue = [1, 2, 3];
      scope.phaseInWatchFunction = undefined;
      scope.phaseInListenerFunction = undefined;
      scope.phaseInApplyFunction = undefined;
      scope.$watch(
      function(scope) {
      scope.phaseInWatchFunction = scope.$$phase;
      return scope.aValue;
      },
      function(newValue, oldValue, scope) {
      scope.phaseInListenerFunction = scope.$$phase;
      }
      );
      scope.$apply(function(scope) {
      scope.phaseInApplyFunction = scope.$$phase;
      });
      expect(scope.phaseInWatchFunction).toBe('$digest');
      expect(scope.phaseInListenerFunction).toBe('$digest');
      expect(scope.phaseInApplyFunction).toBe('$apply');
    });

    it('schedules a digest in $evalAsync', function(done) {
      scope.aValue = 'abc';
      scope.counter = 0;
      
      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++
        }
      );

      scope.$evalAsync(function(scope) {});

      expect(scope.counter).toBe(0);
      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });

    it('catches exceptions in $evalAsync', function(done) {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$evalAsync(function() {
        throw 'Error';
      });

      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });
  });
  // 当多次调用 $apply 的时候，会有性能问题
  // applyAsync 会延迟执行apply
  // 并且一定时间内只执行一次 apply
  describe('$applyAsync', function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    it('allows async $apply with $applyAsync', function(done) {
      scope.counter = 0;
      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$applyAsync(function() {
        scope.aValue = 'abc';
      });
      expect(scope.counter).toBe(1);

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done()
      }, 50);
    });

    it('never executes $applyAsynced function in the same cycle', function(done) {
      scope.aValue = [1, 2, 3];
      scope.asyncApplied = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$applyAsync(function(scope) {
            scope.asyncApplied = true;
          });
        }
      );

      scope.$digest();
      expect(scope.asyncApplied).toBe(false);
      setTimeout(function() {
        expect(scope.asyncApplied).toBe(true);
        done();
      },50);
    });

    it('coalesces many calls to $applyAsync', function(done) {
      scope.counter = 0;
      scope.$watch(
        function(scope) {
          scope.counter++;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$applyAsync(function(scope) {
        scope.aValue = 'abc';
      })
      scope.$applyAsync(function(scope) {
        scope.aValue = 'def';
      });

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 50)
    });

    it('cancel and flushes $applyAsync if digested first', function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          scope.counter++;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$applyAsync(function(scope) {
        scope.aValue = 'abc';
      })
      scope.$applyAsync(function(scope) {
        scope.aValue = 'def';
      })

      scope.$digest();
      expect(scope.counter).toBe(2);
      expect(scope.aValue).toBe('def');

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    });

    it('catch exceptions in $applyAsync', function(done) {
      scope.$applyAsync(function(scope) {
        throw 'Error';
      });
      scope.$applyAsync(function(scope) {
        throw 'Error';
      });
      scope.$applyAsync(function(scope) {
        scope.applid = true;
      });

      setTimeout(function() {
        expect(scope.applid).toBe(true);
        done();
      }, 50);
    });
  });

  // $$postDigest
  describe('postDigest', function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    it('runs after each digest', function() {
      scope.counter = 0;
      scope.$$postDigest(function() {
        scope.counter++;
      });

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('does not include $$postDigest in the digest', function() {
      scope.aValue = 'original value';

      scope.$$postDigest(function() {
        scope.aValue = 'changed value'
      });

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.watchedValue = newValue; }
      );

      scope.$digest();
      expect(scope.watchedValue).toBe('original value');

      scope.$digest();
      expect(scope.watchedValue).toBe('changed value');
    });

    it('catches exceptions in $postDigest', function() {
      var didRun = false;

      scope.$$postDigest(function() {
        throw 'Error';
      });

      scope.$$postDigest(function() {
        didRun = true;
      });

      scope.$digest();
      expect(didRun).toBe(true);
    });
  });

  describe('$watchGroup', function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });
    // 把 watches 作为一个数组， 并且 用数组调用 listener
    it('take watches as an array and calls listener with arrays', function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newValue, oldValue, scope) {
        gotNewValues = newValue;
        gotOldValues = oldValue;
      });

      scope.$digest();

      expect(gotNewValues).toEqual([1, 2]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it('only calls listener once per digest', function() {
      var counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newValue, oldValue, scope) {
        counter++;
      });

      scope.$digest();

      expect(counter).toBe(1);
    });
    
    it('uses the same array of old and new values on first run', function() {
      var gotNewValues, gotOldValues;
      scope.aValue = 1;
      scope.anotherValue = 2;
      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newValue, oldValue, scope) {
        gotNewValues = newValue;
        gotOldValues = oldValue;
      });
      scope.$digest();

      expect(gotNewValues).toBe(gotOldValues);
    });

    it('uses different arrays for old  and new values on subsquent runs', function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ],function(newValue, oldValue, scope) {
        gotNewValues = newValue;
        gotOldValues = oldValue;
      })

      scope.$digest();

      scope.anotherValue = 3;
      scope.$digest();

      expect(gotNewValues).toEqual([1, 3]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it('calls the listener once when the watch array is empty', function() {
      var gotNewValues, gotOldValues;

      scope.$watchGroup([], function(newValue, oldValue, scope) {
        gotNewValues = newValue;
        gotOldValues = oldValue;
      });

      scope.$digest();

      expect(gotNewValues).toEqual([]);
      expect(gotOldValues).toEqual([]);
    });

    it('can be deregistered', function() {
      var counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      var destroyGroup = scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newValue, oldValue, scope) {
        counter++
      });
      scope.$digest();

      scope.anotherValue = 3;
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(1);
    });

    it('does not call the zero-watch listener when deregistered first', function() {
      var counter = 0;

      var destroyGroup = scope.$watchGroup([], function(newValue, oldValue, scope) {
        counter++;
      });

      destroyGroup();
      scope.$digest();
      
      expect(counter).toEqual(0);
    });
  });



  /* 
                ============================================
                                Chapter 3
                              Scope Inheritance
                ============================================
  */

  describe('Inheritance', function() {
    // 继承 父scope的properties
    it('inherits the parent`s properties', function() {
      var parent = new Scope();
      parent.aValue = [1, 2, 3];

      var child = parent.$new();

      expect(child.aValue).toEqual([1, 2, 3]);
    });

    // 不要反向被父scope继承
    it('does not cause a parent to inherit its properties', function() {
      var parent = new Scope();

      var child = parent.$new();
      child.aValue = [1, 2, 3];

      expect(parent.aValue).toBeUndefined();
    });

    // 无论什么时候向父scope添加properties都要被继承
    it('inherits the parents properties whenever they are defined', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = [1, 2, 3];

      expect(child.aValue).toEqual([1, 2, 3]);
    });

    // 可以修改父scope的properties
    it('can manipulate a parent scopes property', function() {
      var parent = new Scope();
      var child = parent.$new();
      parent.aValue = [1, 2, 3];

      child.aValue.push(4);

      expect(child.aValue).toEqual([1, 2, 3, 4]);
      expect(parent.aValue).toEqual([1, 2, 3, 4]);
    });

    // 在子scope可以watch父scope的properties
    it('can watch a property in the parent', function() {
      var parent = new Scope();
      var child = parent.$new();
      parent.aValue = [1, 2, 3];
      child.counter = 0;

      child.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      child.$digest();
      expect(child.counter).toBe(1);
      parent.aValue.push(4);

      child.$digest();
      expect(child.counter).toBe(2)
    })

    it('can be nested at any depth', function() {
      var a = new Scope();
      var aa = a.$new();
      var aaa = aa.$new();
      var aab = aa.$new();
      var ab = a.$new();
      var abb = ab.$new();

      a.value = 1;

      expect(aa.value).toBe(1);
      expect(aaa.value).toBe(1);
      expect(aab.value).toBe(1);
      expect(ab.value).toBe(1);
      expect(abb.value).toBe(1);

      ab.anotherValue = 2;

      expect(abb.anotherValue).toBe(2);
      expect(aa.anotherValue).toBeUndefined();
      expect(aaa.anotherValue).toBeUndefined();
    });

    it('shadows a parents property with the same name', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.name = 'Joe';
      child.name = 'Jill';

      expect(child.name).toBe('Jill');
      expect(parent.name).toBe('Joe');
    });

    it('does not shadow members of parent scopes attributes', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.user = { name: 'Joe' };
      child.user.name = 'Jill';

      expect(child.user.name).toBe('Jill');
      expect(parent.user.name).toBe('Jill');
    })


  });
});
