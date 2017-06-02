#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const path = require("path");
const ext = (process.platform === "win32" ? ".exe" : "");
const mrbc = path.join(__dirname, "compiled", process.platform, process.arch, "mrbc" + ext);
const fs = require("fs");

try {
    fs.accessSync(mrbc, fs.constants.X_OK);
} catch (error) {
    console.log("chmod");
    fs.chmodSync(mrbc, 509 /* 0775 */);
}

spawn(
    mrbc, process.argv.slice(2), { argv0: "mrbc" + ext, stdio: "inherit" }
).on("exit", (code) => {
    process.exitCode = code;
});
