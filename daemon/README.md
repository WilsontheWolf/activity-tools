# RPC Tools Daemon
This daemon runs on your local pc, and tracks your activities. 
It is a reverse engineered version of discord's RPC protocol. 
It runs via node.js v18 and is dependency free.

For RPC to work properly, this must be run before discord is opened.

The following ENV variables are required:
- SERVER - The URL of the server to send data to
- TOKEN - The token to use to authenticate with the server

Optionally, you can set the following ENV variables:
- NO_FANCY_SESSIONS - Disables using loginctl to check if idle.

## Running
To run the daemon, you must have node.js v18 installed. 
Then, you can set the env varibles like so
```bash
export SERVER=https://activites.example.com
export TOKEN=1234567890
```
Then, you can run the daemon like so
```bash
node index.js
```

TODO: make a systemd service file for this.