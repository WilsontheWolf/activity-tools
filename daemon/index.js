import Activity from "../shared/Activity.mjs";
import ClientHandler from "./ClientHandler.js";
import { getServer, makeIPC } from "./IPC.js";
import ProxyHandler from "./ProxyHandler.js";
import getConfig from "./config.js";
import { newActivity, removeActivity, startSending } from "./dataHandler.js";
import { fetchMe } from "./requestHandler.js";
import { setTimeout } from "node:timers/promises";

const ipc = await makeIPC();
const path = ipc.address().match(/discord-ipc-(\d+)/)?.[1];
if (!path || path !== '0') {
    console.warn('The IPC path is not the default path. RPC apps may not connect to me.');
    console.warn('Make sure there is no other instance of this app running.');
    console.warn('If you are running the discord app, make sure you run me first.');
}

const server = getServer();

const config = getConfig();

const activityCache = new Map();

const newHandler = (socket) => {
    if (config.passthrough) return new ProxyHandler(socket, config.passthrough);
    return new ClientHandler(socket);
};

const broadcastActivity = (id, activity) => {
    if (activity)
        newActivity(activity, id);
    else removeActivity(id);
};


const updateActivity = (client, data) => {
    if (!data || !client.clientID) return;
    const act = data.activity;
    if (!act) return;
    let activity;
    try {
        activity = new Activity(act);
    } catch (e) {
        return;
    }
    if (!activity) return;
    activityCache.set(client.clientID, activity);
    broadcastActivity(client.clientID, activity);
};

server.on("connection", (socket) => {
    console.log("socket connected");
    const handler = newHandler(socket);

    handler.on('ready', () => {
        if (!handler.clientID || activityCache.has(handler.clientID)) {
            handler.clientID = null;
            return handler.close();
        }
    });


    handler.on('close', () => {
        if (handler.clientID) activityCache.delete(handler.clientID);
        broadcastActivity(handler.clientID, null);
    });

    handler.on("message", (data) => {
        if (data.cmd === 'SET_ACTIVITY') {
            updateActivity(handler, data.args);
        }
        if (config.passthrough) return;
        // Some clients (cough cough DiscordGameSDK) don't send activity data
        // unless i tell them I'm inform them of different events. 
        // This is a workaround for that.
        if (data.cmd === 'SUBSCRIBE') {
            const nonce = data.nonce;
            const evt = data.evt;
            handler.send({
                cmd: 'SUBSCRIBE',
                data: { evt },
                evt: null,
                nonce,
            });
        }
    });

});

let trys = 0;
let me;
do {
    me = await fetchMe();
    if (!me.ok) {
        console.error('Failed to fetch user data');
        console.error(me.response);
        if (me.status === 401) {
            console.error('Invalid token. Please check your token in the ENV.');
            process.exit(1);
        }
        console.log('Trying again in 5 seconds...');
        await setTimeout(5000);
    }
} while (!me?.ok && trys++ < 5);
if (!me?.ok) {
    console.error('Failed to fetch user data after 5 tries. Exiting...');
    process.exit(1);
}

console.log(`Logged in as ${me.response.name} (${me.response.id})`)
console.log('Starting activity broadcast...')
startSending();
