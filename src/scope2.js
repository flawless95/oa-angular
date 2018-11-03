var _ = require('lodash');

function Scope() {
  this.$$watchers = [];

  this.$$lastWatcher = null;
}

function initWatcher() {}

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatcher
  };

  this.$$watchers.push(watcher);

  this.lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var dirty;
  _.forEach(this.$$watchers, function(watcher) {
    var newValue = watcher.watchFn(self);
    var oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.listenerFn(newValue, oldValue, self);
      self.$$lastWatcher = watcher;
      watcher.last = newValue;
      dirty = true;
    } else if (self.$$lastWatcher === watcher) {
      return false;
    }
  });
  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastWatcher = null;
  do{
    dirty = this.$$digestOnce();
    if (dirty && ttl--) {
      throw '最多10次';
    }
  }while(dirty);
};
