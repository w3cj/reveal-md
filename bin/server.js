var path = require('path'),
    fs = require('fs'),
    url = require('url'),
    http = require('http'),
    https = require('https'),
    express = require('express'),
    open = require('open'),
    Mustache = require('mustache'),
    glob = require('glob'),
    md = require('reveal.js/plugin/markdown/markdown'),
    exec = require('child_process').exec,
    fetch = require('node-fetch'),
    cookieParser = require('cookie-parser');

var app = express();
var staticDir = express.static;

var serverBasePath = path.join(__dirname, '..');

var opts = {
    printMode: false,
    host: 'localhost',
    port: 1948,
    userBasePath: process.cwd(),
    revealBasePath: path.resolve(require.resolve('reveal.js'), '..', '..'),
    template: fs.readFileSync(path.join(serverBasePath, 'template', 'reveal.html')).toString(),
    templateListing: fs.readFileSync(path.join(serverBasePath, 'template', 'listing.html')).toString(),
    theme: 'black',
    highlightTheme: 'zenburn',
    title: 'reveal-md',
    separator: '^(\r\n?|\n)---(\r\n?|\n)$',
    verticalSeparator: '^(\r\n?|\n)----(\r\n?|\n)$',
    revealOptions: {},
    scripts: {}
};

var printPluginPath = path.join(serverBasePath, 'node_modules', 'reveal.js', 'plugin', 'print-pdf', 'print-pdf.js');

['css', 'js', 'images', 'plugin', 'lib'].forEach(function(dir) {
    app.use('/' + dir, staticDir(path.join(opts.revealBasePath, dir)));
});

var fillOpts = function(options) {
    opts.userBasePath = options.basePath;
    opts.host = options.host || opts.host;
    opts.port = options.port || opts.port;
    opts.theme = options.theme || opts.theme;
    opts.highlightTheme = options.highlightTheme || opts.highlightTheme;
    opts.title = options.title || opts.title;
    opts.separator = options.separator || opts.separator;
    opts.verticalSeparator = options.verticalSeparator || opts.verticalSeparator;
    opts.printMode = typeof options.printFile !== 'undefined' && options.printFile || opts.printMode;
    opts.revealOptions = options.revealOptions || {};
    opts.openWebBrowser = options.openWebBrowser;

    opts.scripts = {};
    options.scripts.forEach(function(script) {
        opts.scripts[path.basename(script)] = script;
    });
};

var startMarkdownServer = function(options) {
    var initialMarkdownPath = options.initialMarkdownPath;
    var printFile = options.printFile;
    var sourceFile;

    fillOpts(options);

    app.use(cookieParser());
    app.use('/lib/css/' + opts.highlightTheme + '.css',
        staticDir(path.join(serverBasePath, 'node_modules', 'highlight.js', 'styles', opts.highlightTheme + '.css')));

    // app.get(/(\w+\.md)$/, renderMarkdownAsSlides);
    app.get('/scripts/*', getScript);
    app.get('/login', (req, res) => {
      res.redirect('https://api.inquire.gteach.xyz/auth/slides/github');
    });
    app.get('/login/callback/:token', (req, res) => {
      res.cookie('token', req.params.token);
      res.redirect('/');
    });
    app.get('/', isLoggedIn, renderMarkdownFileListing);
    // app.get('/*', staticDir(opts.userBasePath));
    app.get('/*', renderMarkdownAsSlides);

    var server = app.listen(opts.port || null);

    var initialFilePath = 'http://' + opts.host + ':' + opts.port + (initialMarkdownPath ? '/' + initialMarkdownPath : '');

    if(!!opts.printMode) {
        sourceFile = initialMarkdownPath;

        // If print parameter was left empty, printFile should equal `true`
        // Give it a better filename, default to the initialMarkdownPath
        if(printFile === true) {
            // Strip .md file extension from output/print filename
            printFile = sourceFile.replace(/\.md$/, '');
        }

        // Both the console.log line below and the reveal.js print-pdf plugin
        // will append .pdf if it is missing, so let's be consistent and remove
        // it here
        printFile = printFile.replace(/\.pdf$/, '')

        console.log('Attempting to print "' + sourceFile + '" to filename "' + printFile + '.pdf" as PDF.');
        console.log('Make sure to have PhantomJS installed (and in your path).');
        exec('phantomjs ' + printPluginPath + ' ' + initialFilePath + '?print-pdf' + ' ' + printFile, function(err, stdout, stderr) {
            if(err) {
                console.log(("[Error with path '" + printFile + "']\n" + stderr + "\n" + err.toString()).red);
            } else {
                console.log(stdout);
            }
            // close the server after we're done, print mode we won't keep the server open
            // this could be configurable if we wanted to, but my thought was that
            // when you're deciding to print, you just want the output pdf file
            server.close();
        });
    } else {
        console.log('Reveal-server started, opening at http://' + opts.host + ':' + opts.port);
        if(opts.openWebBrowser) {
            open(initialFilePath);
        }
    }
};

