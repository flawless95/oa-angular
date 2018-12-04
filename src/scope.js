var _ = require('lodash');

function Scope() {
  // store all watchers that have been regitered
  this.$$watchers = [];
  // record last dirty watch to make iterate loop optimization
  this.$$lastDirtyWatch = null;

  this.$$asyncQueue = [];

  this.$$phase = null;

  this.$$applyAsyncQueue = [];

  this.$$applyAsyncId = null;

  this.$$postDigestQueue = [];

  this.$$children = [];

  this.$root = this;
}
  // to fix an issue, if newValue === undefined, it will not access follow code
function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    // last prop only used to compare with newValue
    last: initWatchVal,
    valueEq: !!valueEq
  };
  self.$$watchers.unshift(watcher);
  // when first invoke $watch, 
  // maybe in listenerFn of this $watch internal also has a $watch
  this.$root.$$lastDirtyWatch = null;

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$root.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if(valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue || (typeof newValue === 'number' &&
      typeof oldValue === 'number' &&
      isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$$digestOnce = function() {
  var dirty;
  var continueLoop = true;
  var self = this;
  this.$$everyScope(function(scope) {
    var newValue, oldValue;
    _.forEachRight(scope.$$watchers, function(watcher) {
      try {
        if (watcher) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;
          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            scope.$root.$$lastDirtyWatch = watcher;
            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), scope);
            dirty = true;
          } else if (scope.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            return false;
          }
        }
      } catch(error) {
        // console.error(error);
      }
    });
    return continueLoop;
  });
  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
    this.$$flushApplyAsync();
  }
  do {
    while (this.$$asyncQueue.length){
      try {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch (error) {}
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)){
      this.$clearPhase();
      throw '10 digest iterations reached';
    }
  } while(dirty || this.$$asyncQueue.length);
  this.$clearPhase();

  while(this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (error) {};
  };
};

Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$root.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  var self = this;
  if (!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function() {
      if (self.$$asyncQueue.length) {
        self.$root.$digest();
      }
    }, 0);
  };
  this.$$asyncQueue.push({scope: this, expression: expr})
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + 'already in progress';
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

Scope.prototype.$$flushApplyAsync = function() {
  while (this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()();
    } catch (error) {};
  };
  this.$root.$$applyAsyncId = null;
};

Scope.prototype.$applyAsync = function(expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });
  
  // 类似 throttle 在 digest 也要处理一下 如果调用了等待中applyAsyncId, clear 
  if (self.$root.$$applyAsyncId === null) {   // 防止多个applyAsync调用， 会调用多次 apply
    self.$root.$$applyAsyncId = setTimeout(function() {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
  var self = this;
  var newValues = new Array(watchFns.length);
  var oldValues = new Array(watchFns.length);
  var changeReactionScheduled = false;
  var firstRun = true;

  if (watchFns.length === 0) {
    var shouldCall = true;
    
    self.$evalAsync(function() {
      if (shouldCall) {
        listenerFn(newValues, newValues, self)
      }
    });

    return function() {
      shouldCall = false;
    }
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  var destroyFunctions = _.map(watchFns, function(watchFn, i) {
    return self.$watch(watchFn, function(newValue, oldValue) {
      newValues[i] = newValue;
      oldValues[i] = oldValue;
      if(!changeReactionScheduled) {
        changeReactionScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    })
  })

  return function() {
    _.forEach(destroyFunctions, function(destroyFunction) {
      destroyFunction();
    });
  }
};

Scope.prototype.$new = function(isolated, parent) {
  var child;
  parent = parent || this;
  if (isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  } else {
    var ChildScope = function() {};
    ChildScope.prototype = this;
    var child = new ChildScope();
  }
  parent.$$children.push(child);
  child.$$watchers = [];
  child.$$children = [];
  child.$parent = parent;
  return child;
};

Scope.prototype.$$everyScope = function(fn) {
  if(fn(this)){
    return this.$$children.every(function(child) {
      return child.$$everyScope(fn);
    })
  } else {
    return false;
  }
};

Scope.prototype.$destroy = function() {
  if (this.$parent) {
    var siblings = this.$parent.$$children;
    var indexOfThis = siblings.indexOf(this);
    if(indexOfThis >= 0) {
      siblings.splice(indexOfThis, 1);
    }
  }
  this.$$watchers = null;
};
module.exports = Scope;
