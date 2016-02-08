/*global define*/
/*jslint white:true,browser:true */
define([
], function () {
    'use strict';
    function factory(config) {
        var node = config.node,
            toggleState;
        
        function show() {
            node.classList.remove('hidden');
            toggleState = 'showing';
            return true;
        }

        function hide() {
            node.classList.add('hidden');
            toggleState = 'hidden';
            return true;
        }

        function toggle() {
            switch (toggleState) {
                case 'hidden':
                    show();
                    break;
                case 'showing':
                    hide();
                    break;
            }
        }

        if (config.show) {
            show();
        } else if (config.hide) {
            hide();
        } else {
            show();
        }

        return {
            show: show,
            hide: hide,
            toggle: toggle
        };
    }
    return {
        make: function (config) {
            return factory(config);
        }
    };
});