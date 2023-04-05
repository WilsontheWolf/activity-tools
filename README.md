# Activity Tools
These are tools designed to keep track of your activities on your pc. 
It uses discord's RPC protocol to track your activities.

# Directories

## daemon
This is the daemon that runs in the background and tracks your activities. 
It is a reverse engineered version of discord's RPC protocol. It runs via node.js
v18 and is dependency free.

## server
This is a server designed to run on the web. It is used to store your activities
and track the machines you are using. It is written in node.js with koa.js and 
enmap as the database.

## shared
This is a shared library that is used by both the daemon and the server.

## old
Some old stuff from some prototypes. Keep for reference.

