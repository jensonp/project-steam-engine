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
    
    console.log('\n--- NEW REQUEST RECEIVED ---');

    // 2. Look at the Method and URL
    const { method, url } = req;
    console.log(`[1] Method: ${method}`);
    console.log(`[2] URL:    ${url}`);
    console.log(`[3] Headers:`, req.headers['user-agent']); // Just log User-Agent to keep it clean

    // 3. Set Response Headers (Implicitly created if you don't set them)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'CS125-Learning');
    console.log(`[4] Response Headers Set (Content-Type: application/json)`);

    // 4. Handle Routing (Manual 'if' statements)
    if (url === '/echo' && method === 'POST') {
        console.log(`[5] Matched Route: POST /echo`);
        
        // 5. Handling Request Body (Streams!)
        // In raw Node, you have to collect chunks of data manually.
        let body = [];
        
        req.on('data', (chunk) => {
            console.log(`[6] Stream Event: 'data' received chunk: "${chunk}"`);
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body).toString();
            console.log(`[7] Stream Event: 'end'. Full body: "${body}"`);
            
            // Send response
            res.end(JSON.stringify({ 
                message: 'You sent this data:',
                data: body 
            }));
            console.log(`[8] Response Sent!`);
        });
        
    } else {
        // Default Route
        console.log(`[5] Matched Default Route`);
        res.statusCode = 200;
        res.end(JSON.stringify({ 
            message: 'Hello from Raw Node.js!', 
            method: method, 
            url: url 
        }));
        console.log(`[6] Response Sent!`);
    }
});

// 6. Start listening
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`📡 Raw Server listening on port ${PORT}`);
    console.log('Try: curl http://localhost:3000/');
    console.log('Try: curl -X POST -d "hello world" http://localhost:3000/echo');
});
