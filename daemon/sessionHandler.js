import getConfig from "./config.js";
import { exec } from "node:child_process";
const config = getConfig();

const canUseFancySessions = process.platform === "linux" && !config.noFancySessions;

const boringSession = (lastUpdated) => {
    return lastUpdated + 1000 * 60 * 60 < Date.now();
};


const awaitExec = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

const findSessions = async (lastUpdated) => {
    const { stdout } = await awaitExec("loginctl list-sessions | grep $UID | awk '/tty/ {print $1}'").catch((err) => ({ stdout: "" }));

    const sessionIds = stdout.split("\n").filter((id) => id);
    let foundSession = false;
    let isIdle = false;
    for (const id of sessionIds) {
        const { stdout } = await awaitExec(`loginctl show-session ${id}`).catch((err) => ({ stdout: "" }));
        const lines = Object.fromEntries(stdout.trim().split("\n").map((line) => line.split("=")));
        if (!lines?.IdleHint && !lines?.LockedHint) continue;
        foundSession = true;
        isIdle = lines.IdleHint === "yes" || lines.LockedHint === "yes";
        break;
    }
    if (!foundSession) {
        console.error('No session found');
        return boringSession(lastUpdated);
    }
    return isIdle;
};


const isIdle = async (lastUpdated) => {
    if (!canUseFancySessions) {
        return boringSession(lastUpdated);
    }
    return await findSessions(lastUpdated);
}

export default isIdle;