var renderMarkdownAsSlides = function(req, res) {

    var markdown = '',
        markdownPath,
        fsPath;

    // Look for print-pdf option
    if(~req.url.indexOf('?print-pdf')) {
        req.url = req.url.replace('?print-pdf', '');
    }

    markdownPath = path.resolve(opts.userBasePath + req.url);

    fsPath = markdownPath.replace(/(\?.*)$/, '');

    if(fs.existsSync(fsPath)) {
        markdown = fs.readFileSync(fsPath).toString();
        render(res, markdown);
    } else {
        var parsedUrl = url.parse(req.url.replace(/^\//, ''));
        if(parsedUrl) {
          try {
            (parsedUrl.protocol === 'https:' ? https : http).get(parsedUrl.href, function(response) {
                response.on('data', function(chunk) {
                    markdown += chunk;
                });
                response.on('end', function() {
                    render(res, markdown);
                });
            }).on('error', function(e) {
                console.log('Problem with path/url: ', req.url, e.message);
                render(res, e.message);
            });
          } catch (e) {
            console.log('Error get:', e);
            console.log('Serving static', req.url);
            staticDir(opts.userBasePath);
          }
        } else {
          console.log('Serving static', req.url);
          staticDir(opts.userBasePath);
        }
    }
};

var getScript = function(req, res) {
    res.sendFile(opts.scripts[req.url.substr(req.url.indexOf('/scripts/') + 9)]);
};

var render = function(res, markdown) {
    var slides = md.slidify(markdown, opts);

    res.send(Mustache.to_html(opts.template, {
        theme: opts.theme,
        highlightTheme: opts.highlightTheme,
        title: opts.title,
        slides: slides,
        options: JSON.stringify(opts.revealOptions, null, 2),
        scripts: Object.keys(opts.scripts)
    }));
};

var generateMarkdownListing = function(userBasePath) {
    var list = [];

    glob.sync('**/*.md', {
        cwd: userBasePath || opts.userBasePath,
        ignore: 'node_modules/**'
    }).forEach(function(file) {
        list.push('<a href="' + file + '">' + file + '</a>');
    });

    return Mustache.to_html(opts.templateListing, {
        theme: opts.theme,
        title: opts.title,
        listing: list.join('<br>')
    });
};

var renderMarkdownFileListing = function(req, res) {
    res.send(generateMarkdownListing());
};

var to_html = function(options) {
    var initialMarkdownPath = path.join(options.basePath, options.initialMarkdownPath);
    fillOpts(options);

    if(fs.existsSync(initialMarkdownPath)) {
        markdown = fs.readFileSync(initialMarkdownPath).toString();
        var slides = md.slidify(markdown, opts);

        var html = Mustache.to_html(opts.template, {
            theme: opts.theme,
            highlightTheme: opts.highlightTheme,
            title: opts.title,
            slides: slides,
            options: JSON.stringify(opts.revealOptions, null, 2),
            scripts: Object.keys(opts.scripts)
        });

        console.log(html);
    }
}

var isLoggedIn = function(req, res, next) {
  var token = req.cookies.token;

  if(token) {
    fetch('https://api.inquire.gteach.xyz', {
      headers: { 'Authorization': 'Bearer ' + token },
    }).then(function(res) {
        return res.json();
    }).then(function(result) {
      if(result.user !== null && result.user !== undefined) {
        next();
      } else {
        res.send('UnAuthorized<br><a href="/login">Login</a>');
      }
    });
  } else {
    res.send('UnAuthorized<br><a href="/login">Login</a>');
  }
}

module.exports = {
    start: startMarkdownServer,
    toStaticHTML: to_html
};
