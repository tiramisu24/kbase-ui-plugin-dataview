
/*
 *  Base class for workspace object classes
 */
/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
define([], function () {
    'use strict';
    var kbObjects = function (config) {
        this.runtime = config.runtime;
    };
    return kbObjects;
});