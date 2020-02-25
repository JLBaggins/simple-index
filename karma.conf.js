module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'mocha', 'chai'],
    preprocessors: {
      //  'index.js': ['browserify'],
      'test/**/*.js': ['browserify'],
      'cjs/**/*.js': ['browserify']
    },
    files: [
      // 'index.js',
      'cjs/**/*.js',
      'test/**/*.js'
    ],

    browserify: {
      debug: true,
      // transform: [ 'brfs' ]
    },

    reporters: ['progress'],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_VERBOSE,
    // browsers: ['Chrome'],
    browsers: ['ChromeHeadless'],
    autoWatch: true,
    // singleRun: false, // Karma captures browsers, runs the tests and exits
    concurrency: Infinity
  })
}
