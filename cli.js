#!/usr/bin/env node
"use strict"

const {spawn} = require("child_process")
const path = require("path")
const ext = (process.platform == "win32" ? ".exe" : "")

spawn(
  path.join(__dirname, "compiled", process.platform, process.arch, "mrbc" + ext),
  process.argv.slice(2),
  {argv0: "mrbc" + ext, stdio: "inherit"}
).on("exit", (code) => {
  process.exitCode = code
})
