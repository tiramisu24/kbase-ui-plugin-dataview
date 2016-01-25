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
    'kb/service/utils',
    'kb/service/client/workspace'
        //'kb_widgetAdapters_kbWidgetAdapter',
        //'kb_dataview_widget_provenance',
        //'kb_dataview_widget_download'
],
    function ($, Promise, html, widgetAdapter, WidgetSet, apiUtils, Workspace) {
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
                                span({class: 'fa fa-' + config.icon + ' fa-rotate-90', style: {'margin-left': '10px', 'margin-right': '10px'}}),
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

            function getObjectInfo(params) {
                return Promise.try(function () {
                    var workspaceId = params.workspaceId,
                        objectId = params.objectId,
                        objectVersion = params.objectVersion;

                    if (workspaceId === undefined) {
                        throw new Error('Workspace id or name is required');
                    }
                    if (objectId === undefined) {
                        throw new Error('Object id or name is required');
                    }

                    var objectRef = apiUtils.makeWorkspaceObjectRef(workspaceId, objectId, objectVersion),
                        workspaceClient = new Workspace(runtime.getConfig('services.workspace.url'), {
                            token: runtime.service('session').getAuthToken()
                        });

                    return workspaceClient.get_object_info_new({
                        objects: [{ref: objectRef}],
                        ignoreErrors: 1
                    })
                        .then(function (objectList) {
                            if (objectList.length === 0) {
                                throw new Error('Object not found: ' + objectRef);
                            }
                            if (objectList.length > 1) {
                                throw new Error('Too many objects found: ' + objectRef + ', ' + objectList.length);
                            }
                            return apiUtils.object_info_to_object(objectList[0]);
                        });
                })
            }

            function renderPanel() {
                var div = html.tag('div'),
                    panel = div({class: 'kbase-view kbase-dataview-view container-fluid', 'data-kbase-view': 'dataview'}, [
                        div({class: 'row'}, [
                            div({class: 'col-sm-12'}, [
                                div({id: widgetSet.addWidget('kb_dataview_download')})
                            ]),
                            div({class: 'col-sm-12'}, [
                                div({id: widgetSet.addWidget('kb_dataview_copy')})
                            ]),
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
                    return getObjectInfo(params)
                        .then(function (objectInfo) {
                            params.objectInfo = objectInfo;
                        
                            runtime.send('ui', 'setTitle', rendered.title);
                            
                            runtime.send('ui', 'addButton', {
                                name: 'downloadObject',
                                label: 'Download',
                                style: 'default',
                                icon: 'download',
                                toggle: true,
                                params: {
                                    ref: objectInfo.ref
                                },
                                callback: function () {
                                    runtime.send('downloadWidget', 'toggle');
                                }
                            });
                            
                            runtime.send('ui', 'addButton', {
                                name: 'copyObject',
                                label: 'Copy',
                                style: 'default',
                                icon: 'copy',
                                toggle: true,
                                params: {
                                    ref: objectInfo.ref
                                },
                                callback: function () {
                                    runtime.send('copyWidget', 'toggle');
                                }
                            });
                            
                            return widgetSet.start(params);
                        });
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