/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
define([
    'jquery',
    'bluebird',
    'kb/common/html',
    'kb/widget/adapters/objectWidget',
    'kb/widget/widgetSet',
        //'kb_widgetAdapters_kbWidgetAdapter',
        //'kb_dataview_widget_provenance',
        //'kb_dataview_widget_download'
],
    function ($, Promise, html, widgetAdapter, WidgetSet) {
        'use strict';

        function renderBSCollapsiblePanel(config) {
            var div = html.tag('div'),
                span = html.tag('span'),
                h4 = html.tag('h4');

            var panelId = html.genId(),
                headingId = html.genId(),
                collapseId = html.genId();

            return div({class: 'panel-group kb-widget', id: panelId, role: 'tablist', 'aria-multiselectable': 'true'}, [
                div({class: 'panel panel-default'}, [
                    div({class: 'panel-heading', role: 'tab', id: headingId}, [
                        h4({class: 'panel-title'}, [
                            span({'data-toggle': 'collapse', 'data-parent': '#' + panelId, 'data-target': '#' + collapseId, 'aria-expanded': 'false', 'aria-controls': collapseId, class: 'collapsed', style: {cursor: 'pointer'}}, [
                                span({class: 'fa fa-'+config.icon+' fa-rotate-90', style: {'margin-left': '10px', 'margin-right': '10px'}}),
                                config.title
                            ])
                        ])
                    ]),
                    div({class: 'panel-collapse collapse', id: collapseId, role: 'tabpanel', 'aria-labelledby': 'provHeading'}, [
                        div({class: 'panel-body'}, [
                            config.content
                        ])
                    ])
                ])
            ]);
        }

        function widget(config) {
            var mount, container, runtime = config.runtime,
                widgetSet = WidgetSet.make({runtime: runtime}),
                rendered;

            function renderPanel() {
                var div = html.tag('div'),
                    panel = div({class: 'kbase-view kbase-dataview-view container-fluid', 'data-kbase-view': 'dataview'}, [
                    div({class: 'row'}, [
                        div({class: 'col-sm-12'}, [
                            div({id: widgetSet.addWidget('kb_dataview_overview')}),
                            renderBSCollapsiblePanel({
                                title: 'Data Provenance and Reference Network',
                                icon: 'sitemap',
                                content: div({id: widgetSet.addWidget('kb_dataview_provenance')})
                            }),
                            div({id: widgetSet.addWidget('kb_dataview_dataObjectVisualizer')})
                        ])
                    ])
                ]);
                return({
                    title: 'Dataview',
                    content: panel
                });
            }

            function init(config) {
                return Promise.try(function () {
                    rendered = renderPanel();
                    return widgetSet.init(config);
                });
            }

            function attach(node) {
                return Promise.try(function () {
                    mount = node;
                    container = document.createElement('div');
                    mount.appendChild(container);
                    container.innerHTML = rendered.content;
                    return widgetSet.attach(node);
                });
            }
            function start(params) {
                return Promise.try(function () {
                    runtime.send('ui', 'setTitle', rendered.title);
                    return widgetSet.start(params);
                });
            }
            function run(params) {
                return Promise.try(function () {
                    return widgetSet.run(params);
                });
            }
            function stop() {
                return Promise.try(function () {
                    return widgetSet.stop();
                });
            }
            function detach() {
                return Promise.try(function () {
                    return widgetSet.detach();
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
            make: function (config) {
                return widget(config);
            }
        };
    });
