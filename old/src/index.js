import ClientHandler from "./ClientHandler.js";
import { getServer, makeIPC, OPCodes } from "./IPCPath.js";

makeIPC();

const server = getServer();

const activityCache = new Map();

const updateActivity = (client, data) => {
    if (!data || !client.clientID) return;
    const activity = data.activity;
    if (!activity) return;
    activityCache.set(client.clientID, activity);
    activityCache.onUpdate?.(client.clientID, activity);
};

const printActivity = (activity) => {
    console.log(`Activity Updated:
${activity.details || 'No details'}
${activity.state || 'No state'}

Assets:
Large Image: ${activity.assets?.large_image || 'No large image'} (${activity.assets?.large_text || 'No large text'})
Small Image: ${activity.assets?.small_image || 'No small image'} (${activity.assets?.small_text || 'No small text'})
Timestamps: ${activity.timestamps?.start || 'No start'} - ${activity.timestamps?.end || 'No end'}
`);
}

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
        activityCache.onUpdate?.(handler.clientID, undefined);
    });

    handler.on("message", (data) => {
        if (data.cmd === 'SET_ACTIVITY') {
            // printActivity(data.args.activity);
            updateActivity(handler, data.args);
        } 
    });

});


export default activityCache;