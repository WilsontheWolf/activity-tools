import IPCHandler from "discord-rpc/src/transports/ipc.js";
import ClientHandler from "./ClientHandler.js";
import { getServer, makeIPC, OPCodes } from "./IPCPath.js";

makeIPC();

const server = getServer();

process.env.XDG_RUNTIME_DIR = '/run/user/1000/app/com.discordapp.Discord';

server.on("connection", (socket) => {
    console.log("socket connected");
    const handler = new ClientHandler(socket, null);
    let client;

    handler.on("raw", ({ op, data }) => {
        console.log('[CLIENT]', op, data);
        if (op === OPCodes.HANDSHAKE && !client) {
            client = new IPCHandler({
                clientId: data.client_id,
            })
            client.on("message", (message) => {
                console.log('[IPC]', message);
                handler.send(message);
            });
            client.connect();
        }
        if (op === OPCodes.FRAME && client) {
            client.send(data);
        }
    });

});
