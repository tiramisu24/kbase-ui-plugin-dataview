/*global define,alert*/
/*jslint white:true,browser:true */
define([
    'knockout',
    'kb/common/html',
    'kb/service/client/workspace',
    'kb/service/utils'
], function (ko, html, WorkspaceClient, apiUtils) {
    'use strict';
    function factory(config) {
        var parent, container, runtime = config.runtime,
            tag = html.tag,
            div = tag('div'), button = tag('button'), input = tag('input'),
            table = tag('table'), tr = tag('tr'), td = tag('td'), th = tag('th'),
            form = tag('form'), select = tag('select'), a = tag('a'),
            p = tag('p'), b = tag('b'),
            span = tag('span'),
            viewModel,
            toggleState = 'hidden',
            toggleListener,
            workspaceClient = new WorkspaceClient(runtime.getConfig('services.workspace.url'), {
                token: runtime.service('session').getAuthToken()
            });


        function show() {
            container.firstChild.classList.remove('hidden');
        }

        function hide() {
            container.firstChild.classList.add('hidden');
        }

        function toggle() {
            switch (toggleState) {
                case 'hidden':
                    show();
                    toggleState = 'showing';
                    break;
                case 'showing':
                    hide();
                    toggleState = 'hidden';
                    break;
            }
        }

        function getWritableNarratives(params) {
            var workspaceId = params.objectInfo.wsid;
            return workspaceClient.list_workspace_info({
                perm: 'w'
            })
                .then(function (data) {
                    var objects = data.map(function (workspaceInfo) {
                        return apiUtils.workspace_metadata_to_object(workspaceInfo);
                    });
                    return objects.filter(function (obj) {
                        if (obj.metadata.narrative && (!isNaN(parseInt(obj.metadata.narrative, 10))) &&
                            // don't keep the current narrative workspace.
                            obj.id !== workspaceId &&
                            obj.metadata.narrative_nice_name &&
                            obj.metadata.is_temporary && obj.metadata.is_temporary !== 'true') {
                            return true;
                        }
                        return false;
                    });
                });
        }

        function makeNarrativeUrl(path) {
            var base = runtime.getConfig('services.narrative.url');
            return base + path;
        }

        function doCopyIntoExistingNarrative(params, narrativeInfo) {
            // console.log(narrativeInfo);
            //alert('I want to copy from ' + params.objectInfo.ref + ' to ' + narrativeInfo.ref);
            var from = {ref: params.objectInfo.ref},
            to = {wsid: narrativeInfo.objectInfo.wsid, name: params.objectInfo.name};
            workspaceClient.copy_object({
                from: from,
                to: to
            })
                .then(function (copied) {
                    var copiedObjectInfo = apiUtils.objectInfoToObject(copied),
                        narrativeUrl = makeNarrativeUrl('/narrative/' + apiUtils.makeWorkspaceObjectId(narrativeInfo.workspaceInfo.id, narrativeInfo.workspaceInfo.metadata.narrative)),
                        message = div([
                            'Successfully copied this data object to the Narrative ',
                            narrativeInfo.workspaceInfo.metadata.narrative_nice_name,
                            span({style: {fontStyle: 'italic'}}, [
                                (a({href: narrativeUrl, class: 'btn btn-default', target: '_blank'}, 'Open this Narrative'))
                            ])
                        ]);

                    viewModel.completionMessage(message);
                    return copiedObjectInfo;
                });
        }


        function paramsToQuery(params) {
            return Object.keys(params).map(function (key) {
                return key + '=' + encodeURIComponent(params[key]);
            }).join('&');
        }

        function makeUrl(path, params) {
            var query = paramsToQuery(params),
                url = '#' + path + '?' + query;

            return url;
        }

        function doCopyIntoNewNarrative(params) {
            var path = 'narrativemanager/new',
                redirectParams = {
                    copydata: params.objectInfo.ref
                },
                url = makeUrl(path, redirectParams);
            window.open(url, 'window_' + html.genId());
            // TODO: This should be done via the router, but that
            // frankly needs a touch of love.
//            runtime.send('app', 'navigate', {
//                path: path,
//                params: params,
//                newWindow: 'newnarrative'
//            });
        }

        function getNarrative(objectReference) {
            return workspaceClient.get_object_info_new({
                objects: [{ref: objectReference}],
                ignoreErrors: 1
            })
                .then(function (info) {
                    if (info.length === 0) {
                        throw new Error('No Narrative found with reference ' + objectReference);
                    }
                    if (info.length > 1) {
                        throw new Error('Too many Narratives found with reference ' + objectReference);
                    }
                    var objectInfo = apiUtils.objectInfoToObject(info[0]);
                    return [objectInfo, workspaceClient.get_workspace_info({id: objectInfo.wsid})];
                })
                .spread(function (objectInfo, wsInfo) {
                    var workspaceInfo = apiUtils.workspaceInfoToObject(wsInfo);
                    return {
                        objectInfo: objectInfo,
                        workspaceInfo: workspaceInfo
                    };
                });
        }

        function renderComponent() {
            return div({class: 'hidden', dataPlace: 'main'}, [
                div({class: 'panel panel-primary'}, [
                    div({class: 'panel-heading'}, [
                        span({class: 'panel-title'}, 'Copy Object to Narrative')
                    ]),
                    div({class: 'panel-body'}, [
                        div({class: 'container-fluid'}, [
                            p([
                                'You may use this  panel to copy the ', b('data object'),
                                ' you are viewing into either a ', b('new Narrative'),
                                ', which will be created automatically, or an ', b('existing Narrartive'),
                                ' which you may select from the list below.'
                            ]),
                            div({class: 'col-md-8'}, [
                                form([
                                    table({class: 'table'}, [
                                        tr([
                                            td(input({type: 'radio', name: 'copyMethod', value: 'new', dataBind: {checked: 'copyMethod'}})),
                                            td('Copy into New Narrative')
                                        ]),
                                        tr([
                                            td(), td('or')
                                        ]),
                                        tr([
                                            td(input({type: 'radio', name: 'copyMethod', value: 'existing', dataBind: {checked: 'copyMethod'}})),
                                            td([
                                                'Copy into: ',
                                                select({dataBind: {
                                                        optionsCaption: '"Select a Narrative to Copy To"',
                                                        options: 'narratives',
                                                        optionsValue: '"value"',
                                                        optionsText: '"name"',
                                                        selectedOptions: 'selectedNarrative'
                                                    }})
                                            ])
                                        ]),
                                        '<!-- ko if: errorMessage() -->',
                                        tr([
                                            td([
                                                'ER'
                                            ]),
                                            td(div({dataBind: {text: 'errorMessage'}}))
                                        ]),
                                        '<!-- /ko -->',
                                        tr([
                                            td(),
                                            td([
                                                div({class: 'btn-toolbar', role: 'toolbar'}, [
                                                    div({class: 'btn-group', role: 'group'},
                                                        button({
                                                            class: 'btn btn-primary',
                                                            dataBind: 'click: handleCopy'
                                                        }, 'Copy and Open Narrative'))
                                                ])
                                            ])
                                        ]),
                                        '<!-- ko if: completionMessage() -->',
                                        tr([
                                            td([
                                                ''
                                            ]),
                                            td(div({dataBind: {html: 'completionMessage'}}))
                                        ]),
                                        '<!-- /ko -->',
                                    ])
                                ])
                            ]),
                            div({class: 'col-md-4'}, [
                                div({class: 'panel panel-default'}, [
                                    div({class: 'panel-heading'}, [
                                        div({class: 'panel-title'}, 'Selected Narrative')
                                    ]),
                                    div({class: 'panel-body'}, [
                                        '<!-- ko if: copyMethod() === "existing" -->',
                                        p([
                                            'The data object will be copied into the following Narrative:'
                                        ]),
                                        '<!-- ko with: selectedNarrativeObject -->',
                                        table({class: 'table'}, [
                                            tr([
                                                th('Ref'), td(div({dataBind: {text: 'objectInfo.ref'}}))
                                            ]),
                                            tr([
                                                th('Name'), td(div({dataBind: {text: 'workspaceInfo.metadata.narrative_nice_name'}}))
                                            ]),
                                            tr([
                                                th('Owner'), td(div({dataBind: {text: 'objectInfo.saved_by'}}))
                                            ]),
                                            tr([
                                                th('Last saved'), td(div({dataBind: {text: 'objectInfo.saveDate'}}))
                                            ])
                                        ]),
                                        '<!-- /ko -->',
                                        '<!-- /ko -->',
                                        '<!-- ko if: copyMethod() === "new" -->',
                                        p([
                                            'A new narrative will be created containing this data object.'
                                        ]),
                                        '<!-- /ko -->'
                                    ])
                                ])
                            ])
                        ])
                    ])
                ])
            ]);
        }

        // Knockout Stuff

        function ViewModel(params) {
            // Values
            this.narratives = ko.observableArray([]);
            this.copyMethod = ko.observable();
            this.selectedNarrative = ko.observable();
            this.selectedNarrativeObject = ko.observable();
            this.narrativesById = {};
            this.errorMessage = ko.observable();
            this.completionMessage = ko.observable();

            // Methods
            this.copyMethod.subscribe(function (newValue) {
                switch (newValue) {
                    case 'new':
                        this.selectedNarrative([undefined]);
                        break;
                }
            }.bind(this));
            this.selectedNarrative.subscribe(function (newValue) {
                var vm = this;
                if (newValue[0] === undefined) {
                    this.copyMethod('new');
                } else {
                    this.copyMethod('existing');
                    getNarrative(newValue[0])
                        .then(function (narrative) {
                            vm.selectedNarrativeObject(narrative);
                        })
                        .catch(Error, function (err) {
                            console.error(err);
                            vm.errorMessage(err.message);
                        })
                        .catch(function (err) {
                            console.error(err);
                            vm.errorMessage('unknown error');
                        });
                }
            }.bind(this));
            this.handleCopy = function () {
                this.errorMessage('');
                switch (this.copyMethod()) {
                    case 'new':
                        doCopyIntoNewNarrative(params);
                        break;
                    case 'existing':
                        if (this.selectedNarrative()[0]) {
                            doCopyIntoExistingNarrative(params, this.selectedNarrativeObject());
                        } else {
                            this.errorMessage('You must select a narrative before copying the data object into it.');
                        }
                        break;
                }
            };
        }

        // API

        function init(config) {
        }

        function attach(node) {
            parent = node;
            container = node.appendChild(document.createElement('div'));
            container.innerHTML = renderComponent();
        }

        function start(params) {
            toggleListener = runtime.recv('copyWidget', 'toggle', function () {
                toggle();
            });
            viewModel = new ViewModel(params);
            viewModel.copyMethod('new');
            ko.applyBindings(viewModel, container);
            return getWritableNarratives(params)
                .then(function (narratives) {
                    narratives.forEach(function (narrative) {
                        viewModel.narrativesById[narrative.id] = narrative;
                        viewModel.narratives.push({
                            name: narrative.metadata.narrative_nice_name,
                            value: [String(narrative.id), narrative.metadata.narrative].join('/')
                        });
                    });
                });
        }

        function run(params) {
            // ??
        }

        function stop() {
            if (toggleListener) {
                runtime.drop(toggleListener);
            }
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