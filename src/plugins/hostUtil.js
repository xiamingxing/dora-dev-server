/**
 * lodash
 */
import _ from "lodash";

/**
 * fs
 */
import fs from "fs";

/**
 * sudoFs
 */
import sudoFs from "@mh-cbon/sudo-fs";

/**
 * log
 */
import log from "spm-log";
/**
 *
 * @type {Chalk}
 */
import chalk from "chalk";
/**
 *
 * @type {any}
 */
import {Hosts} from 'hosts-parser';


/**
 * HostUtil
 */
class HostUtil {
    /**
     *
     * @returns {HostUtil}
     */
    static getInstance() {
        return new HostUtil;
    }

    /**
     *
     * @type {{path: string}}
     */
    defaultOptions = {
        path: "/etc/hosts"
    }

    /**
     * path
     */
    path

    /**
     * hosts
     */
    hosts

    /**
     * hostsConf
     */
    hostsConf

    /**
     * change
     */
    change

    /**
     *
     * @param options
     */
    constructor(options) {
        this.options = {
            ...this.defaultOptions,
            ...options
        }
        this.path = this.options.path;
        this.initHosts();
    }

    /**
     * initHosts
     */
    initHosts() {
        this.hosts = new Hosts(fs.readFileSync(this.path, 'utf8'));
        this.hostsConf = this.hosts.toJSON();
        this.change = false;
    }

    /**
     * existHostname
     * @param hostname
     * @returns {*}
     */
    existHostname(hostname) {
        try {
            return this.hosts.resolve(hostname);
        }
        catch (e) {
            log.error("host", e);
            return false;
        }
    }

    /**
     * buildHostFile
     * @param data
     * @returns {string}
     */
    buildHostFile(data) {
        return data.map(item => `${item['ip']} \t ${item['hostname']}`).join('\n');
    }

    /**
     * saveHosts
     */
    saveHosts() {
        if (this.change) {
            // 写入host 文件需要sudo权限, 所以使用sudoFs模块的writeFile 方法实现, 不过该方法是异步方法
            sudoFs.writeFile(this.path, this.buildHostFile(this.hostsConf), err => {
                if (err) {
                    log.error("host", err);
                }
            });
            // fs.writeFileSync(this.path, this.buildHostFile(this.hostsConf));
        }
    }

    /**
     * sync
     */
    sync() {
        this.saveHosts();
        this.initHosts();
    }

    /**
     * addHostname
     * @param hostname
     * @param ip
     */
    addHostname(hostname, ip) {
        this.hostsConf.push({
            hostname: hostname,
            ip: ip
        });
        this.change = true;
    }

    /**
     * updateHostname
     * @param hostname
     * @param ip
     */
    updateHostname(hostname, ip) {
        this.hostsConf.map(item => {
            if (item['hostname'] == hostname) {
                item['ip'] = ip;
                this.change = true;
            }
            return item;
        });
    }

    /**
     * __setHostname
     * @param hostname
     * @param ip
     * @private
     */
    __setHostname(hostname, ip) {
        var _ip,
            tpl = `${chalk.bold(hostname)}  ${chalk.bold(ip)}`;
        if (_ip = this.existHostname(hostname)) {
            if (_ip == ip) {
                log.warn("host", `exist host ${tpl}.`);
            }
            else {
                this.updateHostname(hostname, ip);
                log.info("host", `update host ${tpl}.`);
            }
        }
        else {
            this.addHostname(hostname, ip);
            log.info("host", `add host ${tpl}.`);
        }
    }

    /**
     * setHostname
     * @param hostname
     * @param ip
     */
    setHostname(hostname, ip) {
        if (_.isArray(hostname)) {
            hostname.forEach(item => {
                this.__setHostname(item['hostname'], item['ip']);
            });
        }
        else if (_.isObject(hostname)) {
            _.forEach(hostname, (value, key) => {
                this.__setHostname(key, value);
            });
        }
        else {
            this.__setHostname(hostname, ip);
        }
        this.sync();
    }
}


/**
 *
 * @type {HostUtil}
 */
module.exports = HostUtil.getInstance();
