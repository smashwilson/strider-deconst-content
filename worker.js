var util = require('util');

var Toolbelt = require('strider-deconst-common').Toolbelt;

var entry = require('./lib/entry');

module.exports = {
  init: function (config, job, jobContext, callback) {
    callback(null, {
      env: {},
      path: [],

      test: function (phaseContext, done) {
        var toolbelt = new Toolbelt(config, job, jobContext, phaseContext);
        if (toolbelt.isPullRequest) {
          toolbelt.debug('Testing pull request %s.', toolbelt.pullRequestURL);

          var dockerErr = toolbelt.connectToDocker();
          if (hadError(dockerErr, done)) return;

          optionalConnection(toolbelt.connectToStagingPresenter());
          optionalConnection(toolbelt.connectToStagingContentService(true));
          optionalConnection(toolbelt.connectToGitHub());

          entry.preparePullRequest(toolbelt, function (err, results) {
            hadError(err);
            done(err, results.didSomething);
          })
        } else {
          done(null, true);
        }
      },

      deploy: function (phaseContext, done) {
        var toolbelt = new Toolbelt(config, job, jobContext, phaseContext);

        var err = toolbelt.connectToDocker();
        if (hadError(err, done)) return;

        var opts = {
          contentServiceURL: config.contentServiceURL,
          contentServiceAPIKey: config.contentServiceAPIKey
        };

        entry.recursivelyPrepare(toolbelt, opts, function (err, results) {
          hadError(err);
          done(err, results.didSomething);
        })
      }
    })
  }
}

var makeWriter = function (context) {
  return function () {
    var text = util.format.apply(null, arguments);

    if (text.substr(-1) !== '\n') {
      text += '\n';
    }

    context.out(text);
  };
};

// Post-process any Errors from lower-level functions to trick Strider into using them to fail
// the build rather than error it out.
var hadError = function (err, done) {
  if (err) {
    err.type = 'exitCode';
    err.code = 1;
    if (done) done(err);
    return true;
  }

  return false;
}

var optionalConnection = function (toolbelt, err) {
  if (err) toolbelt.error(err.message);
}
