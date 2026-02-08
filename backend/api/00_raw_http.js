const http = require('http');

/**
 * 📖 COMPANION CODE FOR: "Anatomy of an HTTP Transaction"
 * Link: https://nodejs.org/en/learn/modules/anatomy-of-an-http-transaction
 * 
 * This is "Raw Node.js" without Express. 
 * Understanding this makes Express much easier to understand.
 */

// 1. Create the Server
const server = http.createServer((req, res) => {
    // 'req' is an IncomingMessage stream
    // 'res' is a ServerResponse stream
    
    // 2. Look at the Method and URL
    const { method, url } = req;
    console.log(`Received Request: ${method} ${url}`);

    // 3. Set Response Headers (Implicitly created if you don't set them)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'CS125-Learning');

    // 4. Handle Routing (Manual 'if' statements)
    if (url === '/echo' && method === 'POST') {
        // 5. Handling Request Body (Streams!)
        // In raw Node, you have to collect chunks of data manually.
        let body = [];
        
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body).toString();
            
            // Send response
            res.end(JSON.stringify({ 
                message: 'You sent this data:',
                data: body 
            }));
        });
        
    } else {
        // Default Route
        res.statusCode = 200;
        res.end(JSON.stringify({ 
            message: 'Hello from Raw Node.js!', 
            method: method, 
            url: url 
        }));
    }
});

// 6. Start listening
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`📡 Raw Server listening on port ${PORT}`);
    console.log('Try: curl http://localhost:3000/');
    console.log('Try: curl -X POST -d "hello" http://localhost:3000/echo');
});
