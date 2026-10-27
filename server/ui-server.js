const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const runtime = require('./config/runtime.json');
const { openBrowser } = require('./launcher/open-browser');

const CONFIG = {
    port: runtime.uiPort,
    // Only these directories are served (a request outside them is a 404); the rest of the
    // repository (server code, settings, .git, tests) is never reachable from the browser.
    mounts: [
        // The firmware dump. The GUI uses absolute /jci/... paths, so the prefix is fixed.
        { prefix: '/jci/', dir: path.join(__dirname, '..', 'jci') },
        // Emulator code that runs in the browser.
        { prefix: '/emulator/', dir: path.join(__dirname, '..', 'client') }
    ],
    runtimePath: '/emulator/runtime.json',
    guiPath: '/jci/gui/index.html',
    injectIntoPaths: ['/jci/gui/index.html'],
    polyfillsFile: path.join(__dirname, '..', 'client', 'ui-polyfills.html'),
    injectBeforeMarker: '</head>',
    // Added to the injected HTML only when runtime.json enables the emulator controls.
    controlsScript: '<script src="/emulator/ui-controls.js"></script>\n'
};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function injectPolyfills(htmlText) {
    const polyfillSnippet =
        fs.readFileSync(CONFIG.polyfillsFile, 'utf8') +
        (runtime.emulatorControls ? CONFIG.controlsScript : '');
    const markerIndex = htmlText.toLowerCase().indexOf(CONFIG.injectBeforeMarker.toLowerCase());
    if (markerIndex === -1) {
        logger.warn(
            'ui-server',
            'ui-server: injectBeforeMarker (%s) not found - serving file unmodified.',
            CONFIG.injectBeforeMarker
        );
        return htmlText;
    }
    return htmlText.slice(0, markerIndex) + polyfillSnippet + '\n' + htmlText.slice(markerIndex);
}

// Maps a URL path to a file inside one of the mounts, or null when no mount covers it.
function resolveRequestPath(urlPath) {
    const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
    for (const mount of CONFIG.mounts) {
        if (!decodedPath.startsWith(mount.prefix)) continue;
        const resolved = path.resolve(mount.dir, decodedPath.slice(mount.prefix.length));
        if (resolved.startsWith(mount.dir + path.sep)) return resolved;
    }
    return null;
}

// The browser needs only the control port from the runtime settings, not the whole file.
function clientRuntime() {
    return JSON.stringify({ controlPort: runtime.controlPort });
}

function createServer() {
    return http.createServer(function (req, res) {
        const urlPath = req.url;
        if (urlPath.split('?')[0] === CONFIG.runtimePath) {
            res.writeHead(200, {
                'Content-Type': MIME_TYPES['.json'],
                'Cache-Control': 'no-store'
            });
            res.end(clientRuntime());
            return;
        }
        let filePath;
        try {
            filePath = resolveRequestPath(urlPath);
        } catch (error) {
            logger.warn('ui-server', 'Invalid request path: %s', error.message);
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 Bad Request');
            return;
        }

        if (!filePath) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found: ' + urlPath);
            return;
        }

        fs.stat(filePath, function (statErr, stats) {
            if (statErr || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found: ' + urlPath);
                return;
            }

            const requestPath = urlPath.split('?')[0];
            const shouldInject = CONFIG.injectIntoPaths.indexOf(requestPath) !== -1;

            if (shouldInject) {
                fs.readFile(filePath, 'utf8', function (readErr, htmlText) {
                    if (readErr) {
                        logger.error(
                            'ui-server',
                            'Could not read %s: %s',
                            filePath,
                            readErr.message
                        );
                        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                        res.end('500 Internal Server Error');
                        return;
                    }
                    const injected = injectPolyfills(htmlText);
                    res.writeHead(200, {
                        'Content-Type': getContentType(filePath),
                        'Content-Length': Buffer.byteLength(injected, 'utf8')
                    });
                    res.end(injected);
                });
                return;
            }

            res.writeHead(200, { 'Content-Type': getContentType(filePath) });
            const stream = fs.createReadStream(filePath);
            stream.on('error', (error) => {
                logger.error('ui-server', 'Could not stream %s: %s', filePath, error.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('500 Internal Server Error');
                } else {
                    res.destroy();
                }
            });
            stream.pipe(res);
        });
    });
}

function start() {
    const server = createServer();
    server.on('error', (error) => logger.error('ui-server', 'Server error: %s', error.message));
    server.listen(CONFIG.port, function () {
        logger.info('ui-server', 'Serving the GUI on http://localhost:%d/', CONFIG.port);
        logger.debug(
            'ui-server',
            'Serving %s, injecting %s into %s',
            CONFIG.mounts.map((m) => m.prefix).join(' '),
            path.basename(CONFIG.polyfillsFile),
            CONFIG.injectIntoPaths.join(', ')
        );
        const guiUrl = `http://localhost:${CONFIG.port}${CONFIG.guiPath}`;
        logger.banner('Open in your browser:', guiUrl);
        openBrowser(guiUrl);
    });
    return server;
}

if (require.main === module) {
    start();
}

module.exports = {
    CONFIG,
    getContentType,
    injectPolyfills,
    resolveRequestPath,
    clientRuntime,
    createServer,
    start
};
