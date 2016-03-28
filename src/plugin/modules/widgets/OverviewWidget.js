/*global define*/
/*jslint browser:true, white:true*/
define([
    'promise',
    'kb/service/utils',
    'kb/common/utils',
    'kb/common/html',
    'kb/common/dom',
    'kb/service/client/workspace',
    'kb/common/state'
],
    function (Promise, APIUtils, Utils, html, dom, Workspace, stateFactory) {
        'use strict';

        function factory(config) {
            var mount, container, runtime = config.runtime,
                workspaceId,
                objectId,
                objectVersion,
                objectRef,
                subObject = config.sub,
                state = stateFactory.make(),
                workspaceClient = new Workspace(runtime.getConfig('services.workspace.url'), {
                    token: runtime.getService('session').getAuthToken()
                });

            function dateFormat(dateString) {
                var monthLookup = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (Utils.isBlank(dateString)) {
                    return '';
                }
                var date = Utils.iso8601ToDate(dateString);
                return monthLookup[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
            }

            function fetchVersions() {
                return workspaceClient.get_object_history({
                    ref: objectRef
                })
                    .then(function (dataList) {
                        var versions = dataList.map(function (version) {
                            return APIUtils.object_info_to_object(version);
                        });
                        state.set('versions', versions.sort(function (a, b) {
                            return b.version - a.version;
                        }));
                    });
            }

            function fetchOutgoingReferences() {
                return workspaceClient.get_object_provenance([{ref: objectRef}])
                    .then(function (provdata) {
                        var refs = provdata[0].refs,
                            provenace = provdata[0].provenance;
                        provenace.forEach(function (item) {
                            refs = refs.concat(item.resolved_ws_objects);
                        });
                        if (refs.length > 100) {
                            state.set('too_many_out_refs', true);
                        } else {
                            state.set('too_many_out_refs', false);
                            return fetchObjectInfo('out_references', refs);
                        }
                        return refs;
                    });
            }
            function fetchObjectInfo(name, refs) {
                //really need a ws method to get referenced object info
                //do to this correctly. For now, just dump the reference
                //if it's not visible
                return Promise.try(function () {
                    if (!refs || refs.length < 1) {
                        return;
                    }
                    var objIds = refs.map(function (ref) {
                        return {ref: ref};
                    });
                    return workspaceClient.get_object_info_new({
                        objects: objIds,
                        ignoreErrors: 1
                    })
                        .then(function (dataList) {
                            var objects = dataList.filter(function (data) {
                                if (data) {
                                    return true;
                                }
                                return false;
                            }).map(function (data) {
                                return APIUtils.object_info_to_object(data);
                            });
                            state.set(name, objects.sort(
                                function (a, b) {
                                    return b.name - a.name;
                                }));
                        });
                });
            }
            function checkRefCount() {
                return workspaceClient.list_referencing_object_counts([{
                        ref: objectRef
                    }])
                    .then(function (sizes) {
                        if (sizes[0] > 100) {
                            state.set('too_many_inc_refs', true);
                        } else {
                            state.set('too_many_inc_refs', false);
                            return fetchReferences();
                        }
                    });
            }
            function setError(type, error) {
                state.set('status', 'error');
                var err = error.error;
                console.error(err);
                var message;
                if (typeof err === 'string') {
                    message = err;
                } else {
                    message = err.message;
                }
                state.set('error', {
                    type: type,
                    code: 'error',
                    shortMessage: 'An unexpected error occured',
                    originalMessage: message
                });
            }
            function fetchReferences() {
                return workspaceClient.list_referencing_objects([{
                        ref: objectRef
                    }])
                    .then(function (dataList) {
                        var refs = [];
                        if (dataList[0]) {
                            for (var i = 0; i < dataList[0].length; i++) {
                                refs.push(APIUtils.object_info_to_object(dataList[0][i]));
                            }
                        }
                        state.set('inc_references', refs.sort(function (a, b) {
                            return b.name - a.name;
                        }));
                        return refs;
                    });

            }
            function createDataIcon(object_info) {
                try {
                    var typeId = object_info[2],
                        type = runtime.service('type').parseTypeId(typeId),
                        icon = runtime.service('type').getIcon({type: type}),
                        div = html.tag('div'),
                        span = html.tag('span'),
                        i = html.tag('i');

                    return div([
                        span({class: 'fa-stack fa-2x'}, [
                            i({class: 'fa fa-circle fa-stack-2x', style: {color: icon.color}}),
                            i({class: 'fa-inverse fa-stack-1x ' + icon.classes.join(' ')})
                        ])
                    ]);
                } catch (err) {
                    console.error('When fetching icon config: ', err);
                    return '';
                }
            }
            function fetchData() {
                // return Promise.try() {
                // return new Promise(function (resolve, reject, notify) {
                //if (this.getParam('sub')) {
                //    state.set('sub', this.getParam('sub'));
                //}

                return workspaceClient.get_object_info_new({
                    objects: [{
                            ref: objectRef
                        }],
                    includeMetadata: 1
                })
                    .then(function (data) {
                        if (!data || data.length === 0) {
                            state.set('status', 'notfound');
                            throw new Error('notfound');
                        }
                        state.set('status', 'found');
                        var obj = APIUtils.object_info_to_object(data[0]);
                        state.set('object', obj);

                        // create the data icon
                        state.set('dataicon', createDataIcon(data[0]));
                    })
                    .then(function () {
                        // The narrative this lives in.
                        // YUCK!
                        var isIntegerId = /^\d+$/.test(workspaceId);
                        return workspaceClient.get_workspace_info({
                            id: isIntegerId ? workspaceId : null,
                            workspace: isIntegerId ? null : workspaceId
                        })
                            .then(function (data) {
                                state.set('workspace', APIUtils.workspace_metadata_to_object(data));
                            });
                    })
                    .then(function () {
                        return fetchVersions();
                    })
                    .then(function () {
                        return checkRefCount();
                    })
                    .then(function () {
                        return fetchReferences();
                    })
                    .then(function () {
                        return fetchOutgoingReferences();
                    })
                    .then(function (refs) {
                        return fetchObjectInfo(refs);
                    })
                    .then(function () {
                        // Other narratives this user has.
                        return workspaceClient.list_workspace_info({
                            perm: 'w'
                        })
                            .then(function (data) {
                                var objects = data.map(function (x) {
                                    return APIUtils.workspace_metadata_to_object(x);
                                });
                                var narratives = objects.filter(function (obj) {
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
                                state.set('writableNarratives', narratives);
                            });

                    });

            }

            function renderLayout() {
                var div = html.tag('div');
                return html.makePanel({
                    title: 'Data Overview',
                    content: div({dataWidget: 'dataview-overview'},[
                        div({dataPlaceholder: 'alert'}),
                        div({dataPlaceholder: 'content'})
                    ])
                });
            }
            var t = html.tag,
                div = t('div'),
                h3 = t('h3'),
                h4 = t('h4'),
                span = t('span'),
                p = t('p'),
                a = t('a'),
                table = t('table'),
                tr = t('tr'),
                th = t('th'),
                td = t('td');
            function renderTitleRow() {
                return tr({style: {verticalAlign: 'baseline'}}, [
                    th(state.get('dataicon')),
                    td((function () {
                        if (state.get('sub.id')) {
                            return [
                                td(h3(state.get('sub.subid'))),
                                td(['(in', a({href: '#dataview/' + objectRef}, state.get('object.name')), ')'])
                            ];
                        } else {
                            return [
                                td(h3(state.get('object.name'))),
                                td(['v', state.get('object.version')])
                            ];
                        }
                    }()))
                ]);
            }
            function renderTypeRow() {
                return [
                    tr([
                        th('Module'),
                        td({dataElement: 'module'},[
                            (function () {
                                if (state.get('sub.sub')) {
                                    return get('sub.sub') + ' in ';
                                } else {
                                    return '';
                                }
                            }()),
                            state.get('object.typeModule')
                        ])
                    ]),
                    tr([
                        th('Type'),
                        td({dataElement: 'module'}, [
                            (function () {
                                if (state.get('sub.sub')) {
                                    return get('sub.sub') + ' in ';
                                } else {
                                    return '';
                                }
                            }()),
                            a({href: '#spec/type/' + state.get('object.type'), target: '_blank'}, state.get('object.typeName'))
                        ])
                    ])
                ];

            }
            function renderNarrativeRow() {
                if (state.get('workspace.metadata.narrative_nice_name')) {
                    return tr([
                        th('In Narrative'),
                        td({dataElement: 'narrative'}, a({href: '/narrative/ws.' + state.get('workspace.id') + '.' + state.get('object.id'),
                            target: '_blank'}, state.get('workspace.metadata.narrative_nice_name')))
                    ]);
                }
                return '';
            }
            function getScheme() {
                return window.location.protocol;
            }
            function getHost() {
                return window.location.host;
            }
            function renderPermalinkRow() {
                var permalink = getScheme() + '//' + getHost() +
                    '#dataview/' + objectRef;
                if (state.get('sub.subid')) {
                    permalink += '?' + state.get('sub.sub') + '&' + state.get('sub.subid');
                }
                return tr([
                    th('Permalink'),
                    td({dataElement: 'permalink'}, a({href: permalink}, permalink))
                ]);
            }
            function renderVersionRow() {
                var version = state.get('object.version') || 'Latest';
                return tr([
                    th('Version'),
                    td({dataElement: 'version'}, version)
                ]);
            }
            function panel(content) {
                var id = html.genId(),
                    headingId = 'heading_' + id,
                    bodyId = 'body_' + id;
                return div({class: 'panel panel-default'}, [
                    div({class: 'panel-heading', role: 'tab', id: headingId}, [
                        h4({class: 'panel-title'}, [
                            span({dataToggle: 'collapse', dataParent: '#' + content.parent, dataTarget: '#' + bodyId, ariaExpanded: 'false', ariaControls: bodyId, class: 'collapsed', style: {cursor: 'pointer'}}, [
                                span({class: 'fa angle-right'}),
                                content.title
                            ])
                        ])
                    ]),
                    div({id: bodyId, class: 'panel-collapse collapse', role: 'tabpanel', ariaLabelledby: headingId}, [
                        div({class: 'panel-body'}, [
                            content.body
                        ])
                    ])
                ]);
            }
            function renderMetadataPanel(parent) {
                var body, metadata = state.get('object.metadata');
                if (metadata && (Object.keys(metadata).length > 0)) {
                    body = table({class: 'table'}, [
                        Object.keys(metadata).map(function (key) {
                            return tr([
                                td(key),
                                td(metadata[key])
                            ]);
                        })
                    ]);
                } else {
                    body = 'no metadata for this object';
                }
                return panel({
                    title: 'Raw Metadata',
                    body: body,
                    parent: parent
                });
            }
            function renderVersionsPanel(parent) {
                var content,
                    versions = state.get('versions');
                if (versions && versions.length > 0) {
                    content = table({class: 'table'}, versions.map(function (version) {
                        return tr([
                            td(a({href: '#dataview/' + version.wsid + '/' + version.id + '/' + version.version}, [
                                'v' + version.version
                            ])),
                            td(['Saved on ', dateFormat(version.save_date), ' by ', a({href: '#people/' + version.saved_by}, version.saved_by)])
                        ]);
                    }));
                } else {
                    content = 'no versions';
                }
                return panel({
                    title: 'Versions',
                    body: content,
                    parent: parent
                });
            }
            function renderReferencedByPanel(parent) {
                var content,
                    tooManyRefs = state.get('too_many_inc_refs'),
                    refs = state.get('inc_references');
                if (tooManyRefs) {
                    content = 'Sorry, there are too many references to this data to display.';
                } else {
                    if (refs && refs.length > 0) {
                        content = table({class: 'table'}, [
                            tr([
                                th('Name'), th('Type'), th()
                            ])
                        ].concat(refs.map(function (ref) {
                            return tr([
                                td(a({href: ['#dataview', ref.wsid, ref.id, ref.version].join('/')}, ref.name)),
                                td(a({href: ['#spec', 'type', ref.type].join('/')}, ref.typeName)),
                                td(['Saved on ', dateFormat(ref.save_date), ' by ', a({href: ['#people', ref.saved_by].join('/')})])
                            ]);
                        })));
                    } else {
                        content = 'No other data references this data object.';
                    }
                }
                return panel({
                    title: 'Referenced by',
                    body: content,
                    parent: parent
                });
            }
            function renderReferencesPanel(parent) {
                var content,
                    tooManyRefs = state.get('too_many_out_refs'),
                    refs = state.get('out_references');
                if (tooManyRefs) {
                    content = 'Sorry, there are too many references from this data to display.';
                } else {
                    if (refs && refs.length > 0) {
                        content = table({class: 'table'}, [
                            tr([
                                th('Name'), th('Type'), th()
                            ])
                        ].concat(refs.map(function (ref) {
                            return tr([
                                td(a({href: ['#dataview', ref.wsid, ref.id, ref.version].join('/')}, ref.name)),
                                td(a({href: ['#spec', 'type', ref.type].join('/')}, ref.typeName)),
                                td(['Saved on ', dateFormat(ref.save_date), ' by ', a({href: ['#people', ref.saved_by].join('/')}, ref.saved_by)])
                            ]);
                        })));
                    } else {
                        content = 'This data object references no other data.';
                    }
                }
                return panel({
                    title: 'References',
                    body: content,
                    parent: parent
                });
            }
            function render() {

                return div({class: 'row'}, [
                    div({class: 'col-sm-6'}, [
                        table({class: 'kb-dataview-header-tbl'}, [
                            renderTitleRow()
                        ]),
                        table({class: 'table'}, [
                            renderVersionRow(),
                            renderTypeRow(),
                            renderNarrativeRow(),
                            tr([
                                th('Last Updated'),
                                td({dataElement: 'last-updated'}, [
                                    dateFormat(state.get('object.save_date')), ' by ', a({href: ['#people', state.get('object.saved_by')].join('/')}, state.get('object.saved_by'))
                                ])
                            ]),
                            renderPermalinkRow()
                        ])
                    ]),
                    div({class: 'col-sm-6'}, [
                        div({class: 'panel-group', id: 'accordion', role: 'tablist', ariaMultiselectable: 'true'}, [
                            renderMetadataPanel('accordion'),
                            renderVersionsPanel('accordion'),
                            renderReferencedByPanel('accordion'),
                            renderReferencesPanel('accordion')
                        ])
                    ])
                ]);
            }

            // Widget lifecycle API

            function init(config) {
                return Promise.try(function () {
                });
            }
            function attach(node) {
                return Promise.try(function () {
                    mount = node;
                    container = dom.createElement('div');
                    mount.appendChild(container);
                    container.innerHTML = renderLayout();
                    container.querySelector('[data-placeholder="content"]').innerHTML = html.loading();
                });
            }
            function start(params) {
                return Promise.try(function () {
                    workspaceId = params.workspaceId;
                    objectId = params.objectId;
                    objectVersion = params.objectVersion;
                    objectRef = APIUtils.makeWorkspaceObjectRef(params.objectInfo.wsid, params.objectInfo.id, params.objectInfo.version);
                    if (!workspaceId) {
                        throw 'Workspace ID is required';
                    }

                    if (!objectId) {
                        throw 'Object ID is required';
                    }
                    return fetchData()
                        .then(function () {
                            container.innerHTML = renderLayout();
                            var content = container.querySelector('[data-placeholder="content"]');
                            if (content) {
                                content.innerHTML = render();
                            }
                        })
                        .catch(function (err) {
                            console.error(err);
                            if (err.status && err.status === 500) {
                                // User probably doesn't have access -- but in any case we can just tell them
                                // that they don't have access.
                                if (err.error.error.match(/^us.kbase.workspace.database.exceptions.NoSuchObjectException:/)) {
                                    state.set('status', 'notfound');
                                    state.set('error', {
                                        type: 'client',
                                        code: 'notfound',
                                        shortMessage: 'This object does not exist',
                                        originalMessage: err.error.message
                                    });
                                } else if (err.error.error.match(/^us.kbase.workspace.database.exceptions.InaccessibleObjectException:/)) {
                                    state.set('status', 'denied');
                                    state.set('error', {
                                        type: 'client',
                                        code: 'denied',
                                        shortMessage: 'You do not have access to this object',
                                        originalMessage: err.error.message
                                    });
                                } else {
                                    state.set('status', 'error');
                                    state.set('error', {
                                        type: 'client',
                                        code: 'error',
                                        shortMessage: 'An unknown error occured',
                                        originalMessage: err.error.message
                                    });
                                }
                                resolve();
                            } else {
                                state.set('error', {
                                    type: 'general',
                                    code: 'error',
                                    shortMessage: 'An unknown error occured'
                                });
                            }
                        });

                });
            }
            function stop() {
                return Promise.try(function () {
                });
            }
            function detach() {
                return Promise.try(function () {
                    mount.removeChild(container);
                });
            }
            function destroy() {
                return Promise.try(function () {
                });
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