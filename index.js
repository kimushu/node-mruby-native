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
const archs = (process.arch === "x64") ? ["x64", "ia32"] : [process.arch];
const ext = (process.platform === "win32" ? ".exe" : "");

let mrbc_path;
archs.some((arch) => {
    let result = path.join(__dirname, "compiled", process.platform, arch, "mrbc" + ext);
    if (!fs.existsSync(result)) {
        return false;
    }
    try {
        fs.accessSync(result, fs.constants.X_OK);
    } catch (error) {
        fs.chmodSync(result, 509 /* 0775 */);
    }
    mrbc_path = result;
    return true;
});

function compile(file, options, callback) {
    if (typeof (options) === "function") {
        callback = options;
        options = null;
    }
    if (!options) {
        options = {};
    }
    let args = [];
    let spawn_opt = { argv0: path.basename(mrbc_path) };
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

module.exports = { compile, version, copyright, mrbc_path };
