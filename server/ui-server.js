const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const runtime = require('./config/runtime.json');

const CONFIG = {
    port: runtime.uiPort,
    docRoot: path.join(__dirname, '..'),
    injectIntoPaths: ['/jci/gui/index.html'],
    polyfillsFile: path.join(__dirname, 'ui-polyfills.html'),
    injectBeforeMarker: '</head>'
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
    const polyfillSnippet = fs.readFileSync(CONFIG.polyfillsFile, 'utf8');
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

function resolveSafePath(urlPath) {
    const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
    const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
    const resolved = path.join(CONFIG.docRoot, normalized);
    if (resolved !== CONFIG.docRoot && resolved.indexOf(CONFIG.docRoot + path.sep) !== 0) {
        return null;
    }
    return resolved;
}

function createServer() {
    return http.createServer(function (req, res) {
        const urlPath = req.url === '/' ? '/index.html' : req.url;
        let filePath;
        try {
            filePath = resolveSafePath(urlPath);
        } catch (error) {
            logger.warn('ui-server', 'Invalid request path: %s', error.message);
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 Bad Request');
            return;
        }

        if (!filePath) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden');
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
        logger.info(
            'ui-server',
            'Serving %s on http://localhost:%d/ (injecting %s into %s)',
            CONFIG.docRoot,
            CONFIG.port,
            path.basename(CONFIG.polyfillsFile),
            CONFIG.injectIntoPaths.join(', ')
        );
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
    resolveSafePath,
    createServer,
    start
};
