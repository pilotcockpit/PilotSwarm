import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection } from "node:net";
import { startStubServer } from "./e2e/stub-server.mjs";

test("the browser fixture closes promptly with an unfinished HTTP connection", { timeout: 2000 }, async t => {
    // This test exercises HTTP lifecycle only; it never serves a web asset.
    const { server, port } = await startStubServer(0, { checkBuildFreshness: false });
    const accepted = once(server, "connection");
    const socket = createConnection({ host: "127.0.0.1", port });
    const connected = once(socket, "connect");
    t.after(() => {
        socket.destroy();
        server.closeAllConnections();
        if (server.listening) server.close();
    });
    await Promise.all([accepted, connected]);
    // Deliberately leave the request headers unfinished, as a browser can
    // when a test ends while polling or a route is still in flight.
    socket.write("GET / HTTP/1.1\r\nHost: localhost\r\n");
    const errors = [];
    socket.on("error", error => errors.push(error.code));
    const clientClosed = new Promise(resolve => socket.once("close", resolve));
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await clientClosed;
    assert.equal(socket.destroyed, true);
    assert.ok(errors.every(code => code === "ECONNRESET"), `Unexpected client errors: ${errors}`);
});
