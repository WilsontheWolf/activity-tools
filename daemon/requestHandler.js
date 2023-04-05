import getConfig from "./config.js"

const config = getConfig();

const handleOptions = (options = {}) => {
    options.headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        ...(options.headers || {}),
    };

    if (options.body && typeof options.body !== 'string') {
        options.body = JSON.stringify(options.body);
    }
    return options;
};


const fetchGeneric = (url, options = {}) => {
    const res = fetch(new URL(url, config.server), handleOptions(options))
        .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}: ${await res.text() || res.statusText}`);
            return {
                ok: true,
                status: res.status,
                response: await res.json(),
            }
        })
        .catch((err) => {
            return {
                ok: false,
                status: err.status,
                response: err,
            }
        });
    return res;
};


const heartbeat = (data) => {
    console.log(`Debug: POST /devices/@me/heartbeat with data: ${JSON.stringify(data)}`);
    return fetchGeneric(`/devices/@me/heartbeat`, {
        method: 'POST',
        body: data,
    });
};

const fetchMe = () => {
    return fetchGeneric(`/devices/@me`);
};

export {
    heartbeat,
    fetchMe,
}