import express from 'express';
import { config, validateConfig } from './config';


// Validate configuration on startup
validateConfig();

var app = require('./app');
var debug = require('debug')('webserver:server');
var http = require('http');

app.set('port', config.port);

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'healthy',
    apiKeyConfigured: !!config.steamApiKey,
    timestamp: new Date().toISOString(),
  });
});

// Create HTTP server
var server = http.createServer(app);
server.on('error', onError);
server.on('listening', onListening);

// Start server
server.listen(config.port, () => {
  console.log(`
    Server running at: http://localhost:${config.port}
    API Key configured: ${config.steamApiKey ? 'Yes' : 'No'}
  `);
});

/*
 * Event listener for HTTP server "error" event.
 */

function onError(error: any) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof config.port === 'string'
    ? 'Pipe ' + config.port
    : 'Port ' + config.port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/*
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}