define([
    'bluebird',
    'kb_common/html',
    'kb_widget/widgetSet',
    'plugins/dataview/modules/utils'
], function(
    Promise,
    html,
    WidgetSet,
    utils) {
    'use strict';

    function renderBSCollapsiblePanel(config) {
        var div = html.tag('div'),
            span = html.tag('span'),
            h4 = html.tag('h4'),
            panelId = html.genId(),
            headingId = html.genId(),
            collapseId = html.genId();

        return div({ class: 'panel-group kb-widget', id: panelId, role: 'tablist', 'aria-multiselectable': 'true' }, [
            div({ class: 'panel panel-default' }, [
                div({ class: 'panel-heading', role: 'tab', id: headingId }, [
                    h4({ class: 'panel-title' }, [
                        span({ 'data-toggle': 'collapse', 'data-parent': '#' + panelId, 'data-target': '#' + collapseId, 'aria-expanded': 'false', 'aria-controls': collapseId, class: 'collapsed', style: { cursor: 'pointer' } }, [
                            span({ class: 'fa fa-' + config.icon + ' fa-rotate-90', style: { 'margin-left': '10px', 'margin-right': '10px' } }),
                            config.title
                        ])
                    ])
                ]),
                div({ class: 'panel-collapse collapse', id: collapseId, role: 'tabpanel', 'aria-labelledby': 'provHeading' }, [
                    div({ class: 'panel-body' }, [
                        config.content
                    ])
                ])
            ])
        ]);
    }

    function widget(config) {
        var mount, container, runtime = config.runtime,
            widgetSet = WidgetSet.make({ runtime: runtime }),
            rendered;

        function renderPanel() {
            var div = html.tag('div');
            return div({ class: 'kbase-view kbase-dataview-view container-fluid', 'data-kbase-view': 'dataview' }, [
                div({ class: 'row' }, [
                    div({ class: 'col-sm-12' }, [
                        div({ id: widgetSet.addWidget('kb_dataview_download') })
                    ]),
                    div({ class: 'col-sm-12' }, [
                        div({ id: widgetSet.addWidget('kb_dataview_copy') })
                    ]),
                    div({ class: 'col-sm-12' }, [
                        div({ id: widgetSet.addWidget('kb_dataview_overview') }),
                        renderBSCollapsiblePanel({
                            title: 'Data Provenance and Reference Network',
                            icon: 'sitemap',
                            content: div({ id: widgetSet.addWidget('kb_dataview_provenance') })
                        }),
                        renderBSCollapsiblePanel({
                            title: 'Data Provenance and Reference Network ... in Progress',
                            icon: 'sitemap',
                            content: div({ id: widgetSet.addWidget('kb_dataview_provenance_v2') })
                        }),
                        div({ id: widgetSet.addWidget('kb_dataview_dataObjectVisualizer') })
                    ])
                ])
            ]);
        }

        function init(config) {
            rendered = renderPanel();
            return widgetSet.init(config);
        }

        function attach(node) {
            mount = node;
            container = document.createElement('div');
            mount.appendChild(container);
            container.innerHTML = rendered;
            return widgetSet.attach(node);
        }

        function start(params) {
            return utils.getObjectInfo(runtime, params)
                .then(function(objectInfo) {
                    runtime.send('ui', 'setTitle', 'Data View for ' + objectInfo.name);
                    return objectInfo;
                })
                .then(function(objectInfo) {
                    params.objectInfo = objectInfo;
                    return Promise.all([objectInfo, widgetSet.start(params)]);
                })

            .spread(function(objectInfo) {
                // Disable download button for the time being.
                // Will re-enable when we have time to deal with it.
                //     runtime.send('ui', 'addButton', {
                //         name: 'downloadObject',
                //         label: 'Download',
                //         style: 'default',
                //         icon: 'download',
                //         toggle: true,
                //         params: {
                //             ref: objectInfo.ref
                //         },
                //         callback: function () {
                //             runtime.send('downloadWidget', 'toggle');
                //         }
                //     });

                runtime.send('ui', 'addButton', {
                    name: 'copyObject',
                    label: 'Copy',
                    style: 'default',
                    icon: 'copy',
                    toggle: true,
                    params: {
                        ref: objectInfo.ref
                    },
                    callback: function() {
                        runtime.send('copyWidget', 'toggle');
                    }
                });
            });
        }

        function run(params) {
            return widgetSet.run(params);
        }

        function stop() {
            return widgetSet.stop();
        }

        function detach() {
            return widgetSet.detach()
                .finally(function() {
                    if (mount && container) {
                        mount.removeChild(container);
                        container.innerHTML = '';
                    }
                });
        }

        return {
            init: init,
            attach: attach,
            start: start,
            run: run,
            stop: stop,
            detach: detach
        };
    }

    return {
        make: function(config) {
            return widget(config);
        }
    };
});