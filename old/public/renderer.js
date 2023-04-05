import Activity from './shared/Activity.js';
import { activityAdditions, dataCache, fetchActivityAdditions, figureOutAssetUrl } from './dataHandler.js';
import transform from './valueTransforms.js';


const activityDiv = document.createElement('div');
activityDiv.id = 'activities';
document.body.appendChild(activityDiv);

const render = () => {
    const entries = Object.entries(dataCache || {});
    if (entries.length === 0) return activityDiv.innerText = 'No activities found';
    activityDiv.innerText = '';
    entries
        .forEach(a => {
            const [id, args] = a;
            /** @type {import('../src/shared/Activity.js')}*/
            const activity = new Activity(args, id);
            const div = document.createElement('div');
            div.id = id;
            const table = document.createElement('table');
            if (activityAdditions.has(id)) {
                const { rpc } = activityAdditions.get(id) || {};
                if (rpc?.name) {
                    const tr = document.createElement('tr');
                    const td1 = document.createElement('td');
                    const td2 = document.createElement('td');
                    td1.innerText = 'Name';
                    td2.innerText = rpc.name;
                    tr.appendChild(td1);
                    tr.appendChild(td2);
                    table.appendChild(tr);
                }
            } else fetchActivityAdditions(id).then(() => render()).catch(() => { });
            for (const key of ['state', 'details', 'timestamps', 'party', 'buttons']) {
                const value = activity[key];
                if (value === undefined) continue;
                const tr = document.createElement('tr');
                const td1 = document.createElement('td');
                const td2 = document.createElement('td');
                td1.innerText = key;
                const val = transform(key, value);
                if(typeof val === 'string') td2.innerText = val;
                else td2.appendChild(val);
                tr.appendChild(td1);
                tr.appendChild(td2);
                table.appendChild(tr);
            }
            if (activity.assets?.large_image) {
                const tr = document.createElement('tr');
                const td1 = document.createElement('td');
                const td2 = document.createElement('td');
                const assetDiv = document.createElement('div');
                td1.innerText = 'Assets';
                assetDiv.className = 'asset';
                tr.appendChild(td1);
                tr.appendChild(td2);
                td2.appendChild(assetDiv);
                let shouldAppend = false;
                for (const type of ['large', 'small']) {
                    const key = `${type}_image`
                    const value = activity.assets[key];
                    if (value === undefined) continue;
                    const URL = figureOutAssetUrl(id, value);
                    if (!URL) continue;
                    const img = document.createElement('img');
                    img.src = URL;
                    img.className = 'asset ' + type;
                    assetDiv.appendChild(img);
                    if(activity.assets[`${type}_text`]) {
                        img.title = activity.assets[`${type}_text`];
                    }
                    shouldAppend = true;
                }
                if(shouldAppend) table.appendChild(tr);
            }
            div.appendChild(table);
            activityDiv.appendChild(div);
        })
}

export default render;