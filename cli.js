#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const { mrbc_path } = require("./index");
const path = require("path");

spawn(
    mrbc_path, process.argv.slice(2), { argv0: path.basename(mrbc_path), stdio: "inherit" }
).on("exit", (code) => {
    process.exitCode = code;
});
