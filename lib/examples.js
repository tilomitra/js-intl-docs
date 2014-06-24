'use strict';
/*
This module is responsible for returning an object of example data from the
`views/examples` directory. It accepts two arguments:

* type    {string}: Either 'dust', 'react', or 'hbs'
* options {object}: Right now, just supports the `cache` option.

Usage:

    var getExamples = require('path/to/this/file');
    getExamples('dust', {cache: true}).then(function (examples) {
        ...
    });

The returned `examples` object contains the following properties:

* `source` {string}: Source code (read directly from the file)

* `compiled` {function}: The compiled version of the source code, that you can
pass into Dust or Handlebars. In the case of React, this is the evaluated
JavaScript.

* `identifier` {string}: The name of the file. This is there to help with
rendering out Dust templates.

* `name` {string}: The name of the file, without the file extension. This is
there to help with exposing the templates client-side via express-state.

*/


var Promise        = require('ypromise'),
    fs             = require('fs'),
    path           = require('path'),
    Dust           = require('dustjs-linkedin'),
    Hbs            = require('handlebars');

var config = require('../config'),
    Utils  = require('./utils');

// ----------------------------------------------

module.exports = getExamples;

//Cache
var examples = {};

function getExamples (type, opts) {
    opts = opts || {};
    type = type.toLowerCase();

    //Resolve from cache if it exists.
    if (opts.cache && examples[type]) {
        return examples[type];
    }

    var examplesDir = path.join(config.dirs.examples, type),
        allFiles;

    allFiles = getExamplesForTemplate(examplesDir).map(function (fileName) {
        return readFile(examplesDir, fileName)
            .then(compile.bind(null, type));
    });

    //Modify data structure
    examples[type] = Promise.all(allFiles).then(function (results) {
        if (!results) {
            throw new Error('No examples found for template engine of type:' + type);
        }

        var exp = {};
        results.forEach(function (elem) {
            exp[elem.name] = {
                identifier: elem.identifier,
                name      : elem.name,
                source    : elem.source,
                compiled  : elem.compiled
            };
        });

        //Add to cache.
        return exp;
    });

    //TODO: pass a new object, not one that is referenced to the cache.
    return Utils.extend(examples[type], {});
}


function getExamplesForTemplate (dir) {
    return fs.readdirSync(dir);
}

function readFile (dir, fileName) {
    var pathToFile = path.join(dir, fileName);
    return new Promise(function (resolve, reject) {
        fs.readFile(pathToFile, 'utf8', function (err, contents) {
            if (err) { reject(err); }
            resolve({
                identifier: fileName,
                name      : fileName.split('.')[0],
                source    : contents,
                dir       : dir
            });
        });
    });
}

function compile (type, fileData) {
    return new Promise(function (resolve, reject) {
        var componentPath;

        switch (type) {
            case 'dust':
                fileData.compiled = Dust.compile(fileData.source, fileData.identifier);
                break;

            case 'handlebars':
                fileData.compiled = Hbs.compile(fileData.source);
                break;

            case 'react':
                //Just send back the evaluated JS for React.
                componentPath = path.join(fileData.dir, fileData.name);
                fileData.compiled = require(componentPath);
                break;

            default:
                reject(new Error('Cannot compile a template for the specified template type.'));
                break;
        }

        resolve(fileData);
    });
}