/**
 * fs
 */
import fs from "fs";

/**
 * path
 */
import path from "path";

/**
 * os
 */
import os from "os";

/**
 * log
 */
import log from "spm-log";

/**
 * dora
 * @type {*}
 */
import dora from "dora";

/**
 * chalk
 * @type {Chalk}
 */
import chalk from "chalk";

/**
 * lodash
 */
import _ from "lodash";

/**
 * promise
 */
import Promise from "promise";

/**
 * portfinder
 * @type {*}
 */
import portfinder from "portfinder";

/**
 * hostUtil
 */
import hostUtil from "./plugins/hostUtil";

/**
 * buildNginxFile
 */
import {buildNginxFile} from "./plugins/nginxUtil";

/**
 *
 * @param filename
 * @returns {boolean}
 */
let existSync = (filename) => {
    try {
        return fs.statSync(filename).isFile();
    } catch (e) {
        return false;
    }
}


/**
 *
 * @returns {string}
 */
let getClientIp = () => {
    let IPv4 = "127.0.0.1";
    try {
        _.forEach((os.networkInterfaces().en0 || os.networkInterfaces().eth0), item => {
            if (item.family == "IPv4") {
                IPv4 = item.address;
            }
        });
    }
    catch (e) {
        throw new Error("can not get current client ip address.");
    }

    return IPv4;
}

/**
 * setupHost
 */
let setupHost = () => {
    let hostConfig = getConfig("host.config.js");
    if (hostConfig) {
        log.info("dora", `start setup host.`);
        hostUtil.setHostname(hostConfig);
    }
    else {
        log.warn("dora", "can not find host config file.");
    }
}

/**
 *
 * @param config
 */
let setupDora = (config) => {
    let doraPath = config.path || "dora.config.js",
        proxyPort = config.proxyPort,
        serverPort = config.serverPort,
        livereloadPort = config.livereloadPort,
        clientIp = config.clientIp,
        doraConfig = getConfig(doraPath);

    if (doraConfig) {
        log.info("dora", `start setup dora, current client ip address: ${chalk.bold(clientIp)}, proxy port: ${chalk.bold(proxyPort)}, server port: ${chalk.bold(serverPort)}, livereload port: ${chalk.bold(livereloadPort)}.`);
        dora(doraConfig(config));
    }
    else {
        log.error("dora", "can not find dora config file.");
    }
}

/**
 *
 * @param callback
 */
let getFreePorts = (count = 1) => {
    return new Promise((resolve, reject) => {
        portfinder.getPorts(count, (err, ports) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(ports);
            }
        });
    });
}

/**
 *
 * @param filename
 * @returns {*}
 */
let getConfig = (filename) => {
    let filePath = path.join(process.cwd(), filename);

    if (existSync(filePath)) {
        return require(filePath);
    }
    return false;
}

/**
 *
 * @param dyncConfig
 */
let setupNginx = (dyncConfig) => {
    let staicConfig = getConfig("nginx.config.js");
    if (staicConfig) {
        log.info("dora", `start setup nginx.`);
        buildNginxFile({
            ...staicConfig,
            ...dyncConfig
        });
    }
    else {
        log.warn("dora", "can not find nginx config file.");
    }
}

/**
 *
 * @param path
 */
let excute = async (doraPath) => {
    try {
        let clientIp = getClientIp(),
            ports = await getFreePorts(3);

        setupHost();
        setupNginx({
            proxyPort: ports[1],
            proxyIp: clientIp
        });
        setupDora({
            path: doraPath,
            serverPort: ports[0],
            proxyPort: ports[1],
            livereloadPort: ports[2],
            clientIp: clientIp
        });
    }
    catch (e) {
        log.error("dora", e);
        process.exit();
    }
}

module.exports = {excute};
