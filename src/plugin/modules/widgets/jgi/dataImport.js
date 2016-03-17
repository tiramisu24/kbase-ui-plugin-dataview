/*global define*/
/*jslint white:true,browser:true*/
define([
    'bluebird',
    'kb/common/html',
    'kb/common/domEvent',
    'kb/service/client/workspace',
    'kb/service/utils'
], function (Promise, html, domEvent, Workspace, serviceUtils) {
    'use strict';

    var types = {
        'KBaseFile.SingleEndLibrary': {
            type: 'app',
            nicetype: 'Single End Read Library',
            name: 'Assembly and Annotation',
            id: 'genome_assembly',
            appParam: '1,read_library,'
        },
        'KBaseFile.PairedEndLibrary': {
            type: 'app',
            nicetype: 'Paired End Read Library',
            name: 'Assembly and Annotation',
            id: 'genome_assembly',
            appParam: '1,read_library,'
        },
        'KBaseFile.AssemblyFile': {
            type: 'method',
            nicetype: 'Assembly File',
            name: 'Assembly File to ContigSet',
            id: 'convert_annotation_file_to_contig_set',
            appParam: '1,input_assyfile,' //1 is ignored
        },
        none: {
            nicetype: null,
            app: null
        }
    }, t = html.tag, ul = t('ul'), li = t('li'), p = t('p'), h3 = t('h3'),
        button = t('button'), span = t('span'), div = t('div'), a = t('a'),
        table = t('table'), tr = t('tr'), th = t('th'), td = t('td'),
        input = t('input'), select = t('select'), option = t('option');
        
    var sectionHeader = t('div', {
            ignoreCache: true,
            attribs: {style: {
                    fontWeight: 'bold', 
                    fontSize: '120%', 
                    margin: '0px 0 10px 0', 
                    color: 'gray'
                }}});

    function getTimeStr(objInfoTimeStamp) {
        // f-ing safari, need to add extra ':' delimiter to parse the timestamp
        // actually safari is ES5 compliant -- the subset of iso8601 described therein specifies a colon in the 
        // tz offset.
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            tokens = objInfoTimeStamp.split('+'), // this is just the date without the GMT offset
            tzOffsetPart = tokens[1];

        if (tzOffsetPart.length === 4) {
            tzOffsetPart = tzOffsetPart.substr(0, 2) + ':' + tzOffsetPart.substr(2, 2);
        }
        var newTimestamp = tokens[0] + '+' + tzOffsetPart,
            date = new Date(newTimestamp);
        if (isNaN(date)) {
            return 'invalid date';
        }
        // forget about time since, just show the date.
        return months[date.getMonth()] +
            " " + date.getDate() +
            ", " + date.getFullYear();
    }

    function makePath(path, params) {
        var queryString;
        if (params) {
            queryString = Object.keys(params).map(function (key) {
                var value = params[key];
                return [key, value].map(function (value) {
                    return encodeURIComponent(value);
                }).join('=');
            }).join('&');
        }
        return '#' + [path.join('/'), queryString].filter(function (value) {
            return value;
        }).join('?');
    }

    function copyButton() {
        return div([
            a({class: 'btn btn-info', href: '#', style: {margin: '5px'}}, 'Copy and Open Narrative')
        ]);
    }

    function factory(config) {
        var container, parent, runtime = config.runtime, events = domEvent.make(),
            model = {
                data: {},
                state: {
                    newNarrative: true
                }
            };

        function narrativesDropdownx(narrativeWorkspaces) {
            var dropdownId = html.genId();

            return div({class: 'dropdown', style: {margin: '5px'}}, [
                button({class: 'btn btn-default dropdown-toggle', type: 'button', id: dropdownId,
                    dataToggle: 'dropdown', areaExpanded: 'true'}, [
                    'Select Narrative'
                ]),
                span({class: 'caret', style: {marginleft: '5px'}}),
                ul({class: 'dropdown-menu', role: 'menu', ariaLabeledby: dropdownId},
                    narrativeWorkspaces

                    .map(function (workspace) {
                        return li({role: 'presentation'}, [
                            a({role: 'menuitem', tabindex: -1}, [
                                workspace.metadata.narrative_nice_name,
                                '(' + getTimeStr(workspace.moddate) + ')'
                            ])
                        ]);
                    }))
            ]);
        }

        // DATA OPS
        function copyObjectToNarrative(sourceRef, objectName, destinationWorkspaceId) {
            var workspace = new Workspace(runtime.config('services.workspace.url'), {
                token: runtime.service('session').getAuthToken()
            });
            return workspace.copy_object({
                from: {ref: sourceRef},
                to: {wsid: destinationWorkspaceId, name: objectName}
            })
//                .then(function (result) {
//                    var copiedObjectInfo = serviceUtils.objectInfoToObject(result);
//                    return workspace.rename_object({
//                        obj: copiedObjectInfo.ref,
//                        new_name: objectName
//                    });
//                })
                .then(function (result) {
                    console.log('RENAMED');
                    console.log(result);
                    return serviceUtils.objectInfoToObject(result);
                });
        }

        function makeNarrativeUrl(workspaceInfo) {
            return runtime.config('services.narrative.url') + '/' + ['narrative', 'ws.' + workspaceInfo.id + '.obj.' + workspaceInfo.metadata.narrative].join('/');
        }



        // EVENT HANDLERS

        function handleCopyToNarrative(e) {
            e.preventDefault();
            
            if (e.target.attributes.disabled !== undefined) {
                return;
            }

            // Check that we are ok.
            if (!model.state.selectedIndex) {
                runtime.send('ui', 'alert', {
                    type: 'danger',
                    message: 'Sorry, you must select a Narrative to copy the object into'
                });
                return;
            }

            var narrative = model.data.narrativeWorkspacesMap[model.state.selectedNarrative];

            copyObjectToNarrative(model.data.objectInfo.ref, model.state.copyToNarrativeObjectName, narrative.id)
                .then(function (newObjectInfo) {
                    runtime.send('ui', 'alert', {
                        type: 'success',
                        message: 'Successfully copied the object into narrative ' + a({href: makeNarrativeUrl(narrative), target: '_blank'}, narrative.metadata.narrative_nice_name) + '.'
                    });
                    return null;
                })
                .catch(function (err) {
                    runtime.send('ui', 'alert', {
                        type: 'danger',
                        message: 'Error! ' + err.error.message
                    });
                });
        }

        function handleCopyToAndOpenNewNarrative(e) {
            e.preventDefault();

            var params = {
                copydata: model.data.objectInfo.ref,
                appparam: model.data.typeInfo.appParam + model.data.objectInfo.name
            };

            if (model.data.typeInfo.type === 'app') {
                params.app = model.data.typeInfo.id;
            } else {
                params.method = model.data.typeInfo.id;
            }

            var copyUrl = makePath(['narrativemanager', 'new'], params);

            runtime.send('app', 'redirect', {
                url: copyUrl,
                newWindow: true
            });
            runtime.send('ui', 'alert', {
                type: 'success',
                message: 'Successfully requested new Narrative. It should open in a separate browser tab or window.'
                // message: 'Created new narrative, copied this object to it, and inserted the ' + model.data.typeInfo.type + ' ' + model.data.typeInfo.name
            });
        }

//        function handleNewNarrative(e) {
//            e.preventDefault();
//            if (e.target.checked) {
//                model.state.newNarrative = true;
//                model.state.selectedIndex = null;
//                model.state.selectedNarrative = null;
//            } else {
//                model.state.newNarrative = false;
//            }
//            refresh(model);
//        }

        function handleSelectNarrative(e) {
            e.preventDefault();
            var selected = e.target.selectedIndex,
                selectedValue = e.target.options[selected].value;

            if (selected === 0) {
                model.state.selectedIndex = null;
                model.state.selectedNarrative = null;
                model.state.newNarrative = true;
            } else {
                model.state.selectedIndex = selected;
                model.state.selectedNarrative = selectedValue;
                model.state.newNarrative = false;
            }
            refresh(model);
        }

        function handleNewNarrativeNameChanged(e) {
            e.preventDefault();
            model.state.newNarrativeObjectName = fixObjectName(e.target.value);
            refresh(model);
        }

        function handleNewNarrativeNameKeyUp(e) {
            e.preventDefault();
            // model.state.newNarrativeObjectName = e.target.value;
            debug();
            // refresh(model);
        }

        function handleCopyToNarrativeNameChanged(e) {
            e.preventDefault();
            // model.state.copyToNarrativeObjectName = e.target.value;
            refresh(model);
        }

        function fixObjectName(name) {
            return name
                .replace(/\s/g, '_')
                .replace(/\?/g, '')
                .replace(/\,/g, '');
        }

        function handleCopyToNarrativeNameKeyUp(e) {
            e.preventDefault();
            model.state.copyToNarrativeObjectName = fixObjectName(e.target.value);
            // refresh(model);
            // debug();
        }

        function handleOpenNarrative(e) {
            e.preventDefault();
            var selectedNarrative = model.data.narrativeWorkspacesMap[model.state.selectedNarrative],
                url = makeNarrativeUrl(selectedNarrative);

            runtime.send('app', 'redirect', {
                url: url,
                newWindow: true
            });
        }



        // RENDERERS

        function narrativesDropdown(narrativeWorkspaces) {
            var dropdownId = html.genId();

            return select({class: 'form-control', id: events.addEvent('change', handleSelectNarrative)},
                [option({value: ''}, 'select a narrative')].concat(narrativeWorkspaces
                .sort(function (a, b) {
                    return a.metadata.narrative_nice_name.localeCompare(b.metadata.narrative_nice_name);
                })
                .map(function (workspace) {
                    // var ref = workspace.id + '/' + workspace.metadata.narrative;
                    return option({value: String(workspace.id), selected: (model.state.selectedNarrative === String(workspace.id))}, workspace.metadata.narrative_nice_name + ' (' + getTimeStr(workspace.moddate) + ')');
                })));
        }

        function debug() {
            var d = document.getElementById('debug');
            d.innerHTML = div({style: {whiteSpace: 'pre'}}, JSON.stringify(model.state, true, 4));
        }

        function render(model) {
            // objectInfo, workspaceInfo, narrativeWorkspaces, typeInfo) {
            var data = model.data,
                typeNameNice = data.typeInfo.nicetype || data.objectInfo.type,
                narrativeName = data.workspaceInfo.metadata.narrative_nice_name ||
                '(data only) ' + data.workspaceInfo.name,
                ref = data.objectInfo.wsid + "/" + data.objectInfo.id + "/" + data.objectInfo.version,
                basicInfo = {
                    name: data.objectInfo.name,
                    narrative: narrativeName,
                    type: a({href: '#spec/type/' + data.objectInfo.type}, typeNameNice),
                    imported: getTimeStr(data.objectInfo.save_date),
                    permref: a({href: makePath(['dataview', data.objectInfo.wsid, data.objectInfo.id, data.objectInfo.version])}, ref)
                };


            var basicInfoTable = html.makeObjTable(basicInfo, {
                rotated: true,
                columns: [
                    {
                        key: 'name',
                        label: 'Object name'
                    },
                    {
                        key: 'narrative',
                        label: 'In Narrative'
                    },
                    {
                        key: 'type',
                        label: 'Type'
                    },
                    {
                        key: 'imported',
                        label: 'Imported on'
                    },
                    {
                        key: 'permref',
                        label: 'Object permanent reference'
                    }
                ]
            });

            var copyToNarrative = narrativesDropdown(data.narrativeWorkspaces);

            return div({class: 'container-fluid'}, [
                div({class: 'row'}, [
                    div({class: 'col-md-6'}, [
                        sectionHeader('Copy Object to New Narrative'),
                        p('Use this tool to copy the JGI import object into a new Narrative, which will be created on the fly. Inserts and configures the indicated app or method with the data object set as an input parameter.'),
                        table({class: 'table table-bordered'}, [
                            tr([
                                th({style: {verticalAlign: 'middle'}}, ['Insert ' + (data.typeInfo.app ? 'App' : 'Method')]),
                                td(a({href: makePath(['narrativestore', data.typeInfo.type, data.typeInfo.id])}, data.typeInfo.name))
                            ]),
                            tr([
                                th('Object name'),
                                td(input({
                                    type: 'text',
//                                    id: events.addEvents([
//                                        {
//                                            type: 'change',
//                                            handler: handleNewNarrativeNameChanged
//                                        },
//                                        {
//                                            type: 'keyup',
//                                            handler: handleNewNarrativeNameKeyUp
//                                        }
//                                    ]),
                                    value: model.state.newNarrativeObjectName || data.objectInfo.name,
                                    readonly: true,
                                    style: {width: '100%'}
                                }))
                            ]),
                            tr([
                                th(),
                                td(a({
                                    class: 'btn btn-primary', href: '#',
                                    style: {margin: '5px'},
                                    id: events.addEvent('click', handleCopyToAndOpenNewNarrative)
                                }, 'Copy to New Narrative'))
                            ])
                        ]),
                        sectionHeader('Copy Object to Existing Narrative'),
                        p('Use this tool to copy the JGI import object into any Narrative to which you have write access.'),
                        table({class: 'table table-bordered'}, [
                            tr([
                                th({style: {verticalAlign: 'middle'}}, 'Narratives (writable)'), 
                                td([
                                    copyToNarrative,
                                    (function () {
                                        if (model.state.selectedNarrative) {
                                            var narrative = model.data.narrativeWorkspacesMap[model.state.selectedNarrative];
                                            return [
                                                '<br>',
                                                button({
                                                    class: 'btn btn-default',
                                                    id: events.addEvent('click', handleOpenNarrative)
                                                }, 'Open Narrative <i>' + narrative.metadata.narrative_nice_name + '</i>')
                                            ];                                      
                                        }
                                    }())
                                ])
                            ]),
                            tr([
                                th('Object name'),
                                td(input({
                                    type: 'text',
                                    readonly: true,
//                                    id: events.addEvents([
//                                        {
//                                            type: 'change',
//                                            handler: handleCopyToNarrativeNameChanged
//                                        },
//                                        {
//                                            type: 'keyup',
//                                            handler: handleCopyToNarrativeNameKeyUp
//                                        }
//                                    ]),
                                    value: model.state.copyToNarrativeObjectName || data.objectInfo.name,
                                    style: {width: '100%'}
                                }))
                            ]),
                            tr([
                                th(),
                                td(a({
                                    class: 'btn btn-primary', href: '#',
                                    style: {margin: '5px'},
                                    disabled: (model.state.selectedNarrative ? false : true),
                                    id: events.addEvent('click', handleCopyToNarrative)
                                }, 'Copy to Narrative'))
                            ])
                        ])
                    ]),
                    div({class: 'col-md-6'}, [
                        sectionHeader('Object Summary'),
                        p('This is the original object imported from JGI source'),
                        basicInfoTable,
                        div({id: 'debug'})
                    ])
                ])
            ]);
        }

        function refresh(model) {
            events.detachEvents();
            container.innerHTML = render(model);
            events.attachEvents();
        }



        function fetch(params) {
            var workspace = new Workspace(runtime.config('services.workspace.url'), {
                token: runtime.service('session').getAuthToken()
            }),
                objectRef = params.workspaceId + '/' + params.objectId,
                workspaceRef;
            if (params.workspaceId.match(/^\d+$/)) {
                workspaceRef = {id: parseInt(params.workspaceId, 10)};
            } else {
                workspaceRef = {workspace: params.workspaceId};
            }
            return Promise.all([
                workspace.get_object_info([{ref: objectRef}]),
                workspace.get_workspace_info(workspaceRef),
                workspace.list_workspace_info({perm: 'w'})
            ])
                .spread(function (objectInfo, workspaceInfo, workspacesInfo) {
                    // Scan through the workspaces and pull out the narratives.
                    for (var i = workspacesInfo.length - 1; i >= 0; i--) {
                        var narnnicename = workspacesInfo[i][8]
                            .narrative_nice_name;
                        if (narnnicename === null) {
                            workspacesInfo.splice(i, 1);
                        }
                    }
                    var narrativeWorkspaces = workspacesInfo
                        .filter(function (workspace) {
                            var meta = workspace[8];
                            if (meta &&
                                (meta.is_temporary && meta.is_temporary !== 'true') &&
                                meta.narrative &&
                                meta.narrative_nice_name) {
                                return true;
                            }
                            return false;
                        })
                        .map(function (workspace) {
                            return serviceUtils.workspaceInfoToObject(workspace);
                        });

                    return [serviceUtils.objectInfoToObject(objectInfo[0]),
                        serviceUtils.workspaceInfoToObject(workspaceInfo),
                        narrativeWorkspaces
                    ];
                })
                .spread(function (objectInfo, workspaceInfo, narrativeWorkspaces) {
                    var narrativeName = workspaceInfo.metadata.narrative_nice_name;
                    if (narrativeName) {
                        workspaceInfo.narrativeName = narrativeName;
                    } else {
                        workspaceInfo.narrativeName = '(data only) ' + workspaceInfo.name;
                    }

                    var narrativeMap = {};
                    narrativeWorkspaces.forEach(function (narrative) {
                        narrativeMap[narrative.id] = narrative;
                    })

                    var typeName = objectInfo.type.split('-')[0];
                    var typeInfo = types[typeName] || types.none;
                    model.data = {
                        objectInfo: objectInfo,
                        workspaceInfo: workspaceInfo,
                        narrativeWorkspaces: narrativeWorkspaces,
                        narrativeWorkspacesMap: narrativeMap,
                        typeInfo: typeInfo
                    };
                    model.state.copyToNarrativeObjectName = objectInfo.name;
                    model.state.newNarrativeNarrativeObjectName = objectInfo.name;
                    return model;
                });
        }

        // WIDGET API

        function attach(node) {
            container = document.createElement('div');
            parent = node;
            parent.appendChild(container);

        }
        function start(params) {
            return fetch(params)
                .then(function (model) {
                    refresh(model);
                    return null;
                });
        }
        return {
            attach: attach,
            start: start
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});