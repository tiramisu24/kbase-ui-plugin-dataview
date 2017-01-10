/*global define*/
/*jslint white:true,browser:true*/
define([
    './reactive',
    './minidom',
    'kb_common/html'
], function (Reactive, Minidom, html) {
    'use strict';
    function factory(config) {
        var root = config.node,
            minidom = Minidom.make({node: root}),
            places = {};
        
        function setLayout(content) {
            root.innerHTML = content;
            // scan for places
            minidom.findNodes('[data-place]')
                .forEach(function (node) {
                    var name = node.getAttribute('data-place');
                    places[name] = node;
                });
        }
        
        function setContent(place, content) {
            var node = places[place];
            if (!node) {
                throw new Error('Place not defined: ' + place);
            }
            node.innerHTML = content;
        }
        
        return {
            setLayout: setLayout
        };
    }
    
    return {
        make: function (config) {
            return factory(config);
        }
    };
});