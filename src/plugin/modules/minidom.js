/*global define*/
/*jslint white:true,browser:true */
define([
    './places'
], function (Places) {
    'use strict';
    
    function factory(config) {
        var root = config.node,
            places = Places.make(root),
            toggleState = 'showing';
        
        function findNode(selector) {
            return root.querySelector(selector);
        }
        
        function findNodes(selectorOrPlace, selector) {
            var localNode;
            if (selector) {
                localNode = places.get(selectorOrPlace);
            } else {
                localNode = root;
                selector = selectorOrPlace
            }
            var result = localNode.querySelectorAll(selector);
            if (result === null) {
                return [];
            }
            return Array.prototype.slice.call(result);
        }
        
        function setHtml(localNode, html) {
            if (typeof localNode === 'string') {
                html = localNode;
                localNode = root;
            }
            localNode.innerHTML = html;
        }
        
        function hide() {
            root.classList.add('hidden');
        }
        
        function show() {
            root.classList.remove('hidden');
        }
        
        function toggle() {
            switch (toggleState) {
                case 'hidden':
                    if (show()) {
                        toggleState = 'showing';
                    }
                    break;
                case 'showing':
                    if (hide()) {
                        toggleState = 'hidden';
                    }
                    break;
            }
        }
      
        return {
            findNode: findNode,
            findNodes: findNodes,
            setHtml: setHtml,
            addPlace: places.add,
            getPlace: places.get,
            getPlaceNode: places.getNode,
            show: show,
            hide: hide,
            toggle: toggle
        };
    };
    
    return {
        make: function(config) {
            return factory(config);
        }
    };
});