#!/usr/bin/env node

import { Command } from "./Command";

const [, , cmd, ...args] = process.argv;

Command.run(cmd, args);
