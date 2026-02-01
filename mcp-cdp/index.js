#!/usr/bin/env node
/**
 * MCP Server for Chrome DevTools Protocol (CDP)
 * Connects to Tauri/WebView2 apps via CDP and exposes debugging tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || 9222;
const CDP_HOST = process.env.CDP_HOST || 'localhost';

// State
let ws = null;
let pageId = null;
let messageId = 0;
let pendingRequests = new Map();
let consoleMessages = [];
let networkRequests = [];
let isConnected = false;

// CDP WebSocket connection
async function getTargets() {
    const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`);
    return response.json();
}

async function connect() {
    if (isConnected && ws?.readyState === WebSocket.OPEN) {
        return { success: true, message: 'Already connected' };
    }

    try {
        const targets = await getTargets();
        const page = targets.find(t => t.type === 'page');

        if (!page) {
            return { success: false, message: 'No page target found. Is the app running with CDP enabled?' };
        }

        pageId = page.id;
        const wsUrl = page.webSocketDebuggerUrl;

        return new Promise((resolve) => {
            ws = new WebSocket(wsUrl);

            ws.on('open', async () => {
                isConnected = true;

                // Enable domains
                await sendCommand('Runtime.enable');
                await sendCommand('Console.enable');
                await sendCommand('Network.enable');
                await sendCommand('Log.enable');

                resolve({ success: true, message: `Connected to ${page.title || page.url}`, pageId });
            });

            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());

                // Handle responses
                if (msg.id && pendingRequests.has(msg.id)) {
                    const { resolve } = pendingRequests.get(msg.id);
                    pendingRequests.delete(msg.id);
                    resolve(msg.result || msg.error);
                }

                // Handle events
                if (msg.method) {
                    handleEvent(msg.method, msg.params);
                }
            });

            ws.on('close', () => {
                isConnected = false;
                ws = null;
            });

            ws.on('error', (err) => {
                resolve({ success: false, message: `Connection error: ${err.message}` });
            });
        });
    } catch (error) {
        return { success: false, message: `Failed to connect: ${error.message}` };
    }
}

function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Not connected'));
            return;
        }

        const id = ++messageId;
        pendingRequests.set(id, { resolve, reject });

        ws.send(JSON.stringify({ id, method, params }));

        // Timeout
        setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }
        }, 10000);
    });
}

function handleEvent(method, params) {
    switch (method) {
        case 'Console.messageAdded':
            consoleMessages.push({
                timestamp: new Date().toISOString(),
                level: params.message.level,
                text: params.message.text,
                url: params.message.url,
                line: params.message.line
            });
            if (consoleMessages.length > 100) consoleMessages.shift();
            break;

        case 'Runtime.consoleAPICalled':
            consoleMessages.push({
                timestamp: new Date().toISOString(),
                level: params.type,
                text: params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '),
                stackTrace: params.stackTrace
            });
            if (consoleMessages.length > 100) consoleMessages.shift();
            break;

        case 'Runtime.exceptionThrown':
            consoleMessages.push({
                timestamp: new Date().toISOString(),
                level: 'error',
                text: params.exceptionDetails.text || params.exceptionDetails.exception?.description,
                stackTrace: params.exceptionDetails.stackTrace
            });
            break;

        case 'Network.requestWillBeSent':
            networkRequests.push({
                id: params.requestId,
                timestamp: new Date().toISOString(),
                method: params.request.method,
                url: params.request.url,
                type: params.type,
                status: 'pending'
            });
            if (networkRequests.length > 50) networkRequests.shift();
            break;

        case 'Network.responseReceived':
            const req = networkRequests.find(r => r.id === params.requestId);
            if (req) {
                req.status = params.response.status;
                req.statusText = params.response.statusText;
                req.mimeType = params.response.mimeType;
            }
            break;

        case 'Network.loadingFailed':
            const failedReq = networkRequests.find(r => r.id === params.requestId);
            if (failedReq) {
                failedReq.status = 'failed';
                failedReq.error = params.errorText;
            }
            break;
    }
}

// MCP Server
const server = new McpServer({
    name: 'cdp-debugger',
    version: '1.0.0'
});

// Register tools
server.tool(
    'cdp_connect',
    'Connect to a Tauri/WebView2 app via CDP. Must be called first.',
    {},
    async () => {
        const result = await connect();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
);

server.tool(
    'cdp_status',
    'Check CDP connection status and get target info',
    {},
    async () => {
        if (!isConnected) {
            return { content: [{ type: 'text', text: JSON.stringify({ connected: false, message: 'Not connected. Call cdp_connect first.' }, null, 2) }] };
        }
        const targets = await getTargets();
        return { content: [{ type: 'text', text: JSON.stringify({ connected: true, pageId, targets }, null, 2) }] };
    }
);

server.tool(
    'cdp_console',
    'Get recent console messages (logs, warnings, errors)',
    {
        level: z.enum(['all', 'log', 'warning', 'error']).optional().default('all'),
        limit: z.number().optional().default(20)
    },
    async ({ level, limit }) => {
        let msgs = consoleMessages;
        if (level !== 'all') {
            msgs = msgs.filter(m => m.level === level);
        }
        return { content: [{ type: 'text', text: JSON.stringify(msgs.slice(-limit), null, 2) }] };
    }
);

server.tool(
    'cdp_network',
    'Get recent network requests',
    {
        limit: z.number().optional().default(20)
    },
    async ({ limit }) => {
        return { content: [{ type: 'text', text: JSON.stringify(networkRequests.slice(-limit), null, 2) }] };
    }
);

server.tool(
    'cdp_eval',
    'Execute JavaScript in the page context',
    {
        expression: z.string().describe('JavaScript to execute')
    },
    async ({ expression }) => {
        if (!isConnected) {
            return { content: [{ type: 'text', text: 'Not connected. Call cdp_connect first.' }] };
        }
        try {
            const result = await sendCommand('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
    }
);

server.tool(
    'cdp_dom',
    'Get DOM tree or query elements',
    {
        selector: z.string().optional().describe('CSS selector (optional, gets full document if omitted)'),
        depth: z.number().optional().default(3)
    },
    async ({ selector, depth }) => {
        if (!isConnected) {
            return { content: [{ type: 'text', text: 'Not connected. Call cdp_connect first.' }] };
        }

        try {
            const { root } = await sendCommand('DOM.getDocument', { depth });

            if (selector) {
                const { nodeIds } = await sendCommand('DOM.querySelectorAll', {
                    nodeId: root.nodeId,
                    selector
                });

                const nodes = [];
                for (const nodeId of nodeIds.slice(0, 10)) {
                    const { outerHTML } = await sendCommand('DOM.getOuterHTML', { nodeId });
                    nodes.push(outerHTML.slice(0, 500));
                }
                return { content: [{ type: 'text', text: JSON.stringify({ count: nodeIds.length, nodes }, null, 2) }] };
            }

            return { content: [{ type: 'text', text: JSON.stringify(root, null, 2) }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
    }
);

server.tool(
    'cdp_screenshot',
    'Take a screenshot of the page (returns base64)',
    {
        format: z.enum(['png', 'jpeg']).optional().default('png'),
        quality: z.number().optional().default(80)
    },
    async ({ format, quality }) => {
        if (!isConnected) {
            return { content: [{ type: 'text', text: 'Not connected. Call cdp_connect first.' }] };
        }
        try {
            const result = await sendCommand('Page.captureScreenshot', { format, quality });
            return { content: [{ type: 'text', text: `data:image/${format};base64,${result.data}` }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
    }
);

server.tool(
    'cdp_clear',
    'Clear console messages and network requests buffer',
    {},
    async () => {
        consoleMessages = [];
        networkRequests = [];
        return { content: [{ type: 'text', text: 'Cleared console and network buffers.' }] };
    }
);

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('CDP MCP Server running on stdio');
}

main().catch(console.error);
