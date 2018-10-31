var _ = require('lodash');

function Scope() {
  // store all watchers that have been regitered
  this.$$watchers = [];
}
  // to fix an issue, if newValue === undefined, it will not access follow code
function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn,
    // last prop only used to compare with newValue
    last: initWatchVal
  };
  this.$$watchers.push(watcher);
};

Scope.prototype.$digest = function() {
  var self = this, newValue, oldValue;
  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
    }
  });
};

module.exports = Scope;