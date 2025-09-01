const HTTP = require('http');
const HTTPS = require('https');

module.exports = class WebServer {
  #config; #httpServer; #httpsServer;

  constructor(config) {
    this.#config = config;
    this.#httpServer = HTTP.createServer((...args) => this.handler(...args));
    // this.#httpsServer = HTTPS.createServer(this.#config.https.ssl, this.handler);
  }

  start() {
    return Promise.all([
      this.#httpServer.listen(this.#config.http.port),
      // this.#httpsServer.listen(this.#config.https.port),
    ]);
  }

  on() {
    return this;
  }

  // stop() {

  // }

  async handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname, searchParams } = url;
    const pathParts = pathname.split('/').filter(Boolean);

    const matchEntry = Object.entries(this.#config.routes).find(([route]) => {
      const routeParts = route.split('/').filter(Boolean);
      return pathParts.length === routeParts.length && pathParts.every((p, i) => routeParts[i].startsWith('{') || routeParts[i] === p);
    });

    if (matchEntry) {
      const params = {};
      const [route, handler] = matchEntry;

      req.body = await new Promise((resolve) => {
        let buf = '';
        req.on('data', d => (buf += d));
        req.on('end', () => {
          if (req.headers['content-type']?.includes('application/json')) {
            try { resolve(JSON.parse(buf || '{}')); } catch { resolve({}); }
          } else resolve(buf);
        });
      });

      route.split('/').filter(Boolean).forEach((r, i) => {
        const name = r.match(/^\{(.+)\}$/)?.[1];
        if (name) params[name] = pathParts[i];
      });

      req.params = searchParams.entries().reduce((prev, [key, value]) => {
        return Object.assign(prev, { [key]: value });
      }, params);

      handler(req, res);
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  }
};

// // shared handler for both http & https
// const handler = async (req, res) => {
//   const url = new URL(req.url, `http://${req.headers.host}`);
//   const { pathname, searchParams } = url;

//   // simple JSON helper
//   const send = (code, data, headers = {}) => {
//     const body = typeof data === "string" ? data : JSON.stringify(data);
//     res.writeHead(code, { "content-type": "application/json; charset=utf-8", ...headers });
//     res.end(body);
//   };

//   // read body (JSON or text)
//   const body = await new Promise((resolve) => {
//     let buf = "";
//     req.on("data", (c) => (buf += c));
//     req.on("end", () => {
//       if (req.headers["content-type"]?.includes("application/json")) {
//         try { resolve(JSON.parse(buf || "{}")); } catch { resolve({}); }
//       } else resolve(buf);
//     });
//   });

//   // routes
//   if (req.method === "GET" && pathname === "/") return send(200, { ok: true, msg: "hello" });
//   if (req.method === "GET" && pathname === "/health") return send(200, { status: "ok" });
//   if (req.method === "GET" && pathname === "/echo") {
//     return send(200, { q: Object.fromEntries(searchParams) });
//   }
//   if (req.method === "POST" && pathname === "/echo") return send(200, { youSent: body });

//   // 404
//   send(404, { error: "not found" });
// };
