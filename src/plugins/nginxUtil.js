/**
 * lodash
 */
import _ from "lodash";

/**
 * fs
 */
import fs from "fs";

/**
 * glob
 * @type {glob}
 */
import glob from "glob";

/**
 * path
 */
import path from "path";

/**
 * spm-log
 */
import log from "spm-log";

/**
 * chalk
 * @type {Chalk}
 */
import chalk from "chalk";

/**
 * nginx-conf
 */
import {NginxConfFile} from "nginx-conf";

/**
 * shelljs
 */
import shelljs from "shelljs";

/**
 * shelljs/global
 */
import "shelljs/global"

let nginx = `nginx`,
    sudo = `sudo`;

/**
 *
 * @param filename
 * @returns {boolean}
 */
let existSync = (filename) => {
    try {
        return fs.statSync(filename).isFile();
    } catch (_) {
        return false;
    }
}

/**
 *
 * @returns {process.stdout|{}|*|process.stderr}
 */
let getNginxProcessConfPath = () => {
    var ret = shelljs.exec(`ps aux | grep nginx`, {async: false, silent: true});
    if (ret.code == 0) {
        return (ret.stdout || ret.stderr)
            .split("\n")
            .filter(item => {
                if (item.indexOf("nginx: master process") > -1 && item.indexOf("-c") > -1) {
                    return true;
                }
                return false;
            })
            .join("")
            .split(/\s/ig)
            .reduce((prev, cur) => {
                if (prev["-c"]) {
                    prev["confpath"] = cur;
                    delete prev["-c"];
                }
                if (cur == "-c") {
                    prev["-c"] = true;
                }
                return prev;
            }, {confpath: ""})["confpath"];
    }
    throw new Error(ret.stderr);
}

/**
 *
 * @returns {*}
 */
let getNginxConfig = () => {
    var ret = shelljs.exec(`${nginx} -V`, {async: false, silent: true});
    if (ret.code == 0) {
        return (ret.stdout || ret.stderr)
            .split("\n")
            .filter(item => {
                if (item.indexOf("configure") > -1) {
                    return true;
                }
                return false;
            })
            .join('')
            .split(/\s/ig)
            .filter(item => (item.indexOf("--") > -1))
            .reduce((prev, cur) => {
                let key, val;
                cur = cur.split("=");
                key = cur[0].replace("--", "");
                val = cur[1] || true;
                if (prev[key]) {
                    if (_.isArray(prev[key])) {
                        prev[key].push(val);
                    }
                    else {
                        prev[key] = [prev[key], val];
                    }
                }
                else {
                    prev[key] = val;
                }
                return prev;
            }, {});
    }
    throw new Error(ret.stderr);
}

/**
 *
 * @param command
 */
let handleNginx = (command) => {
    let ret = shelljs.exec(`${sudo} ${nginx} ${{
        "reload": `-s reload`,
        "stop": `-s stop`,
        "start": ``
    }[command] || ""}`, {async: false, silent: true});
    ret.stderr = ret.stderr.replace("\n", "");
    ret.stdout = ret.stdout.replace("\n", "");
    return ret;
}

/**
 * reloadNginx
 */
let reloadNginx = () => {
    return handleNginx("reload");
}

/**
 * startNginx
 */
let startNginx = () => {
    return handleNginx("start");
}

/**
 *
 * @param path
 * @param callback
 */
let parseNginxFile = (path, callback) => {
    NginxConfFile.create(path, {isVerbatim: true}, function (err, conf) {
        if (err) {
            callback(false);
        }
        else {
            callback(conf);
        }
    })
}

/**
 *
 * @param config
 * @returns {Array.<T>|*|Array}
 */
let resolveVhostdir = (config) => {
    let confpath = config['conf-path'] || getNginxProcessConfPath(),
        nginxFile = fs.readFileSync(confpath, 'utf-8');
    return glob(path.resolve(confpath.replace("/nginx.conf", ""), '*'), {sync: true})
        .filter(item => {
            if (fs.statSync(item).isDirectory()) {
                return true;
            }
            return false;
        })
        .sort((prev, cur) => (nginxFile.indexOf(`${prev.split('/').slice(-1)[0]}/*.conf`) < nginxFile.indexOf(`${cur.split('/').slice(-1)[0]}/*.conf`)))[0];
}

/**
 *
 * @param path
 * @param tpl
 * @param data
 */
let riggerVhostFile = (path, tpl, data) => {

    if (!existSync(path)) {
        log.info("nginx", `${chalk.bold(path)} is\`t exist, create it.`);
        shelljs.exec(`${sudo} touch ${path} && ${sudo} chmod a+w ${path}`);
    }

    if (existSync(tpl)) {
        log.info("nginx", `${chalk.bold(path)} exist, read it.`);
        tpl = fs.readFileSync(tpl, "utf-8");
    }

    try {
        fs.writeFileSync(path, _.template(tpl)(data));
        log.info("nginx", `write nginx file to ${chalk.bold(path)}.`);
        return true;
    }
    catch (e) {
        log.error("nginx", e);
        return false;
    }
}

/**
 *
 * @param data
 * @returns {*}
 */
let format = (data) => {
    data = {
        hostname: "",
        proxyIp: "127.0.0.1",
        proxyPort: "8080",
        listenPort: 80,
        tpl: "",
        confpath: "",
        vhostdir: "",
        vhostfile: "",
        vhostpath: "",
        nginx: "nginx",
        sudo: false,
        ...data
    }
    nginx = data['nginx'];
    sudo = data['sudo'] && 'sudo' || '';
    data['vhostdir'] = data['confpath'] || resolveVhostdir(getNginxConfig());
    data['vhostname'] = `proxy.${data['hostname']}`;
    data['vhostfile'] = `${data['vhostname']}.conf`;
    data['vhostpath'] = path.resolve(data['vhostdir'], data['vhostfile']);
    return data;
}

/**
 *
 * @param data
 * @private
 */
let __buildNginxFile = (data) => {
    let {hostname, vhostdir, vhostname, vhostpath, listenPort, proxyPort, proxyIp} = data,
        reloadRet;

    log.info("nginx", `vhostname: ${chalk.bold(vhostname)}, hostname: ${chalk.bold(hostname)}, listenPort: ${chalk.bold(listenPort)}, proxyIp: ${chalk.bold(proxyIp)}, proxyPort: ${chalk.bold(proxyPort)}`);

    if (riggerVhostFile(vhostpath, data['tpl'], data)) {
        log.info("nginx", `setup nginx vhost ${chalk.bold(hostname)} success, reload it.`);

        reloadRet = reloadNginx();
        if (reloadRet.code == 0) {
            log.info("nginx", `reload nginx success.`);
        }
        else {
            log.error("nginx", reloadRet.stderr);
            log.info("nginx", `retry start nginx.`)

            reloadRet = startNginx();
            if (reloadRet.code == 0) {
                log.info("nginx", `retry start nginx success.`);
            }
            else {
                log.error("nginx", reloadRet.stderr);
            }
        }
    }
    else {
        log.error("nginx", `setup nginx vhost ${chalk.bold(hostname)} fail.`);
    }
}

/**
 *
 * @param tpl
 * @param data
 */
let buildNginxFile = (data) => {

    try {
        __buildNginxFile(format(data));
    }
    catch (e) {
        return log.error("nginx", e);
    }
}

module.exports = {buildNginxFile, parseNginxFile};
