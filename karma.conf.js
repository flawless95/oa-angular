module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'jasmine'],
    files: [
      'src/**/*.js',
      'test/**/*_spec.js'
    ],
    preprocessors: {
      'test/**/*.js': ['browserify'],
      'src/**/*.js': ['browserify']
    },
    browsers: ['PhantomJS'],
    browserify: {
      debug: true,
      bundleDelay: 2000 // Fixes "reload" error messages, YMMV!
    }
  })
}
