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

### Running in the terminal
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

### Running as a Systemd Service
There is an included systemd service file that can be used to run the daemon as a
systemd service. It is located in the daemon folder at `activity-tracker.service`. Copy it to 
`~/.config/systemd/user/`, and replace the following variables:
1. `#START#` with the result of running `echo $(which node) $(readlink -f ./)` while in the daemon folder.
2. `#SERVER#` with the url of your server, including the protocol (E.G. `https://example.com`)
3. `#TOKEN#` with the token of your server. 

Then run `systemctl --user enable --now activity-tracker.service` to enable and start the service.

You may run `systemctl --user status activity-tracker.service` to check the status of the service.
