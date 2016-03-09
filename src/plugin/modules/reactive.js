/*global define*/
/*jslint white:true,browser:true*/
/*
 * reactive
 * Maintains state, reacts to state changes by triggering registered actions.
 * The canonical use case is data as state, and render as as action.
 * State is represented as a simple object. 
 * Access is by way of property strings.
 * Thus we can (later) register actions upon internal branches of the
 * object tree.
 */
define([
    './minidom'
], function (Minodom) {
    'use strict';

    function factory(config) {
        // now the fun begins...
        var state = {},
            listeners = {
                listeners: [],
                props: {}
            },
                root = config.node,
                minidom = Minidom.make(config.node);

        function getItem(path, defaultValue) {
            if (typeof path === 'string') {
                path = path.split('.');
            }
            var i, temp = state;
            for (i = 0; i < path.length; i += 1) {
                // The default value is strictly for the case in which a
                // property does not exist.
                if ((temp === undefined) ||
                    (typeof temp !== 'object') ||
                    (temp === null)) {
                    return defaultValue;
                }
                temp = temp[path[i]];
            }
            if (temp === undefined) {
                return defaultValue;
            }
            return temp;
        }

        function hasItem(path) {
            if (typeof path === 'string') {
                path = path.split('.');
            }
            var i, temp = state;
            for (i = 0; i < path.length; i += 1) {
                if ((temp === undefined) ||
                    (typeof temp !== 'object') ||
                    (temp === null)) {
                    return false;
                }
                temp = temp[path[i]];
            }
            if (temp === undefined) {
                return false;
            }
            return true;
        }

        function setItem(path, value) {
            if (typeof path === 'string') {
                path = path.split('.');
            }
            if (path.length === 0) {
                return;
            }
            // pop off the last property for setting at the end.
            var propKey = path.pop(),
                key, temp = state;
            // Walk the path, creating empty objects if need be.
            while (path.length > 0) {
                key = path.shift();
                if (temp[key] === undefined) {
                    temp[key] = {};
                }
                temp = temp[key];
            }
            // Finally set the property.
            temp[propKey] = value;
            changed(propKey, value);
            return value;
        }

        function incrItem(path, increment) {
            if (typeof path === 'string') {
                path = path.split('.');
            }
            if (path.length === 0) {
                return;
            }
            increment = (increment === undefined) ? 1 : increment;
            var propKey = path.pop(),
                key, temp = state;
            while (path.length > 0) {
                key = path.shift();
                if (temp[key] === undefined) {
                    temp[key] = {};
                }
                temp = temp[key];
            }
            if (temp[propKey] === undefined) {
                temp[propKey] = increment;
            } else {
                if (typeof temp[propKey] === 'number') {
                    temp[propKey] += increment;
                } else {
                    throw new Error('Can only increment a number');
                }
            }
            changed(propKey, temp[propKey]);
            return temp[propKey];
        }

        function deleteItem(path) {
            if (typeof path === 'string') {
                path = path.split('.');
            }
            if (path.length === 0) {
                return;
            }
            var propKey = path.pop(),
                key, temp = state;
            while (path.length > 0) {
                key = path.shift();
                if (temp[key] === undefined) {
                    return false;
                }
                temp = temp[key];
            }
            delete temp[propKey];
            changed(propKey);
            return true;
        }
        
        function ensurePath(path) {
             if (typeof path === 'string') {
                return path.split('.');
            }
            return path;            
        }
        
        function setListener(maybePath, listener) {
            var path = ensurePath(maybePath);
            // pop off the last property for setting at the end.
            var // propKey = path.pop(),
                key, temp = listeners;
            // Walk the path, creating empty objects if need be.
            while (path.length > 0) {
                key = path.shift();
                if (temp.props[key] === undefined) {
                    temp.props[key] = {
                        listeners: [],
                        props: {}
                    };
                }
                temp = temp.props[key];
            }
            // Finally set the property.
            temp.listeners.push({
                onChange: listener
            });
        }
        
        function getListener(maybePath) {
           var path = ensurePath(maybePath);
            var i, temp = listeners;
            for (i = 0; i < path.length; i += 1) {
                // The default value is strictly for the case in which a
                // property does not exist.
                if ((temp === undefined) ||
                    (typeof temp !== 'object') ||
                    (temp === null)) {
                    return;
                }
                temp = temp[path[i]];
            }
            return temp;
        }

        function listen(path, action) {
            // on the given property path, place an action node.
            setListener(path, action);
        }
                
        function changed(path, newValue) {
            // for now, we just have a universal listener.
            
            // find listeners affected by changes on this path...
            // this is listeners on any property from the leaf to the root.
            
            // but not yet.
            
            var listener = getListener([]);
            if (listener) {
                listener.listeners.forEach(function (listener) {
                    listener.onChange(state, newValue);
                });
            }
        }

        return {
            setItem: setItem,
            getItem: getItem,
            incrItem: incrItem,
            deleteItem: deleteItem,
            listen: listen
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});