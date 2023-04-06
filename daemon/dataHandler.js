import Activity from "../shared/Activity.mjs";
import { STATUS_CODES } from "../shared/status.mjs";
import { heartbeat } from "./requestHandler.js";
import isIdle from "./sessionHandler.js";

const sendInfo = {
    lastSend: 0,
    lastUpdated: Date.now(),
    changedData: null,
    activityMap: new Map(),
    lastFullSend: 0,
}

let interval;

const shouldFullSend = () => {
    if (sendInfo.lastFullSend + 1000 * 30 < Date.now()) return true;
    return false;
}

const processChangedData = () => {
    let res = {};
    if (shouldFullSend()) { 
        sendInfo.lastFullSend = Date.now();
        sendInfo.changedData = {
            activities: {},
        };
        res.full = true;
        for (const [id, activity] of sendInfo.activityMap) {
            sendInfo.changedData.activities[id] = activity;
        }
    } 
    if (!sendInfo.changedData) return;
    if (sendInfo.changedData.activities) {
        res.activities = {};
        for (const [id, activity] of Object.entries(sendInfo.changedData.activities)) {
            if (!activity) {
                res.activities[id] = null;
            } else {
                res.activities[id] = activity.toJSON();
            }
        }
    }
    return res;
};

const newActivity = (rawActivity, id) => {
    if (!id) id = rawActivity.id;
    const activity = Activity.tryActivity(rawActivity, id);
    if (!activity || !id) return;
    if (!sendInfo.changedData) {
        sendInfo.changedData = {
            activities: {
                [id]: activity,
            },
        };
    } else {
        if (!sendInfo.changedData.activities) {
            sendInfo.changedData.activities = {};
        }
        sendInfo.changedData.activities[id] = activity;
    }
    sendInfo.lastUpdated = Date.now();
    sendInfo.activityMap.set(id, activity);
};

const removeActivity = (id) => {
    if (!sendInfo.changedData) {
        sendInfo.changedData = {
            activities: {
                [id]: null,
            },
        };
    } else {
        if (!sendInfo.changedData.activities) {
            sendInfo.changedData.activities = {};
        }
        sendInfo.changedData.activities[id] = null;
    }
    sendInfo.lastUpdated = Date.now();
    sendInfo.activityMap.delete(id);
};

const startSending = () => {
    if (interval) return;
    interval =
        setInterval(async () => {
            if (sendInfo.lastSend + 1000 > Date.now()) {
                return;
            }

            let payload = {};
            if (await isIdle(sendInfo.lastUpdated)) {
                payload.status = STATUS_CODES.IDLE;
            } else {
                payload.status = STATUS_CODES.ONLINE;
            }

            if (shouldFullSend() || sendInfo.changedData) {
                payload.data = processChangedData();
            } else {
                if (sendInfo.lastSend + 1000 * 5 > Date.now()) {
                    return;
                }
            }

            heartbeat(payload)
                .then((res) => {
                    sendInfo.lastSend = Date.now();
                    if (res.ok) {
                        sendInfo.changedData = null;
                    } else {
                        console.error(`Failed to send heartbeat: ${res.status} ${res.response}`);
                        if(res.status === 401) {
                            console.error('Looks like your token has been invalidated. Exiting...');
                            process.exit(1);
                        }
                    }
                })
        }, 1000);
}

const stopSending = () => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
}

export {
    startSending,
    stopSending,
    newActivity,
    removeActivity,
}