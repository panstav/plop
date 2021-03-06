#!/usr/bin/env node

'use strict';

var path = require('path');
var fs = require('fs');
var Liftoff = require('liftoff');
var argv = require('minimist')(process.argv.slice(2));
var v8flags = require('v8flags');
var interpret = require('interpret');
var colors = require('colors');

var plop = require('./mod/plop-base');
var logic = require('./mod/logic');
var out = require('./mod/console-out');
var globalPkg = require('./package.json');
var generator = argv._[0] || null;

var Plop = new Liftoff({
	name: 'plop',
	extensions: interpret.jsVariants,
	v8flags: v8flags
});

Plop.launch({
	cwd: argv.cwd,
	configPath: argv.plopfile,
	require: argv.require,
	completion: argv.completion,
	verbose: argv.verbose
}, run);

function run(env) {
	var generators, plopfilePath;

	// handle request for usage and options
	if (argv.help || argv.h) {
		displayHelpScreen();
		process.exit(0);
	}
	
	if (argv.init || argv.i) {
		return createInitPlopfile(function(err){
			if (err){
				console.log(err);

				process.exit(1);
			}

			process.exit(0);
		});
	}

	// handle request for version number
	if (argv.version || argv.v) {
		if (env.modulePackage.version !== globalPkg.version) {
			console.log('CLI version'.yellow, globalPkg.version);
			console.log('Local version'.yellow, env.modulePackage.version);
		} else {
			console.log(globalPkg.version);
		}
		return;
	}

	plopfilePath = env.configPath;
	// abort if there's no plopfile found
	if (plopfilePath == null) {
		console.error(colors.red('[PLOP] ') + 'No plopfile found');
		displayHelpScreen();
		process.exit(1);
	}

	// set the default base path to the plopfile directory
	plop.setPlopfilePath(path.dirname(plopfilePath));

	// run the plopfile against the plop object
	require(plopfilePath)(plop);

	generators = plop.getGeneratorList();
	if (!generator) {
		out.chooseOptionFromList(generators).then(go);
	}else if (generators.map(function (v) { return v.name; }).indexOf(generator) > -1) {
		go(generator);
	} else {
		console.error(colors.red('[PLOP] ') + 'Generator "' + generator + '" not found in plopfile');
		process.exit(1);
	}

	function displayHelpScreen(){
		console.log('\n' +
		            '\tUsage\n' +
		            '\t\t$ plop <name>\t\tRun a generator registered under that name\n' +

		            '\n' +
		            '\tOptions\n' +
		            '\t\t-h, --help\t\tShow this help display\n' +
		            '\t\t-i, --init\t\tGenerate initial plopfile.js\n' +
		            '\t\t-v, --version\t\tPrint current version\n');
	}

	function createInitPlopfile(callback){
		var initString = 'module.exports = function (plop) {\n\n' +
		                 '\tplop.setGenerator(\'basics\', {\n' +
		                 '\t\tdescription: \'this is a skeleton plopfile\',\n' +
		                 '\t\tprompts: [],\n' +
		                 '\t\tactions: []\n' +
		                 '\t});\n\n' +
		                 '};';

		fs.writeFile(env.cwd + '/plopfile.js', initString, callback);
	}

}

function go(generator) {
	logic.getPlopData(generator)
		.then(logic.executePlop)
		.then(function (result) {
			result.changes.forEach(function(line) {
				console.log('[SUCCESS]'.green, line.type, line.path);
			});
			result.failures.forEach(function(line) {
				console.log('[FAILED]'.red, line.type, line.path, line.error);
			});
		})
		.fail(function (err) {
			console.error('[ERROR]'.red, err.message, err.stack);
			process.exit(1);
		});
}