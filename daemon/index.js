import Activity from "../shared/Activity.mjs";
import ClientHandler from "./ClientHandler.js";
import { getServer, makeIPC } from "./IPC.js";
import { newActivity, removeActivity, startSending } from "./dataHandler.js";
import { fetchMe } from "./requestHandler.js";

makeIPC();

const server = getServer();

const activityCache = new Map();

const broadcastActivity = (id, activity) => {
    if(activity)
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
    if(!activity) return;
    activityCache.set(client.clientID, activity);
    broadcastActivity(client.clientID, activity);
};

server.on("connection", (socket) => {
    console.log("socket connected");
    const handler = new ClientHandler(socket);

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
    });

});

const me = await fetchMe();
if(!me.ok) {
    console.error('Failed to fetch user data');
    console.error(me.response);
    process.exit(1);
}

console.log(`Logged in as ${me.response.name} (${me.response.id})`)
console.log('Starting activity broadcast...')
startSending();

export default activityCache;