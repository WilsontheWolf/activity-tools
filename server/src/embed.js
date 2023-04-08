const statusRank = ['offline', 'idle', 'online'];
const validRenderModes = ['debug', 'small', 'big'];

let isSecure = null;
if(document.currentScript?.src) {
    try {
        const url = new URL(document.currentScript.src);
        if(url.protocol === 'https:') isSecure = true;
        else if(url.protocol === 'http:') isSecure = false;
    }
    catch(e) {}
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


class ActivityView extends HTMLElement {
    constructor() {
        super();

        try {
            // Create a shadow root
            this.attachShadow({ mode: "open" }); // sets and returns 'this.shadowRoot'

            this.createElements();

            defer(() => {
                this.setDisplay('loading');
                
                this.loadSettings();
    
                this.getInfo().catch(e => {
                    console.error('Error getting info', e);
                    this.setDisplay('error');
                });
            })
        } catch (e) {
            console.error('Uncaught Error in ActivityView', e);
            this.setDisplay('error');
        }
    }

    loadSettings() {
        this.deviceID = this.getAttribute("device-id");
        let base = '%base%';
        if(isSecure !== null) {
            // This is a funky workaround for my reverse proxy setup
            base = base.replace(/^https?:/, isSecure ? 'https:' : 'http:');
        }
        this.baseURL = this.getAttribute("base-url") || base;
        this.renderMode = this.getAttribute("render-mode") || 'big';
        if (!validRenderModes.includes(this.renderMode)) this.renderMode = 'big';
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
                rendered.appendChild(this.makeIcon(displayIcons[this.infoDisplay]));
                rendered.appendChild(document.createTextNode(' ' + displays[this.infoDisplay]));
            }
            return;
        }

        const activity = findLargestActivity(dev.activities)?.[0];

        rendered.innerText = '';

        let text = '';
        if (dev.status) rendered.appendChild(this.makeIcon(dev.status));
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
        if (text) rendered.appendChild(document.createTextNode(' ' + text));

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
                head.appendChild(this.makeIcon(displayIcons[this.infoDisplay]));
                head.appendChild(document.createTextNode(' Activity'));
                content.innerText = displays[this.infoDisplay];
            }
            return;
        }

        head.innerText = '';
        content.innerText = '';

        head.appendChild(this.makeIcon(dev.status));
        head.appendChild(document.createTextNode(' ' + dev.name));

        const activity = findLargestActivity(dev.activities)?.[0];
        if (!activity) {
            content.innerText = 'No Activity to Show';
            return;
        }

        const name = dev.extras?.[activity.id]?.name;
        const { state, details } = activity;

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
        // Note for future: timestamps have pritoity end > start > none

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
            const { state, details } = activity;
            if (name) lines.push(name);
            if (state) lines.push(state);
            if (details) lines.push(details);
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

    makeIcon(icon) {
        const span = document.createElement('span');
        span.innerHTML = `<svg class="icon"><use xlink:href="#${icon}"/></svg>`;
        return span;
    }

    createElements() {
        // Create (nested) span elements
        const wrapper = this.wrapper = document.createElement("div");
        wrapper.setAttribute("class", "wrapper");

        // Create some CSS to apply to the shadow DOM
        const style = this.styling = document.createElement("style");
        style.textContent = `.wrapper {
}

.small {
    background-color: #555;
    border: 1px solid #000;
    border-radius: 5px;
    min-width: 5em;
    padding: 5px;
    max-width: 20em;
    display: inline-block;
    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;
    color: #D9D9D9;
}
.big {
    background-color: #333;
    border: 1px solid #000;
    border-radius: 5px;
    display: inline-block;
    width: 20em; /* maybe 200px */
    color: #D9D9D9;
}
.big .head {
    background-color: #555;
    padding: 5px;
    border-radius: 5px 5px 0 0;
    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;
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
}

img.asset {
    position: relative;
    margin: 0;
}

.asset .small-asset {
    z-index: 1;
    height: 24px;
    width: 24px;
    bottom: 84px; /* large height + small height */
    left: 41px; /* large width - small width + 5 */
    /* Rounded */
    border-radius: 50%;
}

.asset .large {
    border-radius: 25%;
    bottom: 60px; /* Height */
}
.icon {
    width: 1em;
    height: 1em;
    vertical-align: sub;
}`;

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
        this.shadowRoot.append(icons, style, wrapper);
    }
}

customElements.define("activity-view", ActivityView);