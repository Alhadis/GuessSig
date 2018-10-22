#!/usr/bin/env node
"use strict";

const fs      = require("fs");
const getOpts = require("get-options");
const headers = [];

// Parse options
const {options, argv} = getOpts(process.argv.slice(2), {
	"-c, --cols, --columns": "[number=\\d+]",
	"-b, --bytes, -n":       "[number=\\d+]",
	"-f, --format":          "[type]",
	"-d, --dot-hack":        "",
	"-h, --hex":             "",
	"-j, --json":            "",
	"-r, --regexp, --regex": "",
	"-v, --version":         "",
});
let format     = options.format   || "hex";
const columns  = +options.columns || 16;
const numBytes = +options.bytes   || 512;
const version  = !!options.version;
const dotHack  = !!options.dotHack;
if(options.json)  format = "json";
if(options.regex) format = "regex";
if(options.hex)   format = "hex";

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
	
	// Print an ECMAScript RegExp literal for matching the guessed signature
	case "regex": {
		let patterns = [];
		let prevByte = false;
		let repeated = 0;
		
		for(let i = 0; i < numBytes; ++i){
			const byte = table[i];
			if(prevByte === byte)
				++repeated;
			else{
				if(false !== prevByte)
					patterns.push(regexify(prevByte, repeated, dotHack));
				prevByte = byte;
				repeated = 0;
			}
		}
		null !== prevByte && patterns.push(regexify(prevByte, repeated));
		process.stdout.write(`/^${patterns.join("")}/${dotHack ? "" : "s"}`);
		process.stdout.isTTY && process.stdout.write("\n");
		break;
	}
	
	case "hex":
		for(let i = 0; i < numBytes; ++i){
			i && process.stdout.write(i % columns ? " " : "\n");
			process.stdout.write(null === table[i] ? "__" : hex(table[i]));
		}
		process.stdout.write("\n");
		break;
}


/**
 * Return true if every element of an array is identical.
 * @param {Array}
 * @return {Boolean}
 */
function isHomogenous(array){
	const {length} = array;
	for(let i = 1; i < length; ++i)
		if(array[i] !== array[0])
			return false;
	return true;
}


/**
 * Convert an integer to uppercased hexadecimal.
 * @example hex(12) => "0C"
 * @param {Number} byte
 * @return {String}
 */
function hex(byte){
	return (byte < 0x10 ? "0" : "") + byte.toString(16).toUpperCase();
}


/**
 * Convert a byte (with possible repetition) to a regexp pattern.
 * @param {Number} byte
 * @param {Number} [repeatCount=0]
 * @param {Boolean} [dotHack=false]
 * @return {String}
 */
function regexify(byte, repeatCount = 0, dotHack = false){
	const quant = repeatCount > 0 ? `{${repeatCount + 1}}` : "";
	
	switch(byte){
		case 0x00: return `\\0${quant}`;  // Null byte
		case 0x09: return `\\t${quant}`;  // Tab
		case 0x0A: return `\\n${quant}`;  // Newline
		case 0x0B: return `\\v${quant}`;  // Vertical tab
		case 0x0C: return `\\f${quant}`;  // Form feed
		case 0x0D: return `\\r${quant}`;  // Carriage return
		
		// Metacharacters
		case 0x24: case 0x28: case 0x29: case 0x2A: case 0x2B:
		case 0x2E: case 0x3F: case 0x5B: case 0x5C: case 0x5D:
		case 0x5E: case 0x7B: case 0x7C: case 0x7D:
			return `\\${String.fromCharCode(byte)}${quant}`;
		
		// Match any byte
		case null:
			return dotHack ? `(?:.|[^\\0])${quant}` : `.${quant}`;
		
		default:
			// Printable ASCII range
			if(byte > 31 && byte < 127)
				return String.fromCharCode(byte) + quant;
			
			// Codepoint escape for unprintable or high-bit character
			return `\\x${hex(byte)}${quant}`;
	}
}
