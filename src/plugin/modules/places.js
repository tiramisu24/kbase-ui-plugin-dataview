/*global define*/
/*jslint white:true,browser:true*/
define([
    'kb/common/html'
], function (html) {
    'use strict';
    function factory(config) {
        var root = config.root, places = {},
            div = html.tag('div');
        
        // IMPLEMENTATION
        
        function addPlace(name) {
            if (places[name]) {
                throw new Error('Place already defined: ' + name);
            }
            var id = html.genId();
            places[name] = {
                id: id
            };
            return id;
        }
        function addPlaceHolder(name) {
            return div({id: addPlace(name)});
        }
        function getPlace(name) {
            var place =  places[name];
            if (place === undefined) {
                throw new Error('Place not defined: ' + name);
            }
            return place;
        }
        function getPlaceNode(name) {
            var place = getPlace(name);
            if (!place.node) {
                place.node = document.getElementById(place.id);
            }
            if (!place.node) {
                throw new Error('Place does not exist in the DOM: ' + place + ' : ' + place.id);
            }
            return place.node;
        }
        function setPlaceContent(name, content) {
            var place = getPlaceNode(name);
            place.innerHTML = content;
        }
        function appendPlaceContent(name, content) {
            var place = getPlaceNode(name),
                temp = document.createElement('div');
            
            temp.innerHTML = content;
            place.appendChild(temp.firstChild)
        }
        
        return {
            add: addPlace,
            get: getPlace,
            getNode: getPlaceNode,
            setContent: setPlaceContent,
            addPlaceHolder: addPlaceHolder,
            appendContent: appendPlaceContent
        };
    }
        
    return {
        make: function (config) {
            return factory(config);
        }
    };
});