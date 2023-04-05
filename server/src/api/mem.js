import Enmap from "enmap";

const deviceStore = new Enmap("devices");
const deviceKeys = new Enmap("keys");
const masterKey = process.env.MASTER_KEY;

const discordStore = new Map();

const checkExpiredActivities = (activity) => {
    if (+activity.lastSeen + 1000 * 60 < Date.now()) {
        return false;
    }
    return true;
};

const fetchDiscordData = async (id) => {
    if (discordStore.has(id)) {
        const data = discordStore.get(id);
        if (data.expiry > Date.now()) return data;
    }

    const data = {
        expiry: Date.now() + 1000 * 60 * 15,
        rpc: null,
        assets: null,
    }

    const rpc = await fetch(`https://discord.com/api/v8/applications/${id}/rpc`).then(r => {
        if (!r.ok) return null;
        return r.json();
    }).catch(() => null);

    if (!rpc) {
        discordStore.set(id, data);
        return data;
    }

    data.rpc = rpc;

    const assets = await fetch(`https://discord.com/api/v8/oauth2/applications/${id}/assets`).then(r => {
        if (!r.ok) return null;
        return r.json();
    }).catch(() => null);

    if (!assets) {
        discordStore.set(id, data);
        return data;
    }

    data.assets = assets;

    discordStore.set(id, data);
    return data;
}

const getDevice = async (id, full = false) => {
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

    if (full) {
        let extras = {};
        for (const activity of device.activities) {
            if(!activity.id) continue;
            if(extras[activity.id]) continue;
            const data = await fetchDiscordData(activity.id);
            if (!data.rpc) continue;
            const assets = {
                large_image: null,
                small_image: null,
            };
            if (data.assets) {
                if (activity.assets.large_image) {
                    const asset = data.assets.find(a => a.name === activity.assets.large_image);
                    if (asset) {
                        asset.url = `https://cdn.discordapp.com/app-assets/${activity.id}/${asset.id}.png`
                        assets.large_image = asset;
                    }
                }
                if (activity.assets.small_image) {
                    const asset = data.assets.find(a => a.name === activity.assets.small_image);
                    if (asset) {
                        asset.url = `https://cdn.discordapp.com/app-assets/${activity.id}/${asset.id}.png`
                        assets.small_image = asset;
                    }
                }
            }
            extras[activity.id] = {
                name: data.rpc.name,
                description: data.rpc.description,
                assets,
            };
        }
        device.extras = extras;
    }

    return device;
};

export {
    deviceStore,
    deviceKeys,
    masterKey,
    getDevice,
}