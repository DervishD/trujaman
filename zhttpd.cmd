@echo off

title Web server
rem Use Node.js http-server.
rem Options: don't cache, don't display directory listings, open browser window automatically after start.
http-server -c-1 -d false -o