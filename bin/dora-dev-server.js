#!/usr/bin/env node

/**
 * cp
 */
const cp = require("child_process");

/**
 * commander
 * @type {*}
 */
const program = require('commander');

/**
 * doraDevServer
 */
const doraDevServer = require("../index");

/**
 * start
 */
function start() {
    var p = cp.fork(`${__filename}`, process.argv.slice(2));
    p.on('message', function (data) {
        if (data === 'restart') {
            p.kill('SIGINT');
            start();
        }
    });
}


/**
 * startup
 */
function startup() {

    program
        .option('-c, --config <config>', 'file to configure dora')
        .parse(process.argv);

    doraDevServer.excute(program.config);
}

// Main
if (!process.send) {
    start();
}
else {
    startup();
}