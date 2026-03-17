const https = require("https");

const urls = [
  "https://services.polkadothub-rpc.com/testnet/",
  "https://eth-rpc-testnet.polkadot.io",
  "https://westend-asset-hub-eth-rpc.polkadot.io",
];

const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 });

Promise.all(
  urls.map(
    (url) =>
      new Promise((resolve) => {
        const start = Date.now();
        const u = new URL(url);
        const req = https.request(
          { hostname: u.hostname, port: 443, path: u.pathname || "/", method: "POST",
            headers: { "Content-Type": "application/json" }, timeout: 10000 },
          (res) => {
            let d = "";
            res.on("data", (c) => (d += c));
            res.on("end", () => {
              try {
                const r = JSON.parse(d);
                resolve(`LIVE  (${Date.now() - start}ms) block=${r.result}  ${url}`);
              } catch {
                resolve(`PARSE (${Date.now() - start}ms)  ${url}`);
              }
            });
          }
        );
        req.on("timeout", () => { req.destroy(); resolve(`TIMEOUT  ${url}`); });
        req.on("error", (e) => resolve(`FAIL  ${e.code}  ${url}`));
        req.write(body);
        req.end();
      })
  )
).then((results) => results.forEach((r) => console.log(r)));
