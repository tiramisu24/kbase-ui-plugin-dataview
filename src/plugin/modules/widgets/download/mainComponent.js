/*global define*/
/*jslint white:true,browser:true */
define([
    'numeral',
    'kb/common/html',
    'kb/common/dom',
    'plugins/dataview/modules/places',
    'yaml!plugins/dataview/modules/widgets/download/typeSupport.yml',
    'kb/service/client/workspace',
    'kb/service/client/transform',
    'kb/service/client/userAndJobState',
    'kb/service/utils',
    'plugins/dataview/modules/poller',
    'kb_plugin_dataview',
    'plugins/dataview/modules/toggler'
], function (numeral, html, dom, Places, typeSupport, WorkspaceClient, TransformClient, UserAndJobState, apiUtils, Poller, Plugin, Toggler) {
    'use strict';
    function factory(config) {
        var parent, container, runtime = config.runtime,
            tag = html.tag, a = tag('a'),
            div = tag('div'), button = tag('button'), label = tag('label'), input = tag('input'),
            table = tag('table'), tr = tag('tr'), td = tag('td'), th = tag('th'), p = tag('p'),
            form = tag('form'),
            span = tag('span'), iframe = tag('iframe'),
            places = Places.make({
                root: container
            }),
            toggleState = 'hidden',
            poller = Poller.make({interval: 1000}),
            state = {
                mode: 'new',
                downloads: {}
            },
        reactive, toggler;

        /*
         * A Component
         * 
         *  Copmonents are the latest iteration of lightweight widget like things.
         *  - state - set data, start a render timer
         *  - render - run upon a state-setting timer
         *  - events - added in render, they are hooked into specific points
         *             of the rendered ui by dom id.
         *             
         *  Once build, the ui may be reactive -- dom listeners (events) may 
         *  alter the dom, alter the state and force a re-render, or talk to
         *  other components.
         *  
         *  Components are 
         */

        // Renderers

        function renderLayout() {
            return div({class: 'hidden', id: places.add('main')}, [
                div({class: 'panel panel-primary'}, [
                    div({class: 'panel-heading'}, [
                        span({class: 'panel-title', id: places.add('title')}, 'Transform and Download Data Object')
                    ]),
                    div({class: 'panel-body'}, [
                        div({class: 'container-fluid'}, [
                            div({class: 'col-md-12'}, [
                                p([
                                    'This tool allows you to convert this data object to one or more output formats and download the resulting file.'
                                ]),
                                p({id: places.add('comment')})
                            ]),
                            div({class: 'col-md-12'}, [span({id: places.add('content')})]),
                            div({class: 'col-md-12', style: {marginTop: '1em'}}, [
                                div({class: 'panel panel-default'}, [
                                    div({class: 'panel-heading'}, [
                                        div({class: 'panel-title'}, 'Requested Transforms')
                                    ]),
                                    div({class: 'panel-body'}, [
                                        div({id: places.add('downloads')})
                                    ]),
                                    div({id: places.add('downloaders')})
                                ])
                            ])
                        ])
                    ])
                ])
            ]);
        }
        var layout = renderLayout();

        function renderElapsed(elapsed) {
            if (elapsed === undefined) {
                return '';
            }
            return numeral(elapsed).format('00:00:00');
        }

        function renderBugReportUrl(download) {
            var base = runtime.config('services.doc_site.url');
            return base + '/report-an-issue';
        }

        // Little delegated Event Listening service.

        var listeners = {};
        function addListener(listener) {
            listeners[listener.id + '.' + listener.type] = listener;
        }
        function getListener(listener) {
            return listeners[listener.id + '.' + listener.type];
        }
        function removeListeners() {
            listeners = {};
        }
        function eventListener(e) {
            var listener = listeners[e.target.id + '.' + e.type];
            if (listener) {
                listener.handler(e);
            }
        }
        function addEventManager(eventsToListenFor) {
            eventsToListenFor.forEach(function (eventType) {
                container.addEventListener(eventType, eventListener);
            });
        }

        /*
         * Buttons and possibly other controls are generated from a spec, and
         * the call back registered with the event mechanism. They can be identified
         * by name so that code can change their state. E.g. disable, enable, 
         */
        var buttons = {};
        function addButton(spec) {
            var buttonId = html.genId(),
                handler = function (e) {
                    e.preventDefault();
                    spec.handler();
                },
                klass = ['btn', 'btn-' + spec.type],
                listener = {
                    id: buttonId,
                    type: 'click',
                    handler: handler
                };


            if (spec.disabled) {
                klass.push('disabled');
                listener.disabled = true;
                listener.disabledHandler = listener.handler;
                listener.handler = function () {
                    alert('This button is disabled');
                };
            }

            addListener(listener);

            if (spec.name) {
                buttons[spec.name] = buttonId;
            }

            var width = spec.width || '100%';

            return  button({
                style: {width: width},
                class: klass.join(' '),
                id: buttonId
            }, spec.label);
        }

        function disableButton(name) {
            var buttonId = buttons[name];
            if (!buttonId) {
                return;
            }
            var listener = getListener({id: buttonId, type: 'click'});
            if (!listener) {
                return;
            }

            if (listener.disabled) {
                return;
            }

            var node = document.getElementById(buttonId);
            if (!node) {
                return;
            }

            listener.disabledHandler = listener.handler;
            listener.handler = function () {
                alert('This button is disabled');
            };
            node.classList.add('disabled');
            listener.disabled = true;
        }

        function enableButton(name) {
            var buttonId = buttons[name];
            if (!buttonId) {
                return;
            }
            var listener = getListener({id: buttonId, type: 'click'});
            if (!listener) {
                return;
            }
            if (!listener.disabled) {
                return;
            }

            var node = document.getElementById(buttonId);
            if (!node) {
                return;
            }

            listener.handler = listener.disabledHandler;
            delete listener.disabledHandler;
            node.classList.remove('disabled');
            listener.disabled = false;
        }

        function removeButton(spec) {

        }

        var checkboxes = {};
        function addCheckbox(spec) {
            var checkboxId = html.genId(),
                handler = function (e) {
                    e.preventDefault();
                    spec.handler();
                },
                klass = ['btn', 'btn-' + spec.type],
                listener = {
                    id: checkboxId,
                    type: 'change',
                    handler: handler
                },
                name = spec.name || 'checkbox_' + spec.value;

            addListener(listener);

            if (name) {
                checkboxes[name] = checkboxId;
            }

            return label({class: 'kb-checkbox-control'}, [
                input({
                    type: 'checkbox', 
                    autocomplete: 'off', 
                    checked: spec.checked, 
                    value: spec.value
                }),
                spec.label
            ]);
        }



        function makeUrl(path, query) {
            var fullPath = Plugin.plugin.fullPath + '/' + path.join('/'),
                queryString = Object.keys(query).map(function (key) {
                return [encodeURIComponent(key), encodeURIComponent(query[key])].join('=');
            }).join('&');
            return window.location.origin + fullPath + '?' + queryString;
        }

        function addDownloader(url) {
            var id = html.genId(),
                content = iframe({id: id, src: url, style: {border: '1px red solid', width: '40px', height: '40px'}});
            places.appendContent('downloaders', content);
            // unfortunately, there is no way to monitor the progress of this download.
        }

        function doDownload(download) {
            if (download.limit !== null) {
                if (download.limit === 0) {
                    download.message = 'No more downloads available';
                    return;
                }
                download.limit -= 1;
                if (download.limit === 0) {
                    download.message = 'Download starting; please run Transform again to obtain another download';
                }
            } else {
                download.message = 'You may download this file again if you need to';
            }
            // window.open(download.url, '_self');
            addDownloader(download.url);
        }

        function renderNextButton(download) {
            switch (download.status) {
                case 'downloaded':
                    if (download.limit === 0) {
                        return addButton({
                            type: 'default',
                            disabled: true,
                            handler: function () {
                                alert('Can only download once');
                            },
                            label: 'Downloaded'
                        });
                    }
                    return addButton({
                        type: 'primary',
                        handler: function () {
                            doDownload(download);
                            download.status = 'downloaded';
                            renderDownloads();
                        },
                        label: 'Download File'
                    });
                case 'ready':
                    return addButton({
                        type: 'primary',
                        handler: function () {
                            doDownload(download);
                            download.status = 'downloaded';
                            renderDownloads();
                        },
                        label: 'Download File'
                    });
                case 'timedout':
                case 'error':
                    return addButton({
                        type: 'warning',
                        handler: function () {
                            runtime.send('app', 'redirect', {
                                url: renderBugReportUrl(download),
                                newWindow: true
                            });
                            // alert('report an error to ' + renderBugReportUrl(download));
                        },
                        label: 'Report Error'
                    });
                case 'waiting':
                    return addButton({
                        type: 'danger',
                        handler: function () {
                            alert('cancel ');
                        },
                        label: 'Cancel'
                    });
                default:
                    return '';
            }
        }

        function renderDownloads() {
            // removeListeners();
            var content = table({class: 'table table-bordered', style: {width: '100%'}}, [
                tr([th({width: '10%'}, 'Format'),
                    th({width: '10%'}, 'Started?'),
                    th({width: '10%'}, 'Requested?'),
                    th({width: '10%'}, 'Completed?'),
                    th({width: '10%'}, 'Available?'),
                    th({width: '10%'}, 'Elapsed'),
                    th({width: '10%'}, 'Status'),
                    th({width: '10%'}, 'Next'),
                    th({width: '20%'}, 'Message')
                ]),
                Object.keys(state.downloads).map(function (key) {
                    var download = state.downloads[key],
                        formatName = state.downloadConfig[download.formatId].name;

                    return tr([
                        td(formatName),
                        td(download.started ? 'Y' : 'n'),
                        td(download.requested ? 'Y' : 'n'),
                        td(download.completed ? 'Y' : 'n'),
                        td(download.available ? 'Y' : 'n'),
                        td(renderElapsed(download.elapsed)),
                        td(download.status || ''),
                        td(renderNextButton(download)),
                        td(download.message || '')]);
                }).join('')
            ]);
            places.setContent('downloads', content);
        }

        function renderDownloadForm(downloadConfig) {
            var content = form([
                table([
                    tr([
                        td('Transform to: '),
                        td(span({class: 'kb-btn-group', dataToggle: 'buttons'},
                            downloadConfig.map(function (downloader, i) {
                                var formatId = String(i);
                                return addCheckbox({
                                    type: 'default',
                                    checked: false,
                                    value: String(i),
                                    handler: function (e) {
                                        // update the downloads list                                            
                                        if (e.target.checked) {
                                            state.downloads[formatId] = {
                                                formatId: i,
                                                requested: false,
                                                completed: false,
                                                available: false
                                            };
                                        } else {
                                            delete state.downloads[formatId];
                                        }
                                        renderDownloads();
                                        if (Object.keys(state.downloads).length === 0) {
                                            disableButton('transform');
                                        } else {
                                            enableButton('transform');
                                        }
                                    },
                                    label: downloader.name
                                })
                            }).join(' ')))
                    ]),
                    tr([
                        td(),
                        td([
                            div({class: 'btn-toolbar', role: 'toolbar'}, [
                                div({class: 'btn-group', role: 'group'}, [
                                    addButton({
                                        name: 'transform',
                                        type: 'primary',
                                        handler: function () {
                                            doStartTransform();
                                            disableButton('transform');
                                            enableButton('stop');
                                        },
                                        label: 'Transform',
                                        width: '10em',
                                        disabled: true
                                    }),
                                    addButton({
                                        name: 'stop',
                                        type: 'danger',
                                        handler: function () {
                                            doStopTransform();
                                            disableButton('stop');
                                            enableButton('reset');
                                        },
                                        label: 'Stop',
                                        disabled: true,
                                        width: '10em'
                                    }),
                                    addButton({
                                        name: 'reset',
                                        type: 'default',
                                        handler: function () {
                                            doReset();
                                            disableButton('reset');
                                            enableButton('transform');
                                        },
                                        label: 'Reset',
                                        disabled: true,
                                        width: '10em'
                                    })
                                ])
                            ])
                        ])
                    ])
                ])
            ]),
                events = [{
                        type: 'change',
                        selector: 'input',
                        handler: function (e) {
                            var value = e.target.value;
                            if (e.target.checked) {
                                state.downloads[value] = {
                                    formatId: parseInt(value, 10),
                                    requested: false,
                                    completed: false,
                                    available: false
                                };
                            } else {
                                delete state.downloads[value];
                            }
                            renderDownloads();
                            if (Object.keys(state.downloads).length === 0) {
                                disableButton('transform');
                            } else {
                                enableButton('transform');
                            }
                        }
                    }];
            return {
                content: content,
                events: events
            };
        }




        // Downloader stuff

        function parseShockNode(shockNodeId) {
            var parts = shockNodeId.split('/');
            if (parts.length > 1) {
                shockNodeId = parts[parts.length - 1];
            }
            parts = shockNodeId.split('?');
            if (parts.length > 0) {
                shockNodeId = parts[0];
            }
            return shockNodeId;
        }

        function makeDownloadUrl(ujsResults, workspaceObjectName, unzip) {
            var shockNodeId = parseShockNode(ujsResults.shocknodes[0]),
                url = runtime.config('services.data_import_export.url') + '/download',
                query = {
                    id: shockNodeId,
                    token: runtime.service('session').getAuthToken(),
                    del: 1
                };
            if (unzip) {
                query.unzip = unzip;
            } else {
                query.name = workspaceObjectName + '.zip';
            }
            if (ujsResults.remoteShockUrl) {
                query.url = ujsResults.remoteShockUrl;
            }
            return url + '?' + encodeQuery(query);
        }

        function transformAndDownload(download) {
            var downloadSpec = state.downloadConfig[download.formatId],
                args = {
                    external_type: downloadSpec.external_type,
                    kbase_type: state.type,
                    workspace_name: state.params.objectInfo.ws,
                    object_name: state.params.objectInfo.name,
                    optional_arguments: {
                        transform: downloadSpec.transform_options
                    }
                },
            nameSuffix = '.' + downloadSpec.name.replace(/[^a-zA-Z0-9|\.\-_]/g, '_'),
                transformClient = new TransformClient(runtime.getConfig('services.transform.url'), {
                    token: runtime.service('session').getAuthToken()
                }),
                workspaceObjectName = state.params.objectInfo.name + nameSuffix;

            download.started = true;
            download.limit = 1;
            transformClient.download(args)
                .then(function (downloadResult) {
                    var jobId = downloadResult[1];
                    download.jobId = jobId;
                    download.requested = true;
                    download.message = 'Requested transform of this object...';
                    renderDownloads();

                    var jobs = new UserAndJobState(runtime.getConfig('services.user_job_state.url'), {
                        token: runtime.service('session').getAuthToken()
                    });

                    // var jobs2 = new UserAndJobState(runtime.getConfig('https://kbase.us/services/transform'), {
                    //    token: runtime.service('session').getAuthToken()
                    //});

                    poller.addTask({
                        timeout: 300000,
                        isCompleted: function (elapsed) {
                            return jobs.get_job_status(jobId)
                                .then(function (data) {
                                    var status = data[2],
                                        complete = data[5],
                                        wasError = data[6];
                                    if (complete === 1) {
                                        if (wasError === 0) {
                                            return true;
                                        }
                                        throw new Error(status);
                                    }
                                    download.elapsed = elapsed / 1000;
                                    download.status = 'waiting';
                                    renderDownloads();
                                    return false;
                                })
                                .catch(function (err) {

                                    //jobs.list_jobs()
                                    //    .then(function (jobs) {
                                    //        console.log('JOBS');
                                    //        console.log(jobs);
                                    //    });
                                    throw err;
                                });
                        },
                        whenCompleted: function () {
                            return jobs.get_results(jobId)
                                .then(function (ujsResults) {
                                    download.completed = true;
                                    var url = makeDownloadUrl(ujsResults, workspaceObjectName, downloadSpec.unzip);
                                    download.url = url;
                                    download.status = 'ready';
                                    download.available = true;
                                    download.message = 'Transform complete, ready for download.';
                                    renderDownloads();
                                });
                        },
                        whenTimedOut: function (elapsed) {
                            download.error = true;
                            download.status = 'timedout',
                                download.message = 'Timed out after ' + elapsed / 1000 + ' seconds';
                            renderDownloads();
                        },
                        whenError: function (err) {
                            console.error(err);
                            download.status = 'error';
                            download.error = true;
                            var msg;
                            if (err.message) {
                                msg = err.message;
                            } else if (err.error.message) {
                                msg = err.error.message;
                            } else {
                                msg = 'Unknown error';
                            }
                            download.message = msg;
                            renderDownloads();
                            // us.kbase.userandjobstate.jobstate.exceptions.NoSuchJobException
                        }
                    });
                })
                .catch(function (err) {
                    download.status = 'error';
                    download.error = true;
                    var msg;
                    if (err.message) {
                        msg = err.message;
                    } else if (err.error.message) {
                        msg = err.error.message;
                    } else {
                        msg = 'Unknown error';
                    }
                    download.message = msg;
                    renderDownloads();
                });
        }

        function downloadFromWorkspace(workspaceName, objectName, workspaceUrl) {
            var url = runtime.getConfig('services.data_import_export.url') + '/download',
                query = {
                    ws: workspaceName,
                    id: objectName,
                    token: runtime.service('session').getAuthToken(),
                    url: workspaceUrl,
                    name: objectName + '.JSON.zip',
                    wszip: 1
                },
            downloadUrl = url + '?' + encodeQuery(query);
            return downloadUrl;
        }

        function justDownload(download) {
            download.started = true;
            download.requested = true;
            download.completed = true;
            download.available = true;
            download.limit = null;
            var url = downloadFromWorkspace(state.params.objectInfo.ws, state.params.objectInfo.name, runtime.getConfig('services.workspace.url'));
            download.url = url;
            download.status = 'ready';
            download.message = '';
            renderDownloads();
        }

        // Button Actions

        function doStartTransform() {
            // gather the selected download types.
            Object.keys(state.downloads).forEach(function (id) {
                var download = state.downloads[id],
                    downloadSpec = state.downloadConfig[download.formatId];
                if (downloadSpec.name === 'JSON') {
                    justDownload(download);
                } else {
                    transformAndDownload(download);
                }
            });
        }

        function doStopTransform() {
            alert('Cannot do this yet');
        }

        function doReset() {
            alert('Not implemented yet');
        }

        // Utils

        function getRef(params) {
            var ref = params.objectInfo.ws + '/' + params.objectInfo.name;
            if (params.objectInfo.version) {
                ref += '/' + params.objectInfo.version;
            }
            return ref;
        }

        function setErrorMessage(message) {
            places.setContent('content', message);
        }

        function encodeQuery(query) {
            return Object.keys(query).map(function (key) {
                return [key, String(query[key])].map(function (element) {
                    return encodeURIComponent(element);
                }).join('=');
            }).join('&');
        }

        function qsa(node, selector) {
            if (selector === undefined) {
                selector = node;
                node = document;
            }
            var result = node.querySelectorAll(selector);
            if (result === null) {
                return [];
            }
            return Array.prototype.slice.call(result);
        }

        // API

        function init(config) {
        }

        function attach(node) {
            parent = node;
            container = node.appendChild(document.createElement('div'));
            addEventManager(['click', 'load']);
            // reactive = Reactive.make({node: container});
        }

        function start(params) {
            state.params = params;
            container.innerHTML = layout;
            toggler = Toggler.make({
                node: places.getNode('main'),
                hide: true
            });

            // listen for events
            runtime.recv('downloadWidget', 'toggle', function () {
                toggler.toggle();
            });
        }

        function run(params) {
            // We can instantiate the widget as soon as we are started or run,
            // because the params passed to the page are good enough for
            // us to get started with.
            // TODO: the main panel could/should already have pulled down the 
            // basic object info, so in theory we could ask the parent widget
            // for the object info.
            var workspace = new WorkspaceClient(runtime.getConfig('services.workspace.url'), {
                token: runtime.service('session').getAuthToken()
            }),
                ref = getRef(params);
            return workspace.get_object_info_new({
                objects: [{ref: ref}],
                ignoreErrors: 1
            })
                .then(function (objectInfoArray) {
                    if (objectInfoArray.length === 0) {
                        throw new Error('No object found with ref ' + ref);
                    }
                    if (objectInfoArray.length > 1) {
                        throw new Error('Too many objects returned for ref ' + ref);
                    }
                    var objectInfo = apiUtils.object_info_to_object(objectInfoArray[0]),
                        type = objectInfo.typeModule + '.' + objectInfo.typeName,
                        typeDownloadConfig = typeSupport.types[type];

                    // We use a little state object to stash away things.
                    state.type = type;

                    if (typeDownloadConfig === undefined) {
                        places.setContent('comment', 'This object type does not support Transform conversions, but the default JSON format is available.');
                        typeDownloadConfig = [];
                    }

                    var downloadConfig = typeDownloadConfig.concat({
                        name: 'JSON',
                        external_type: 'JSON.JSON',
                        transform_options: {}
                    });

                    state.downloadConfig = downloadConfig;

                    var form = renderDownloadForm(downloadConfig);

                    places.setContent('content', form.content);

                    form.events.forEach(function (event) {
                        var nodes = qsa(places.getNode('content'), event.selector);
                        nodes.forEach(function (node) {
                            node.addEventListener(event.type, event.handler);
                        });
                    });

                });
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
            run: run,
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