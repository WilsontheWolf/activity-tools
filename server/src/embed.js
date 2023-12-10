const statusRank = ['offline', 'idle', 'online'];
const validRenderModes = ['debug', 'small', 'big'];
const validDataMethods = ['once', 'poll', 'stream'];

class DataHandler {
    constructor() {
        this.handlers = new Map();
    }

    addHandler(host, fn, method = 'stream') {
        if (!validDataMethods.includes(method)) throw new Error('Invalid data method');
        let info = this.handlers.get(host) || {
            calls: new Set()
        };
        let methodIndex = validDataMethods.indexOf(method);
        let infoMethodIndex = validDataMethods.indexOf(info.method) || -1;
        info.calls.add(fn);
        if (info.data) fn(info.data);
        if (infoMethodIndex >= methodIndex) return;
        if (info.interval) clearInterval(info.interval);
        info.method = method;
        this.handlers.set(host, info);
        switch (method) {
            case 'once': {
                this.handleOnce(host);
                break;
            }

            case 'poll': {
                this.handlePoll(host);
                break;
            }

            case 'stream': {
                this.handleStream(host);
                break;
            }

            default: {
                throw new Error('Invalid data method');
            }
        }
    }

    alert(host, data) {
        let info = this.handlers.get(host);
        if (!info) return;
        info.calls.forEach(fn => fn(data));
    }

    async fetch(host) {
        let data = await fetch(new URL('/devices?full=true', host))
            .then(async res => {
                if (!res.ok) throw new Error('Server returned ' + res.status);
                return { ok: true, data: await res.json() };
            })
            .catch(e => {
                console.error('Error fetching data', e);
                return { ok: false, error: e };
            });
        if (!data) return null;
        let info = this.handlers.get(host);
        if (!info) return null;
        info.data = data;
        this.alert(host, data);
        return data;
    }

    handleOnce(host) {
        return this.fetch(host);
    }

    handlePoll(host) {
        let int = setInterval(() => this.fetch(host), 20000);
        let info = this.handlers.get(host);
        info.interval = int;
        return this.fetch(host);
    }

    handleStream(host, retryDelay = 1000) {
        let es = new EventSource(new URL('/devices/stream?full=true', host));
        es.addEventListener('open', e => {
            retryDelay = 1000;
        });
        es.addEventListener('message', e => {
            console.log(e);
            const info = this.handlers.get(host);
            if (!info?.data) return;
            if (!info.data.ok) info.data = { ok: true, data: [] };
            let data = JSON.parse(e.data);
            if (!data.id) return;
            let index = info.data.data.findIndex(d => d.id === data.id);
            if (index === -1) info.data.data.push(data);
            else info.data.data[index] = data;
            this.alert(host, info.data);
        });
        es.addEventListener('error', e => {
            console.error('Error in EventSource', e);
            es.close();
            setTimeout(() => {
                this.handleStream(host, retryDelay * 2);
            }, retryDelay);
        });

        let info = this.handlers.get(host);
        info.eventSource = es;
        return this.fetch(host);
    }
}

const globalHandler = new DataHandler();

let isSecure = null;
if (document.currentScript?.src) {
    try {
        const url = new URL(document.currentScript.src);
        if (url.protocol === 'https:') isSecure = true;
        else if (url.protocol === 'http:') isSecure = false;
    }
    catch (e) { }
}
const displays = {
    'loading': 'Loading...',
    'no-data': 'No data',
    'invalid-data': 'Invalid data',
    'no-device': 'Offline',
    'error': 'Error',
};

const displayIcons = {
    'loading': 'loading',
    'no-data': 'error',
    'invalid-data': 'error',
    'no-device': 'offline',
    'error': 'error',
};

let hasDomLoaded = false;
const deferSet = new Set();
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded')
    hasDomLoaded = true;
    deferSet.forEach(fn => fn());
    deferSet.clear();
});

