"use strict";

/*
Usage: /path/to/mrbc [switches] programfile
  switches:
  -c           check syntax only
  -o<outfile>  place the output into <outfile>
  -v           print version number, then turn on verbose mode
  -g           produce debugging information
  -B<symbol>   binary <symbol> output in C language format
  -e           generate little endian iseq data
  -E           generate big endian iseq data
  --verbose    run at verbose mode
  --version    print the version
  --copyright  print the copyright
*/

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const ext = (process.platform === "win32" ? ".exe" : "");

function compile(file, options, callback) {
    if (typeof (options) === "function") {
        callback = options;
        options = null;
    }
    if (!options) {
        options = {};
    }
    let args = [];
    let spawn_opt = { argv0: "mrbc" + ext };
    if (options.check_syntax_only) {
        args.push("-c");
    }
    if (options.output) {
        args.push("-o" + options.output);
    }
    if (options.verbose) {
        args.push("-v");
    }
    if (options.debug) {
        args.push("-g");
    }
    if (options.symbol) {
        args.push("-B" + options.symbol);
    }
    if (options.little_endian) {
        args.push("-e");
    }
    if (options.big_endian) {
        args.push("-E");
    }
    if (file instanceof Array) {
        args = args.concat(file);
    } else {
        args.push(file);
    }
    if (options.cwd) {
        spawn_opt.cwd = options.cwd;
    }
    let mrbc_path = path.join(__dirname, "compiled", process.platform, process.arch, "mrbc" + ext);
    try {
        fs.accessSync(mrbc_path, fs.constants.X_OK);
    } catch (error) {
        fs.chmodSync(mrbc_path, 509 /* 0775 */);
    }
    let mrbc = spawn(
        mrbc_path,
        args,
        spawn_opt
    );
    mrbc.on("exit", (code) => {
        mrbc.stdout.setEncoding("utf-8");
        var stdout = mrbc.stdout.read();
        mrbc.stderr.setEncoding("utf-8");
        var stderr = mrbc.stderr.read();
        var err = null;
        if (code !== 0) {
            err = Error("mrbc aborted with code=" + code);
        }
        callback(err, stdout, stderr);
    });
}

function version(callback) {
    return compile("--version", {}, callback);
}

function copyright(callback) {
    return compile("--copyright", {}, callback);
}

module.exports = { compile, version, copyright };
