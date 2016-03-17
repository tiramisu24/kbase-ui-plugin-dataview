/*global define*/
/*jslint white:true,browser:true*/
define([
    'kb/common/html',
    'kb/widget/widgetSet',
    'plugins/dataview/modules/utils'
], function (html, WidgetSet, utils) {
    'use strict';

    function factory(config) {
        var runtime = config.runtime,
            container,
            widgetSet = WidgetSet.make({
                runtime: runtime
            }),
            t = html.tag,
            layout;

        function renderLayout() {
            var div = t('div');
            return  div({class: 'container-fluid'}, [
                div({class: 'row'}, [
                    div({class: 'col-md-12'}, [
                        html.makePanel({
                            title: 'Copy data imported from JGI into a new or existing Narrative',
                            content: div({id: widgetSet.addWidget('kb_dataview_jgiDataImport')})
                        })                        
                    ])
                ])
            ]);
        }


        function init(config) {
            layout = renderLayout();
            runtime.send('ui', 'setTitle', 'JGI Data Import');
            return widgetSet.init(config);
        }

        function attach(node) {
            container = document.createElement('div');
            node.appendChild(container);
            container.innerHTML = layout;
            return widgetSet.attach(container);
        }

        function start(params) {
            return widgetSet.start(params);
        }

        function stop() {
            if (container) {
                container.innerHTML = '';
            }
            return widgetSet.stop();
        }

        return {
            init: init,
            attach: attach,
            start: start,
            stop: stop
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});