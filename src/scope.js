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
    listenerFn: listenerFn || function() {},
    // last prop only used to compare with newValue
    last: initWatchVal
  };
  this.$$watchers.push(watcher);
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue, oldValue, dirty;
  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
      dirty = true;
    }
  });
  return dirty;
};

// Scope.prototype.$digest = function() {
//   var ttl = 10;
//   var dirty;
//   do {
//     dirty = this.$$digestOnce();
//     if (dirty && !(ttl--)){
//       throw '10 digest iterations reached';
//     }
//   } while(dirty);
// };

module.exports = Scope;