const defer = (fn) => {
    if (hasDomLoaded) fn();
    else {
        deferSet.add(fn);
    }
};


const findLargestActivity = (activities) => {
    if (!activities || !activities.length) return null;
    return activities.reduce((best, curr) => {
        const currKeyLength = Object.keys(curr).length;
        if (!best) return [curr, currKeyLength];
        const bestKeyLength = best[1];

        if (currKeyLength > bestKeyLength) return [curr, currKeyLength];
        return best;
    }, null);
};

const handleDuration = (duration) => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    const parts = [];
    if (hours) parts.push(hours);
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));
    return parts.join(':');
};

const calcDuration = (time, type) => {
    if (!time) return null;
    // Apparently this can be a UNIX timestamp or a JS timestamp
    if(`${time}`.length > 10) time = Math.floor(time / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (type === 'start') return Math.max(now - time, 0);
    if (type === 'end') return Math.max(time - now, 0);
}

class ActivityView extends HTMLElement {
    constructor() {
        super();

        try {
            // Create a shadow root
            this.attachShadow({ mode: "open" }); // sets and returns 'this.shadowRoot'

            this.colors = {
                bgDark: '#333',
                bgLight: '#555',
                border: '#000',
                text: '#D9D9D9',
            }
            this.createElements();

            defer(() => {
                this.loadSettings();

                this.setDisplay('loading');

                globalHandler.addHandler(this.baseURL, data => {
                    this.handleInfo(data);
                });
                // this.getInfo().catch(e => {
                //     console.error('Error getting info', e);
                //     this.setDisplay('error');
                // });
            })
        } catch (e) {
            console.error('Uncaught Error in ActivityView', e);
            this.setDisplay('error');
        }
    }

    loadSettings() {
        this.deviceID = this.getAttribute("device-id");
        let base = '%base%';
        if (isSecure !== null) {
            // This is a funky workaround for my reverse proxy setup
            base = base.replace(/^https?:/, isSecure ? 'https:' : 'http:');
        }
        this.baseURL = this.getAttribute("base-url") || base;
        this.renderMode = this.getAttribute("render-mode") || 'big';
        if (!validRenderModes.includes(this.renderMode)) this.renderMode = 'big';
        let colorsModified = false;
        if (this.getAttribute("bg-dark-color")) {
            this.colors.bgDark = this.getAttribute("bg-dark-color");
            colorsModified = true;
        }
        if (this.getAttribute("bg-light-color")) {
            this.colors.bgLight = this.getAttribute("bg-light-color");
            colorsModified = true;
        }
        if (this.getAttribute("border-color")) {
            this.colors.border = this.getAttribute("border-color");
            colorsModified = true;
        }
        if (this.getAttribute("text-color")) {
            this.colors.text = this.getAttribute("text-color");
            colorsModified = true;
        }
        if (colorsModified) this.genStylesheet();
    }

    renderSmall() {
        let rendered = this.rendered;
        if (!rendered) {
            rendered = this.rendered = document.createElement('div');
            rendered.classList.add('small');
            this.wrapper.appendChild(rendered);
        }
        const dev = this.dev;

        if (!dev) {
            rendered.innerText = '';
            if (this.infoDisplay) {
                rendered.appendChild(this.makeIcon(displayIcons[this.infoDisplay], displays[this.infoDisplay]));
            }
            return;
        }

        const activity = findLargestActivity(dev.activities)?.[0];

        rendered.innerText = '';

        let text = '';
        let icon;
        if (dev.status) {
            icon = this.makeIcon(dev.status);
            rendered.appendChild(icon);
        }
        if (!activity) {
            if (dev.name) text = dev.name;
            else
                text = dev.status[0].toUpperCase() + dev.status.slice(1);
        } else {
            const name = dev.extras?.[activity.id]?.name;
            const { state, details } = activity;
            if (name) text = name;
            else if (details) text = details;
            else if (state) text = state;
            else text = dev.status;
        }
        if (text) {
            if (icon) icon.appendChild(document.createTextNode(' ' + text));
            else rendered.appendChild(document.createTextNode(' ' + text));
        }

    }

    renderBig() {
        let rendered = this.rendered;
        if (!rendered) {
            rendered = this.rendered = {
                main: document.createElement('div'),
                head: document.createElement('div'),
                body: document.createElement('div'),
                content: document.createElement('span'),
            }
            rendered.main.classList.add('big');
            rendered.head.classList.add('head');
            rendered.body.classList.add('body');
            rendered.content.classList.add('content');
            rendered.main.appendChild(rendered.head);
            rendered.main.appendChild(rendered.body);
            rendered.body.appendChild(rendered.content);
            this.wrapper.appendChild(rendered.main);
        }
        const body = rendered.body;
        const head = rendered.head;
        const content = rendered.content;
        const dev = this.dev;

        for (const el of body.children) {
            // Remove all elements but the content
            if (el !== content) body.removeChild(el);
        }

        if (!dev) {
            content.innerText = '';
            head.innerText = '';
            if (this.infoDisplay) {
                head.appendChild(this.makeIcon(displayIcons[this.infoDisplay], 'Activity'));
                content.innerText = displays[this.infoDisplay];
            }
            return;
        }

        head.innerText = '';
        content.innerText = '';

        head.appendChild(this.makeIcon(dev.status, dev.name));

        const activity = findLargestActivity(dev.activities)?.[0];
        if (!activity) {
            content.innerText = 'No Activity to Show';
            return;
        }

        const name = dev.extras?.[activity.id]?.name;
        const { state, details, timestamps } = activity;

        const lines = [
            details,
            state,
        ];

        if (name) {
            const p = document.createElement('p');
            p.innerText = name;
            p.style.fontWeight = 'bold';
            lines.unshift(p);
        }
        // Note for future: part size goes on the same line as state

        for (const line of lines) {
            if (!line) continue;
            if (line instanceof HTMLElement) content.appendChild(line);
            else {
                const lineEl = document.createElement('p');
                lineEl.innerText = line;
                content.appendChild(lineEl);
            }
        }

        if (activity.assets?.large_image) {
            let largeAsset = activity.assets.large_image;
            if (!largeAsset.startsWith('http')) {
                largeAsset = dev.extras?.[activity.id].assets?.large_image?.url
                if (!largeAsset) return;
            }
            let smallAsset = activity.assets.small_image;
            if (!smallAsset.startsWith('http')) {
                smallAsset = dev.extras?.[activity.id].assets?.small_image?.url
            }
            const div = document.createElement('div');
            div.classList.add('asset');

            const stuffer = document.createElement('div');
            stuffer.style.width = '100%';
            stuffer.style.height = '100%';
            div.appendChild(stuffer);

            const img = document.createElement('img');
            img.src = largeAsset;
            img.classList.add('large', 'asset');
            div.appendChild(img);

            if (smallAsset) {
                const img = document.createElement('img');
                img.src = smallAsset;
                img.classList.add('small-asset', 'asset');
                div.appendChild(img);
            }

            body.insertBefore(div, content);
        }

        if (activity.timestamps) {
            head.appendChild(this.timeElement(activity.timestamps));
        }
    }

    timeElement(timeObj) {
        let suffix, time, type;
        if (timeObj.end) {
            suffix = 'Remaining';
            time = timeObj.end;
            type = 'end';
        }
        else if (timeObj.start) {
            suffix = 'Elapsed';
            time = timeObj.start;
            type = 'start';
        }
        else return null;
        const span = document.createElement('span');
        span.innerText = `${handleDuration(calcDuration(time, type))} ${suffix}`;
        const interval = setInterval(() => {
            if (!this.dev) return clearInterval(interval);
            if (!span.parentElement) return clearInterval(interval);
            span.innerText = `${handleDuration(calcDuration(time, type))} ${suffix}`;
        }, 1000);
        return span;
    }

    renderDebug() {
        let rendered = this.rendered;
        if (!rendered) {
            rendered = this.rendered = document.createElement('span');
            this.wrapper.appendChild(rendered);
        }
        const dev = this.dev;


        if (!dev) {
            if (this.infoDisplay) rendered.innerText = this.infoDisplay;
            return;
        }

        const lines = [
            this.dev.name,
            this.dev.status,
            this.makeIcon(this.dev.status)
        ];

        const activity = findLargestActivity(dev.activities)?.[0];

        if (!activity) {
            lines.push('No activity');
        } else {
            const name = dev.extras?.[activity.id]?.name;
            const { state, details, timestamps } = activity;
            if (name) lines.push(name);
            if (state) lines.push(state);
            if (details) lines.push(details);
            if (timestamps) lines.push(this.timeElement(timestamps));
        }

        rendered.innerText = '';

        lines.forEach(line => {
            const p = document.createElement('p');
            if (typeof line === 'string')
                p.innerText = line;
            else if (line instanceof HTMLElement)
                p.appendChild(line);
            rendered.appendChild(p);
        });

    }

    render() {
        if (!this.dev && !this.infoDisplay) return;
        switch (this.renderMode) {
            case 'debug':
                this.renderDebug();
                break;
            case 'small':
                this.renderSmall();
                break;
            case 'big':
                this.renderBig();
                break;
        }
    }

    setDisplay(text) {
        this.infoDisplay = text;
        this.render();
    }

    storeInfo(data) {
        this.infoData = data;
    }

    figureOutWhatToDisplay() {
        if (!this.infoData) return this.setDisplay('no-data');
        if (!this.deviceID && !Array.isArray(this.infoData)) return this.setDisplay('invalid-data');
        if (this.deviceID && Array.isArray(this.infoData)) return this.setDisplay('invalid-data');

        let toShow;
        if (this.deviceID) {
            toShow = this.infoData;
        } else {
            toShow = this.infoData.reduce((best, curr) => {
                // Compare Devices
                const bestRank = statusRank.indexOf(best.status);
                const currRank = statusRank.indexOf(curr.status);
                if (currRank > bestRank) return curr;
                if (currRank < bestRank) return best;

                const bestActivities = best.activities || [];
                const currActivities = curr.activities || [];

                // Compare Activities
                if (currActivities.length > bestActivities.length) return curr;
                if (currActivities.length < bestActivities.length) return best;

                // This is probably a stupid metric but just based off the fields an activity has
                const bestActivityLength = findLargestActivity(bestActivities)?.[1]
                const currActivityLength = findLargestActivity(currActivities)?.[1]
                if (currActivityLength > bestActivityLength) return curr;
                if (currActivityLength < bestActivityLength) return best;

                // The last seen date (which for online devices is useless)
                const bestLastSeen = new Date(best.lastSeen);
                const currLastSeen = new Date(curr.lastSeen);

                if (currLastSeen > bestLastSeen) return curr;

                return best;
            });

            if (toShow.status === 'offline') toShow = null; // When fetching all devices, don't show offline devices
        }
        if (!toShow) return this.setDisplay('no-device');
        this.dev = toShow;
        this.render();
    }

    handleInfo(rawData) {
        if (!rawData.ok) {
            this.setDisplay('error');
            return;
        }

        let data;
        if (this.deviceID) {
            data = rawData.data?.find(d => d.id === this.deviceID);
            if (!data) {
                console.error('Device not found');
                this.setDisplay('error');
                return;
            }
        } else {
            data = rawData.data;
        }
        if (!data || (Array.isArray(data) && data.length === 0)) {
            this.setDisplay('no-data');
            return;
        }

        this.storeInfo(data);
        this.figureOutWhatToDisplay();

    }

    async getInfo() {
        let url = new URL(`/devices${this.deviceID ? `/${this.deviceID}` : ''}?full=true`, this.baseURL);

        const response = await fetch(url).catch(e => {
            console.error(e);
            return { ok: false }
        });
        if (!response.ok) {
            this.setDisplay('error');
            return;
        }

        const data = await response.json();
        if (!data || (Array.isArray(data) && data.length === 0)) {
            this.setDisplay('no-data');
            return;
        }

        this.storeInfo(data);
        this.figureOutWhatToDisplay();
    }

    makeIcon(icon, text) {
        const span = document.createElement('span');
        span.innerHTML = `<svg class="icon"><use xlink:href="#${icon}"/></svg>`;
        if (text)
            span.appendChild(document.createTextNode(' ' + text));
        return span;
    }

    genStylesheet() {
        if (!this.styling) {
            this.styling = document.createElement('style');
            this.shadowRoot.append(this.styling);
        }

        this.styling.textContent = `.wrapper {
}

.small {
    background-color: ${this.colors.bgLight};
    border: 1px solid ${this.colors.border};
    border-radius: 5px;
    min-width: 5em;
    padding: 5px;
    max-width: 20em;
    display: inline-block;
    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;
    color: ${this.colors.text};
}
.big {
    background-color: ${this.colors.bgDark};
    border: 1px solid ${this.colors.border};
    border-radius: 5px;
    display: inline-block;
    width: 20em; /* maybe 200px */
    color: ${this.colors.text};
}
.big .head {
    background-color: ${this.colors.bgLight};
    padding: 5px;
    border-radius: 5px 5px 0 0;
    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;
    display: flex;
    justify-content: space-between;
}

.big .body > img {
    width: 60px;
    height: 60px;
    border-radius: 5px;
    margin-right: 0.5em;
    margin-left: 0.5em;
}
.big .body {
    padding: 5px;
    height: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* Shrink the content if an image is present */
.big .body .content:nth-child(2)  {
    max-width: calc(100% - 70px);
}
.big .content {
    width: 100%;
    text-align: center;
}
.big .content > p {
    margin: 0;
    text-align: left;
    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;

}
.asset {
    height: 60px;
    width: 60px;
    margin-right: 0.5em;
    margin-left: 0.5em;
    position: relative;
    flex-shrink: 0;
}

img.asset {
    position: absolute;
    margin: 0;
}

.asset .small-asset {
    z-index: 1;
    height: 24px;
    width: 24px;
    bottom: -5px; 
    right: -5px;
    /* Rounded */
    border-radius: 50%;
}

.asset .large {
    border-radius: 25%;
    bottom: 0;
}
.icon {
    width: 1em;
    height: 1em;
    vertical-align: sub;
}`;

return this.styling;
    }


    createElements() {
        // Create (nested) span elements
        const wrapper = this.wrapper = document.createElement("div");
        wrapper.setAttribute("class", "wrapper");

        this.genStylesheet();
        const parser = new DOMParser();
        const icons = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
    <symbol id="activity" viewBox="0 0 17 17">
        <circle cx="8" cy="8" r="7" stroke-width="2"/>
    </symbol>

    <symbol id="online">
        <use xlink:href="#activity" fill="#00ff00" stroke="#00c000"/>
    </symbol>

    <symbol id="offline">
        <use xlink:href="#activity" fill="#d3d3d3" stroke="#c0c0c0"/>
    </symbol>

    <symbol id="idle">
        <use xlink:href="#activity" fill="#ffff00" stroke="#c0c000"/>
    </symbol>

    <symbol id="error">
        <use xlink:href="#activity" fill="#ff0000" stroke="#c00000"/>
    </symbol>

    <symbol id="loading">
        <use xlink:href="#activity" fill="#0000ff" stroke="#0000c0"/>
    </symbol>
</svg>`, 'text/html')?.querySelector('svg');

        // attach the created elements to the shadow DOM
        this.shadowRoot.append(icons, wrapper);
    }
}

customElements.define("activity-view", ActivityView);