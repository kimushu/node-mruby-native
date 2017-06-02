#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const path = require("path");
const ext = (process.platform === "win32" ? ".exe" : "");
const mrbc_path = path.join(__dirname, "compiled", process.platform, process.arch, "mrbc" + ext);
const fs = require("fs");

try {
    fs.accessSync(mrbc_path, fs.constants.X_OK);
} catch (error) {
    fs.chmodSync(mrbc_path, 509 /* 0775 */);
}

spawn(
    mrbc_path, process.argv.slice(2), { argv0: "mrbc" + ext, stdio: "inherit" }
).on("exit", (code) => {
    process.exitCode = code;
});
