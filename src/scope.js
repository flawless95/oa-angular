var _ = require('lodash');

function Scope() {
  // store all watchers that have been regitered
  this.$$watchers = [];
  // record last dirty watch to make iterate loop optimization
  this.$$lastDirtyWatch = null;

  this.$$asyncQueue = [];

  this.$$phase = null;

  this.$$applyAsyncQueue = [];
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
  this.$$lastDirtyWatch = null;

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$$lastDirtyWatch = null;
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
  var self = this;
  var newValue, oldValue, dirty;
  _.forEachRight(this.$$watchers, function(watcher) {
    try {
      newValue = watcher.watchFn(self);
      oldValue = watcher.last;
      if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
        self.$$lastDirtyWatch = watcher;
        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
        watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
        dirty = true;
      } else if (self.$$lastDirtyWatch === watcher) {
        return false;
      }
    } catch(error) {
      // console.error(error);
    }
  });
  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');
  do {
    while (this.$$asyncQueue.length){
      var asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)){
      this.$clearPhase();
      throw '10 digest iterations reached';
    }
  } while(dirty || this.$$asyncQueue.length);
  this.$clearPhase();
};

// 费这么大劲添加$eval 目的是 实现scope调用
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

// $apply 可以让外部的方法也可以获取并操作scope
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  var self = this;
  if (!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function() {
      if (self.$$asyncQueue.length) {
        self.$digest();
      }
    }, 0);
  };
  this.$$asyncQueue.push({scope: this, expression: expr})
};

scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + 'already in progress';
  }
  this.$$phase = phase;
};

scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

scope.prototype.$applyAsync = function(expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });
};

module.exports = Scope;