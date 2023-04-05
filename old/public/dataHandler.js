import render from "./renderer.js";

let dataCache;
let activityAdditions = new Map();

const fetchData = async () => {
    const data = await fetch('/activities');
    const activities = await data.json();
    dataCache = activities;
    return activities;
};

const fetchActivityAdditions = async (id) => {
    try {
        if (activityAdditions.has(id)) return activityAdditions.get(id);
        const rpc = await fetch(`https://discord.com/api/v9/oauth2/applications/${id}/rpc`);
        if (!rpc.ok) return activityAdditions.set(id, null);
        const rpcJson = await rpc.json();

        const assets = await fetch(`https://discord.com/api/v9/oauth2/applications/${id}/assets`);
        if (!assets.ok) return activityAdditions.set(id, null);
        const assetsJson = await assets.json();

        activityAdditions.set(id, {
            rpc: rpcJson,
            assets: assetsJson
        });
        return activityAdditions.get(id);
    } catch (e) {
        console.error(e);
        return activityAdditions.set(id, null);
    }
};

const figureOutAssetUrl = (id, asset) => {
    if (asset.startsWith('https://')) return asset;
    if (!activityAdditions.get(id)) return;
    const { assets } = activityAdditions.get(id);
    const assetObj = assets.find(a => a.name === asset);
    if (!assetObj) return;
    return `https://cdn.discordapp.com/app-assets/${id}/${assetObj.id}.png`;
};

let stream;
const streamActivity = () => {
    if (stream) return stream;
    stream = new EventSource('/stream');
    stream.onmessage = (e) => {
        const { id, activity } = JSON.parse(e.data);
        dataCache[id] = activity;
        if (!activity) delete dataCache[id];
        console.log(id, activity)
        render();
    };
    stream.onerror = (e) => {
        console.error(e);
        if (stream.readyState === EventSource.CLOSED) {
            setTimeout(() => {
                stream = null;
                streamActivity();
            }, 5000);
        }
    };
    stream.onopen = () => {
        console.log('Stream opened');
        // Make sure we're up to date
        fetchData().then(() => render());
    };
    return stream;
};

export {
    fetchData,
    fetchActivityAdditions,
    figureOutAssetUrl,
    streamActivity,
    dataCache,
    activityAdditions,
}
