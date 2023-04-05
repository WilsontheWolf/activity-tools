import Enmap from "enmap";

const deviceStore = new Enmap("devices");
const deviceKeys = new Enmap("keys");
const masterKey = process.env.MASTER_KEY;

const checkExpiredActivities = (activity) => {
    if (+activity.lastSeen + 1000 * 60 < Date.now()) {
        return false;
    }
    return true;
};

const getDevice = (id) => {
    if (!deviceStore.has(id)) return null;
    const device = deviceStore.get(id);

    let changed = false;

    if (+device.lastSeen + 1000 * 60 < Date.now()) {
        device.status = 'offline';
        device.activities = [];
        changed = true;
    }

    if (device.activities.some(checkExpiredActivities)) {
        device.activities = device.activities.filter(checkExpiredActivities);
        changed = true;
    }

    if (changed) deviceStore.set(id, device);

    return device;
};

    export {
        deviceStore,
        deviceKeys,
        masterKey,
        getDevice,
    }