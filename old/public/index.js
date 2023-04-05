import { fetchData, streamActivity } from './dataHandler.js';
import render from './renderer.js';
const activities = await fetchData();

console.log(activities);

render();

await streamActivity();