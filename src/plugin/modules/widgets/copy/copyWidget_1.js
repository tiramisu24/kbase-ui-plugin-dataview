/*global define*/
/*jslint white:true,browser:true */
define([
    'knockout',
    'kb/common/html',
    'plugins/dataview/modules/places',
    'kb/service/client/workspace',
    'kb/service/utils',
    'plugins/dataview/modules/poller',
    'plugins/dataview/modules/component'
], function (ko, html, Places, WorkspaceClient, apiUtils, Poller, Component, Minidom) {
    'use strict';
    function factory(config) {
        var parent, container, runtime = config.runtime,
            tag = html.tag, a = tag('a'),
            div = tag('div'), button = tag('button'), label = tag('label'), input = tag('input'),
            table = tag('table'), tr = tag('tr'), td = tag('td'), th = tag('th'),
            form = tag('form'), select = tag('select'), option = tag('option'),
            span = tag('span'),
            places = Places.make({
                root: container
            }),
            toggleState = 'hidden',
            poller = Poller.make({interval: 5000}),
            state = {
                downloads: {}
            },
            component;

        // IMPLEMENTATION
//
//        function show() {
//            minidom.unhide();
//            // var node = places.getNode('main');
//            // node.classList.remove('hidden');
//            return true;
//        }
//
//        function hide() {
//            minidom.hide();
//            //var node = places.getNode('main');
//            //node.classList.add('hidden');
//            return true;
//        }

//        function toggle() {
//            switch (toggleState) {
//                case 'hidden':
//                    if (show()) {
//                        toggleState = 'showing';
//                    }
//                    break;
//                case 'showing':
//                    if (hide()) {
//                        toggleState = 'hidden';
//                    }
//                    break;
//            }
//        }

        function getWritableNarratives() {
            var workspaceId = state.params.objectInfo.wsid,
                workspaceClient = new WorkspaceClient(runtime.getConfig('services.workspace.url'), {
                    token: runtime.service('session').getAuthToken()
                });
            return workspaceClient.list_workspace_info({
                perm: 'w'
            })
                .then(function (data) {
                    var objects = data.map(function (workspaceinfo) {
                        return apiUtils.workspace_metadata_to_object(workspaceinfo);
                    });
                    return objects.filter(function (obj) {
                        if (obj.metadata.narrative && (!isNaN(parseInt(obj.metadata.narrative))) &&
                            // don't keep the current narrative workspace.
                            obj.id !== workspaceId &&
                            obj.metadata.narrative_nice_name &&
                            obj.metadata.is_temporary && obj.metadata.is_temporary !== 'true') {
                            return true;
                        } else {
                            return false;
                        }
                    });
                });
        }

        function doCopy() {
            alert('copying...');
        }

        function doCancel() {
            alert('canceling...');
        }
        
        function renderSelectedNarrative(selectedNarrative) {
            var content;
            
            if (selectedNarrative && selectedNarrative.length > 0) {
                content = div([
                    'Narrative is: ', selectedNarrative
                ]);
            } else {
                content = 'Create new narrative with this object';
            }
            return {
                content: content
            };
        }

        function renderCopyForm(narratives) {
            var content = form([
                table({class: 'table'}, [
                    tr([
                        td(input({type: 'radio', name: 'copyMethod', value: 'existing'})),
                        td(['Select existing Narrative: ', select({dataInput: 'existingNarrative'}, 
                                [option({value: ''}, ' ')].concat(narratives.map(function (narrative) {
                                    console.log(narrative);
                                    return option({value: [String(narrative.id), narrative.metadata.narrative].join('/')}, narrative.metadata.narrative_nice_name);
                                }))
                            )])
                    ]),
                    tr([
                        td(input({type: 'radio', name: 'copyMethod', value: 'new'})),
                        td('Copy into New Narrative')
                    ]),
                    tr([
                        td(),
                        td([
                            div({class: 'btn-toolbar', role: 'toolbar'}, [
                                div({class: 'btn-group', role: 'group'},
                                    button({class: 'btn btn-primary', dataButton: 'copy'}, 'Copy and Open Narrative')),
                                div({class: 'btn-group', role: 'group'},
                                    button({class: 'btn btn-danger', dataButton: 'cancel'}, 'Cancel'))
                            ])
                        ])
                    ])
                ])
            ]),
                events = [
                    {
                        type: 'click',
                        selector: '[data-button="copy"]',
                        listener: function (e) {
                            e.preventDefault();
                            doCopy();
                        }
                    },
                    {
                        type: 'click',
                        selector: '[data-button="cancel"]',
                        listener: function (e) {
                            e.preventDefault();
                            doCancel();
                        }

                    },
                    {
                        type: 'change',
                        selector: '[data-input="existingNarrative"]',
                        listener: function (e) {
                            var value = e.target.value;
                            // doSelectNarrative(value);
                            // console.log('i want to select my radio button, and ' + value);
                            reactive.setItem('selectedNarrative', value);
                        }
                    },
                    {
                        type: 'change',
                        selector: 'input[name="copyMethod"]',
                        listener: function(e) {
                            if (e.target.value === 'new') {
                                reactive.setItem('selectedNarrative', null);
                            }
                        }
                    }
                ];

            return {
                content: content,
                events: events
            };
        }
        
        function doSelectNarrative(narrative) {
            
            var content = renderSelectedNarrative(narrative);
            places.setContent('selectedNarrative', content.content);
        }

        function renderLayout() {
            return div({class: 'hidden', dataPlace: 'main'}, [
                div({class: 'panel panel-primary'}, [
                    div({class: 'panel-heading'}, [
                        span({class: 'panel-title', dataPlace: 'title'}, 'Copy Object to Narrative')
                    ]),
                    div({class: 'panel-body'}, [
                        div({class: 'container-fluid'}, [
                            div({class: 'col-md-8'}, [span({dataPlace: 'content'})]),
                            div({class: 'col-md-4'}, div({dataPlace: 'selectedNarrative'}))
                        ])
                    ])
                ])
            ]);
        }

        // API

        function init(config) {
        }

        function attach(node) {
            parent = node;
            container = node.appendChild(document.createElement('div'));
            component = Component.make({
                node: container
            });
        }

        function start(params) {
            // listen for events
            // listen for events
            state.params = params;
            component.setLayout(renderLayout());
            return getWritableNarratives()
                .then(function (narratives) {
                    var copyForm = renderCopyForm(narratives);
                    component.setContent('content', copyForm.content);
                    

                    copyForm.events.forEach(function (event) {
                        var nodes = minidom.findNodes('content', event.selector);
                        nodes.forEach(function (node) {
                            node.addEventListener(event.type, event.listener);
                        });
                    });
                    runtime.recv('copyWidget', 'toggle', function () {
                        minidom.toggle();
                    });
                    reactive.listen([], function (state) {
                        doSelectNarrative(state.selectedNarrative);
                        if (state.selectedNarrative && state.selectedNarrative.length > 0) {
                            // if a narrative has been selected, we need to ensure that the 
                            // radio button has been selected.
                            minidom.qsa('input[type="radio"][name="copyMethod"]')
                                .forEach(function (node) {
                                    if (node.value === 'existing') {
                                        node.checked = true;
                                    } else {
                                        node.checked = false;
                                    }
                                });
                        } else {
                            minidom.qsa('select')
                                .forEach(function (node) {
                                    node.selectedIndex = -1;
                                });
                        }
                    });
                });
        }

        function run(params) {
            // ??
        }

        function stop() {
            // remove event listeners
        }

        function detach() {
            if (container) {
                parent.removeChild(container);
            }
        }

        function destroy() {
            // ??
        }

        return {
            init: init,
            attach: attach,
            start: start,
            stop: stop,
            detach: detach,
            destroy: destroy
        };
    }
    return {
        make: function (config) {
            return factory(config);
        }
    };
});