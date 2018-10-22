#!/usr/bin/env node
"use strict";

const fs      = require("fs");
const getOpts = require("get-options");
const headers = [];

// Parse options
const {options, argv} = getOpts(process.argv.slice(2), {
	"-c, --cols, --columns": "<number=\\d+>",
	"-n, -b, --bytes":       "<number=\\d+>",
	"-f, --format":          "<type>",
	"-v, --version":         "",
});
const columns  = +options.columns || 16;
const format   = options.format   || "hex";
const numBytes = +options.bytes   || 512;
const version  = !!options.version;

// Print version string and exit
if(options.version){
	console.log(require("./package.json").version);
	process.exit(0);
}

// Collect header samples from each file named on command-line
for(let file of argv){
	
	// Ignore missing files
	if(!fs.existsSync(file)){
		console.warn(`Skipping non-existent file: ${file}`);
		continue;
	}
	
	let stats = fs.lstatSync(file);
	
	// Resolve symlinks
	if(stats.isSymbolicLink()){
		file = fs.readlinkSync(file);
		stats = fs.lstatSync(file);
	}
	
	// Not a regular file
	if(!stats.isFile(file)){
		console.warn(`Not a regular file: ${file}`);
		continue;
	}
	
	// Ignore empty files
	if(!stats.size){
		console.warn(`Skipping empty file: ${file}`);
		continue;
	}

	const fd = fs.openSync(file, "r");
	const buffer = Buffer.alloc(Math.min(numBytes, stats.size));
	fs.readSync(fd, buffer, 0, numBytes);
	fs.closeSync(fd);
	headers.push(buffer);
}

// Nothing to scan? Bail
const numFiles = headers.length;
if(!numFiles){
	console.error("Nothing to compare");
	process.exit(1);
}

let table = new Array(numBytes);
for(let i = 0; i < numBytes; ++i)
	table[i] = new Array(numFiles);

for(let i = 0; i < numFiles; ++i)
	for(let j = 0; j < numBytes; ++j)
		table[j][i] = headers[i][j];


table = table.map(column => isHomogenous(column) ? column[0] : null);

switch(format){
	case "json":
		console.log(JSON.stringify(table));
		break;
	
	case "hex":
		for(let i = 0; i < numBytes; ++i){
			i && process.stdout.write(i % columns ? " " : "\n");
			process.stdout.write(null === table[i] ? "__" : hex(table[i]));
		}
		process.stdout.write("\n");
		break;
}


function isHomogenous(array){
	const {length} = array;
	for(let i = 1; i < length; ++i)
		if(array[i] !== array[0])
			return false;
	return true;
}

function hex(byte){
	return (byte < 0x10 ? "0" : "") + byte.toString(16).toUpperCase();
}
