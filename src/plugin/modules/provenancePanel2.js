define([
    'jquery',
    'bluebird',
    'kb_common/html',
    'kb_widget/adapters/objectWidget',
    'kb_widget/widgetSet',
    'kb_service/utils',
    'kb_service/client/workspace'
], function($, Promise, html, widgetAdapter, WidgetSet, apiUtils, Workspace) {
    'use strict';

    function renderBSPanel(config) {
        var div = html.tag('div');
        return div({ class: 'panel panel-default' }, [
            div({ class: 'panel-heading' }, [
                div({ class: 'panel-title' }, config.title)
            ]),
            div({ class: 'panel-body' }, [
                config.content
            ])
        ]);
    }

    function widget(config) {
        var mount, container, runtime = config.runtime,
            widgetSet = WidgetSet.make({ runtime: runtime }),
            rendered;

        function getObjectInfo(params) {
            return Promise.try(function() {
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
                        objects: [{ ref: objectRef }],
                        ignoreErrors: 1
                    })
                    .then(function(objectList) {
                        if (objectList[0] === null) {
                            throw new Error('Object not found: ' + objectRef);
                        }
                        return apiUtils.object_info_to_object(objectList[0]);
                    });
            });
        }

        function renderPanel() {
            var div = html.tag('div'),
                panel = div({ class: 'kbase-view kbase-dataview-view container-fluid', 'data-kbase-view': 'dataview' }, [
                    div({ class: 'row' }, [
                        div({ class: 'col-sm-12' }, [
                            renderBSPanel({
                                title: 'Data Provenance and Reference Network',
                                icon: 'sitemap',
                                content: div({ id: widgetSet.addWidget('kb_dataview_provenance_v2') })
                            })
                        ])
                    ])
                ]);
            return ({
                title: 'Dataview',
                content: panel
            });
        }

        function init(config) {
            return Promise.try(function() {
                rendered = renderPanel();
                return widgetSet.init(config);
            });
        }

        function attach(node) {
            return Promise.try(function() {
                mount = node;
                container = document.createElement('div');
                mount.appendChild(container);
                container.innerHTML = rendered.content;
                return widgetSet.attach(node);
            });
        }

        function start(params) {
            return Promise.try(function() {
                return getObjectInfo(params)
                    .then(function(objectInfo) {
                        params.objectInfo = objectInfo;

                        runtime.send('ui', 'setTitle', 'Data Provenance and Reference Network for ' + objectInfo.name);

                        return widgetSet.start(params);
                    });
            });
        }

        function run(params) {
            return Promise.try(function() {
                return widgetSet.run(params);
            });
        }

        function stop() {
            return Promise.try(function() {
                return widgetSet.stop();
            });
        }

        function detach() {
            return Promise.try(function() {
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
        make: function(config) {
            return widget(config);
        }
    };
});