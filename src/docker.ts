'use strict';

import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import { CliRunner } from './cli-runner';

import * as cp from 'child_process';

export class Docker extends CliRunner {

    /**
     * Constructor
     * 
     * @param rootPath 
     * @param outputHandler 
     * @param closeHandler 
     */
    constructor(rootPath: string, outputHandler, closeHandler) {
        super(outputHandler);
    }

    /**
     * 
     * @param id 
     */
    public nameFromId(id: string) {
        return id.replace('/', '_');
    }

/**
 * Checking in Docker is installed
 */
    public isInstalled(): boolean {
        try
        {
            var result = cp.execSync('docker --version');
            return (result.indexOf('Docker version') >= 0);
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if container with given id is running
     * 
     * @param id 
     */
    public isRunning(id: string): boolean {
        return this.m_Containers.hasOwnProperty(id);
    }

    /**
     * 
     * @param id 
     * @param xvsc 
     * @param cb 
     */
    public attach(id: string, xvsc: boolean, cb) {
        if (this.m_Containers.hasOwnProperty(id)) {
            cb(true);
            return;
        }

        var src = '/src';
        // check if we are mapping something here


        // XXX - must get current local directory
        const child = cp.spawn('docker', ['exec', '-i', this.nameFromId(id)].concat(xvsc ? [ 'cmd.sh', 'vscode' ] : [ 'bash' ]));
        this.m_Containers[id] = child;
        child['xvsc'] = xvsc;

        const stdout = this.collectData(child.stdout, 'utf8', id);
        const stderr = this.collectData(child.stderr, 'utf8', id);
        child.on('error', err => {
            console.log('CONTAINER ERROR');
        });

        child.on('close', code => {
            console.log('CONTAINER EXITED ' + code);

            // remove this container from container list
            delete this.m_Containers[id]; 

            // XXX - send notification, so terminal can be closed, etc...
            //this.m_CloseHandler(id);
            if (code) {
            } else {
            }
        });

        cb(true);
    }

    /**
     * 
     * @param id 
     * @param cb 
     */
    public attachBot(id: string, cb) {
        if (this.m_Containers.hasOwnProperty(id)) {
            cb(true);
            return;
        }

        var src = '/src';
        // check if we are mapping something here


        // XXX - must get current local directory
        const child = cp.spawn('docker', ['exec', '-i', id, "node",  "/bot/server-local.js"]);
        this.m_Containers[id] = child;
        child['xvsc'] = true;

        const stdout = this.collectData(child.stdout, 'utf8', id);
        const stderr = this.collectData(child.stderr, 'utf8', id);
        child.on('error', err => {
            console.log('CONTAINER ERROR');
        });

        child.on('close', code => {
            console.log('CONTAINER EXITED ' + code);

            // remove this container from container list
            delete this.m_Containers[id]; 

            // XXX - send notification, so terminal can be closed, etc...
            //this.m_CloseHandler(id);
            if (code) {
            } else {
            }
        });

        cb(true);
    }

    /**
     * Read directory in running container
     * 
     * @param id 
     * @param path 
     * @param cb 
     */
    public dir(id: string, path: string, cb) {
        this.exec(id, ['ls', '-al', path], function(s: string) {
            if (s) {
                var lines: string[] = s.split('\n');
                var out: {} = {
                    title: path,
                    headers: ['name', 'size', 'date', 'access', 'user', 'group', 'subdirs'],
                    rows: []
                };

                for (var i: number = 1; i < lines.length; i++) {
                    if (lines[i].length > 0) {
                        var fields: string[] = lines[i].split(/\s+/);

                        out['rows'].push({
                            access: fields[0],
                            subdirs: fields[1],
                            user: fields[2],
                            group: fields[3],
                            size: fields[4],
                            date: fields[5] + ' ' + fields[6] + ' ' + fields[7],
                            name: fields[8]
                        });
                    }
                }

                cb(out);
            } else {
                cb(false);
            }
        })        
    }

    /**
     * Copy files from/to container
     * 
     * @param src 
     * @param dst 
     * @param cb 
     */
    public cp(src: string, dst: string, cb) {
        this.execute(['cp', src, dst], false, false, cb)
    }

    /**
     * Execute command in running container
     * 
     * @param id 
     * @param command 
     * @param cb 
     */
    public exec(id: string, command: any[], cb) {
        this.execute(['exec', id].concat(command), false, false, cb);
    }

    /**
     * Pass command to be executed in running container (via stdin)
     * 
     * @param id 
     * @param command 
     * @param cb 
     */
    public execCmd(id: string, command: any, cb) {

        this.m_Containers[id].stdin.write(command + '\n');
    }

    /**
     * Get docker info
     * 
     * @param cb 
     */
    public info(cb) {
        this.execute(['info'], false, false, cb);
    }

    /**
     * Get list of containers
     * 
     * @param all 
     * @param cb 
     */
    public ps(all: boolean, cb) {
        this.execute(['ps'].concat(all ? [ '-a'] : []), true, true, cb);
    }

    /**
     * Remove file/directory inside running container
     * 
     * @param id 
     * @param path 
     * @param cb 
     */
    public rmdir(id: string, path: string, cb) {
        this.exec(id, ['rm', '-rf', path], function(s: string) {
            cb(s);
        })        
    }

    /**
     * execute all local images
     * 
     * @param cb 
     */
    public images(cb) {
        this.execute(['images'], true, true, cb);
    }

    /**
     * Get config
     * 
     * @param id 
     * @param cb 
     */
    public getConfig(id, cb) {
        this. execute(['run', '--rm', id, 'config'], false, false, cb);
    }

    /**
     * Search images in Docker Hub
     * 
     * @param filter 
     * @param cb 
     */
    public search(filter: string, cb) {
        this.execute(['search', filter], true, false, cb)
    }

    /**
     * Remove local images
     * 
     * @param images 
     * @param cb 
     */
    public rmi(images: string[], cb) {
        this.execute(['rmi', '-f'].concat(images), true, false, cb)
    }

    /**
     * Pull image from Docker Hub
     * 
     * @param image 
     * @param cb 
     */
    public pull(image: string, cb) {
        this.execute(['pull', image], false, false, cb)
    }
    
    /**
     * Push image to Docker Hub
     * 
     * @param image 
     * @param cb 
     */
    public push(image: string, cb) {
        this.execute(['push', image], false, false, cb)
    }
    
    /**
     * Build image from DockerFile
     * 
     * @param tag 
     * @param cb 
     */
    public build(tag: string, cb) {
        this.execute(['build', '--tag', tag, '.'], false, false, cb)
    }

    /**
     * Remove (kill if necessary) containers
     * 
     * @param containers 
     * @param force 
     * @param cb 
     */
    public rm(containers: string[], force: boolean, cb) {
        this.execute(['rm'].concat(force ? [ '-f' ] : []).concat(containers), true, false, cb)
    }

    /**
     * Remove (kill if necessary) containers for particular image
     * 
     * @param image
     * @param cb 
     */
    public rmContainersForImage(image: string, cb) {

        let _docker = this;
        this.ps(true, function (result) {
            let ids: string[] = [];

            if (result) {
                for (var i = 0; i < result.rows.length; i++) {
                    if (result.rows[i]["image"].startsWith(image)) {
                        ids.push(result.rows[i]["container id"]);
                    }
                }
            }

            if (ids.length > 0) {
                _docker.rm(ids, true, cb);
            } else {
                cb(true);
            }
        });
    }

    /**
     * Display image history
     * 
     * @param name 
     * @param cb 
     */
    public history(name: string, cb) {
        this.execute(['history', '--no-trunc', name], true, false, cb)
    }

    /**
     * Rename running container
     * 
     * @param id 
     * @param newName 
     * @param cb 
     */
    public rename(id, newName, cb) {
        this.execute(['rename', id, newName], false, false, cb)
    }

    /**
     * Pause running container
     * 
     * @param id 
     * @param cb 
     */
    public pause(id, cb) {
        this.execute(['pause', id], false, false, cb)
    }

    /**
     * Unpause running container
     * 
     * @param id 
     * @param cb 
     */
    public unpause(id, cb) {
        this.execute(['unpause', id], false, false, cb)
    }

    /**
     * Start container
     * 
     * @param id 
     * @param cb 
     */
    public start(id, cb) {
        this.execute(['start', id], false, false, cb)
    }

    /**
     * Stop container
     * 
     * @param id 
     * @param cb 
     */
    public stop(id, cb) {
        this.execute(['stop', id], false, false, cb)
    }

    /**
     * Restart container
     * 
     * @param id 
     * @param cb 
     */
    public restart(id, cb) {
        this.execute(['restart', id], false, false, cb)
    }

    /**
     * Diff container
     * 
     * @param id 
     * @param cb 
     */
    public diff(id, cb) {
        this.execute(['diff', id], false, false, cb)
    }

    /**
     * Display processes in container
     * 
     * @param id 
     * @param cb 
     */
    public top(id, cb) {
        this.execute(['top', id, 'ps'], false, false, cb)
    }

    /**
     * Display logs for container
     * 
     * @param id 
     * @param cb 
     */
    public logs(id, cb) {
        this.execute(['logs', id], false, false, cb)
    }

    /**
     * Display logs for container
     * 
     * @param username 
     * @param password 
     * @param cb 
     */
    public login(username: string, password: string, cb) {
        this.execute(['login', '--password', password, '--username', username], false, false, cb);
    }

    private m_Containers = {};
}
